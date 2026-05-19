/**
 * postTest hook for the mobile-sdk-ios domain.
 *
 * Authoritative pass/fail.
 *   1. Env precheck (Xcode CLI, xcodebuild ≥16, iOS Simulator runtime, CocoaPods).
 *   2. pod install in the agent's workspace dir.
 *   3. xcodebuild build for iOS Simulator.
 *
 * Gold-file diffing is not enforced — the build is the load-bearing
 * safety net: a transformed app that doesn't compile is broken regardless
 * of what it looks like.
 */

import type { PostTestHookContext, QualityCheckResult } from '@sfdc-internal/adk-eval';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export default async function validateAddMobileSdkIos(
  ctx: PostTestHookContext,
): Promise<QualityCheckResult[]> {
  const results: QualityCheckResult[] = [];

  // ---- Env precheck -------------------------------------------------------
  results.push(...checkEnvironment());
  if (results.some((r) => !r.passed)) {
    return results;
  }

  // ---- pod install --------------------------------------------------------
  const podResult = await runPodInstall(ctx);
  results.push(podResult);
  if (!podResult.passed) {
    return results;
  }

  // ---- xcodebuild build ---------------------------------------------------
  results.push(await runXcodebuildBuild(ctx));

  return results;
}

// ---------------------------------------------------------------------------
// Environment precheck
// ---------------------------------------------------------------------------

function checkEnvironment(): QualityCheckResult[] {
  const results: QualityCheckResult[] = [];

  // xcode-select -p must return an existing path
  const xcs = spawnSync('xcode-select', ['-p'], { encoding: 'utf-8' });
  const xcsPath = (xcs.stdout ?? '').trim();
  const xcsOk = xcs.status === 0 && xcsPath.length > 0 && existsSync(xcsPath);
  results.push({
    name: 'env:xcode-cli',
    passed: xcsOk,
    message: xcsOk
      ? `Xcode developer dir: ${xcsPath}`
      : 'xcode-select -p failed or pointed at a non-existent path; install Xcode Command Line Tools',
    severity: 'error',
  });

  // xcodebuild -version must report Xcode >= 16
  let xcbOk = false;
  let xcbMessage = 'xcodebuild not on PATH';
  const xcb = spawnSync('xcodebuild', ['-version'], { encoding: 'utf-8' });
  if (xcb.error) {
    /* default message stands */
  } else {
    const m = (xcb.stdout ?? '').match(/Xcode\s+(\d+)/);
    if (m && Number(m[1]) >= 16) {
      xcbOk = true;
      xcbMessage = `Xcode ${m[1]} detected`;
    } else if (xcb.stdout) {
      xcbMessage = `Xcode >= 16 required; found: ${xcb.stdout.split('\n')[0]}`;
    }
  }
  results.push({
    name: 'env:xcodebuild',
    passed: xcbOk,
    message: xcbMessage,
    severity: 'error',
  });

  // xcrun simctl list runtimes -j must list at least one available iOS runtime
  let simOk = false;
  let simMessage = 'xcrun simctl list runtimes failed';
  const sim = spawnSync('xcrun', ['simctl', 'list', 'runtimes', '-j'], {
    encoding: 'utf-8',
  });
  if (sim.status === 0 && sim.stdout) {
    try {
      const parsed = JSON.parse(sim.stdout) as {
        runtimes?: Array<{ identifier?: string; isAvailable?: boolean }>;
      };
      const ios = (parsed.runtimes ?? []).filter(
        (r) =>
          r.identifier?.startsWith('com.apple.CoreSimulator.SimRuntime.iOS-') &&
          r.isAvailable,
      );
      if (ios.length > 0) {
        simOk = true;
        simMessage = `${ios.length} iOS simulator runtime(s) available`;
      } else {
        simMessage =
          'No available iOS simulator runtime; install one via Xcode > Settings > Components';
      }
    } catch (e) {
      simMessage = `Could not parse simctl output: ${(e as Error).message}`;
    }
  }
  results.push({
    name: 'env:ios-simulator-runtime',
    passed: simOk,
    message: simMessage,
    severity: 'error',
  });

  // pod --version
  const pod = spawnSync('pod', ['--version'], { encoding: 'utf-8' });
  const podOk = pod.status === 0;
  results.push({
    name: 'env:cocoapods',
    passed: podOk,
    message: podOk
      ? `CocoaPods ${(pod.stdout ?? '').trim()} detected`
      : 'pod not on PATH; install with `sudo gem install cocoapods`',
    severity: 'error',
  });

  return results;
}

// ---------------------------------------------------------------------------
// pod install
// ---------------------------------------------------------------------------

const POD_INSTALL_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function runPodInstall(
  ctx: PostTestHookContext,
): Promise<QualityCheckResult> {
  if (!ctx.outputDir) {
    return {
      name: 'setup:pod-install',
      passed: false,
      message:
        'ctx.outputDir is undefined — runner did not expose a writable workspace; cannot run pod install',
      severity: 'error',
    };
  }

  const workdir = ctx.outputDir;
  if (!existsSync(join(workdir, 'Podfile'))) {
    return {
      name: 'setup:pod-install',
      passed: false,
      message: `Podfile not found in ${workdir} — agent likely deleted or moved seed files`,
      severity: 'error',
    };
  }

  return new Promise((resolve) => {
    const child = spawn('pod', ['install', '--no-repo-update'], {
      cwd: workdir,
      env: process.env,
    });
    const chunks: string[] = [];
    child.stdout.on('data', (d) => chunks.push(d.toString()));
    child.stderr.on('data', (d) => chunks.push(d.toString()));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        name: 'setup:pod-install',
        passed: false,
        message:
          `Timed out after ${POD_INSTALL_TIMEOUT_MS / 1000}s. ` +
          `Last output:\n${tail(chunks.join(''), 50)}`,
        severity: 'error',
      });
    }, POD_INSTALL_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timer);
      const passed = code === 0;
      resolve({
        name: 'setup:pod-install',
        passed,
        message: passed
          ? 'pod install succeeded'
          : `Exit code ${code}. Last output:\n${tail(chunks.join(''), 50)}`,
        severity: 'error',
      });
    });
  });
}

// ---------------------------------------------------------------------------
// xcodebuild build
// ---------------------------------------------------------------------------

const XCB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

async function runXcodebuildBuild(
  ctx: PostTestHookContext,
): Promise<QualityCheckResult> {
  const workdir = ctx.outputDir!;
  const workspace = join(workdir, 'MinApp.xcworkspace');
  if (!existsSync(workspace)) {
    return {
      name: 'compile:xcodebuild',
      passed: false,
      message: `MinApp.xcworkspace not found at ${workspace} — pod install did not produce a workspace`,
      severity: 'error',
    };
  }

  return new Promise((resolve) => {
    const child = spawn(
      'xcodebuild',
      [
        '-workspace',
        'MinApp.xcworkspace',
        '-scheme',
        'MinApp',
        '-sdk',
        'iphonesimulator',
        '-destination',
        'generic/platform=iOS Simulator',
        '-configuration',
        'Debug',
        'CODE_SIGNING_ALLOWED=NO',
        'build',
      ],
      { cwd: workdir, env: process.env },
    );
    const chunks: string[] = [];
    child.stdout.on('data', (d) => chunks.push(d.toString()));
    child.stderr.on('data', (d) => chunks.push(d.toString()));

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve({
        name: 'compile:xcodebuild',
        passed: false,
        message:
          `Timed out after ${XCB_TIMEOUT_MS / 1000}s. ` +
          `Last output:\n${tail(chunks.join(''), 50)}`,
        severity: 'error',
      });
    }, XCB_TIMEOUT_MS);

    child.on('close', (code) => {
      clearTimeout(timer);
      const passed = code === 0;
      resolve({
        name: 'compile:xcodebuild',
        passed,
        message: passed
          ? 'BUILD SUCCEEDED'
          : `Exit code ${code}. Last output:\n${tail(chunks.join(''), 50)}`,
        severity: 'error',
      });
    });
  });
}

function tail(s: string, lines: number): string {
  const arr = s.split('\n');
  return arr.slice(Math.max(0, arr.length - lines)).join('\n');
}
