/**
 * preTest hook for the mobile-sdk-ios domain.
 *
 * Logs context and warns on misconfigured cases. No side effects.
 */

import type { PreTestHookContext } from '@sfdc-internal/adk-eval';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED_SEED_FILES = [
  'Podfile',
  'MinApp.xcodeproj/project.pbxproj',
  'MinApp.xcodeproj/xcshareddata/xcschemes/MinApp.xcscheme',
  'MinApp/AppDelegate.swift',
  'MinApp/Info.plist',
];

const REQUIRED_PROMPT_KEYWORDS = [
  'mobile sdk',
  'target',
  'consumer key',
  'callback',
  'login host',
];

export default async function prepareAddMobileSdkIos(
  ctx: PreTestHookContext,
): Promise<void> {
  console.log(`[mobile-sdk-ios:preTest] ${ctx.testCaseName}`);
  console.log(`[mobile-sdk-ios:preTest] Domain dir: ${ctx.domainDir}`);

  const caseDir = join(ctx.domainDir, 'datasets', ctx.testCaseName);
  const seedDir = join(caseDir, 'seed-data');
  for (const rel of REQUIRED_SEED_FILES) {
    const full = join(seedDir, rel);
    if (!existsSync(full)) {
      console.warn(
        `[mobile-sdk-ios:preTest] Missing seed file: ${rel} ` +
          `(expected at ${full}). Case may fail to build.`,
      );
    }
  }

  const promptLower = ctx.prompt.toLowerCase();
  const missing = REQUIRED_PROMPT_KEYWORDS.filter((kw) => !promptLower.includes(kw));
  if (missing.length > 0) {
    console.warn(
      `[mobile-sdk-ios:preTest] Prompt missing expected keywords: ` +
        missing.join(', ') +
        '. Skill may not have enough context to proceed without follow-up.',
    );
  }

  console.log(`[mobile-sdk-ios:preTest] ${ctx.testCaseName} ready`);
}
