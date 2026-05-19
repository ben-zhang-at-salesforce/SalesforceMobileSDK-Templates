# mobile-sdk-ios Eval Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `mobile-sdk-ios` eval domain that mirrors `mobile-sdk-android`, exercising the **Add Mobile SDK** scenario in `skills/ios-mobile-sdk` against a minimal CocoaPods iOS app, with `xcodebuild build` as the pass/fail signal.

**Architecture:** New sibling domain under `skills-eval/domains/mobile-sdk-ios/` containing `eval.config.json`, `hooks/{pre,post}-test.ts`, and one dataset `add-msdk-default/` with `seed-data/`, `gold/`, and `prompt.md`. Pre-test warns on missing seed files / prompt keywords (no failures). Post-test runs an env precheck (Xcode, simulator runtime, CocoaPods), then `pod install`, then `xcodebuild ... build`. The hook is the authoritative grader — gold is for human review only.

**Tech Stack:** TypeScript (hooks via `@sfdc-internal/adk-eval`), Swift 5 / iOS 18 SDK, CocoaPods, xcodebuild, Node 20+, vitest (adk-eval runner). One-time generator: xcodegen (not a runtime dep).

**Spec:** `docs/superpowers/specs/2026-05-19-mobile-sdk-ios-eval-domain-design.md`

**Worktree:** All work happens in the existing worktree at `.claude/worktrees/W-22453398-mobile-sdk-ios-eval` on branch `worktree-W-22453398-mobile-sdk-ios-eval` (already rebased onto `ben/W-22453398-eval-onboarding`).

---

## Phase 1 — Seed-data: minimal CocoaPods iOS app

The seed must build green via `xcodebuild` **before** any `pod install`. The skill is what adds CocoaPods Salesforce deps; the seed is a bare app that compiles standalone.

We use `xcodegen` once to produce `MinApp.xcodeproj` from a `project.yml` we author, then **commit the generated `.xcodeproj` and discard the `project.yml`**. The eval does not depend on xcodegen at runtime; this is purely a generation tool to avoid hand-writing 400+ lines of pbxproj.

### Task 1.1: Install xcodegen (one-time, local-only)

**Files:** none (tool install)

- [ ] **Step 1: Check if xcodegen is already installed**

```
which xcodegen
```

Expected: either a path (skip to Task 1.2) or "xcodegen not found".

- [ ] **Step 2: Install via Homebrew if missing**

```
brew install xcodegen
xcodegen --version
```

Expected: prints a version like `Version: 2.x.x`.

- [ ] **Step 3: Confirm the seed will not depend on xcodegen at runtime**

This is a sanity reminder, no command. xcodegen is used **once** in Task 1.2 to produce `MinApp.xcodeproj/`, after which the generated `.xcodeproj` is committed and the temp `project.yml` is discarded. Eval-runtime tools (`pod`, `xcodebuild`) do not need xcodegen.

### Task 1.2: Generate `MinApp.xcodeproj`

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp.xcodeproj/` (entire directory, generated)

- [ ] **Step 1: Create the seed directory layout**

```
mkdir -p skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp
cd skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data
```

- [ ] **Step 2: Write a temporary `project.yml` for xcodegen**

Create `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/project.yml`:

```yaml
name: MinApp
options:
  bundleIdPrefix: com.example
  deploymentTarget:
    iOS: "18.0"
  createIntermediateGroups: true
settings:
  base:
    PRODUCT_BUNDLE_IDENTIFIER: com.example.minapp
    CODE_SIGNING_ALLOWED: NO
    CODE_SIGNING_REQUIRED: NO
    CODE_SIGN_STYLE: Manual
    DEVELOPMENT_TEAM: ""
targets:
  MinApp:
    type: application
    platform: iOS
    sources:
      - path: MinApp
    info:
      path: MinApp/Info.plist
      properties:
        UILaunchStoryboardName: LaunchScreen
        UIApplicationSceneManifest:
          UIApplicationSupportsMultipleScenes: false
          UISceneConfigurations:
            UIWindowSceneSessionRoleApplication:
              - UISceneConfigurationName: Default Configuration
                UISceneDelegateClassName: $(PRODUCT_MODULE_NAME).SceneDelegate
schemes:
  MinApp:
    build:
      targets:
        MinApp: all
    run:
      config: Debug
    test:
      config: Debug
    profile:
      config: Release
    analyze:
      config: Debug
    archive:
      config: Release
```

- [ ] **Step 3: Run xcodegen**

```
cd skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data
xcodegen generate
```

Expected: prints `Created project at MinApp.xcodeproj`.

- [ ] **Step 4: Verify the generated project includes a shared scheme**

```
ls MinApp.xcodeproj/xcshareddata/xcschemes/
```

Expected: `MinApp.xcscheme` exists. (xcodegen generates a shared scheme by default per the `schemes:` block.)

- [ ] **Step 5: Delete the temporary `project.yml`**

```
rm project.yml
```

The generated `.xcodeproj/` is now self-contained and is what gets committed. xcodegen is not needed again.

### Task 1.3: Author seed Swift sources

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp/AppDelegate.swift`
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp/SceneDelegate.swift`
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp/LaunchScreen.storyboard`
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp/Info.plist`

These four files must exist **before** Task 1.2 step 3 runs (xcodegen needs them to be present so Sources references resolve). If you ran Task 1.2 already, do this task now and re-run `xcodegen generate` to refresh the pbxproj source list.

> **Re-ordering note:** in practice, do Task 1.3 first, then Task 1.2. The plan presents them in conceptual order but xcodegen requires the source files to exist.

- [ ] **Step 1: Write `MinApp/AppDelegate.swift`**

Path: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp/AppDelegate.swift`

```swift
import UIKit

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication,
                     didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {}

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }
}
```

- [ ] **Step 2: Write `MinApp/SceneDelegate.swift`**

Path: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp/SceneDelegate.swift`

```swift
import UIKit

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        window = UIWindow(frame: windowScene.coordinateSpace.bounds)
        window?.windowScene = windowScene
        window?.rootViewController = UIViewController()
        window?.makeKeyAndVisible()
    }

    func sceneDidDisconnect(_ scene: UIScene) {}
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneWillEnterForeground(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
```

- [ ] **Step 3: Write `MinApp/LaunchScreen.storyboard`**

Path: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp/LaunchScreen.storyboard`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="15400" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" launchScreen="YES" useTraitCollections="YES" useSafeAreas="YES" colorMatched="YES" initialViewController="01J-lp-oVM">
    <dependencies>
        <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="15404"/>
        <capability name="Safe area layout guides" minToolsVersion="9.0"/>
        <capability name="documents saved in the Xcode 9 format" minToolsVersion="9.0"/>
    </dependencies>
    <scenes>
        <scene sceneID="EHf-IW-A2E">
            <objects>
                <viewController id="01J-lp-oVM" sceneMemberID="viewController">
                    <view key="view" contentMode="scaleToFill" id="Ze5-6b-2t3">
                        <rect key="frame" x="0.0" y="0.0" width="375" height="667"/>
                        <autoresizingMask key="autoresizingMask" widthSizable="YES" heightSizable="YES"/>
                        <color key="backgroundColor" systemColor="systemBackgroundColor"/>
                        <viewLayoutGuide key="safeArea" id="Bcu-3y-fUS"/>
                    </view>
                </viewController>
                <placeholder placeholderIdentifier="IBFirstResponder" id="iYj-Kq-Ea1" userLabel="First Responder" sceneMemberID="firstResponder"/>
            </objects>
        </scene>
    </scenes>
</document>
```

- [ ] **Step 4: Write `MinApp/Info.plist`**

Note: xcodegen synthesizes `Info.plist` from the `info.properties` block in `project.yml`. After `xcodegen generate` runs, verify the generated `Info.plist` matches what we want; if xcodegen produced a sparser plist than expected, **overwrite** it explicitly with this content:

Path: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp/Info.plist`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>UIApplicationSceneManifest</key>
    <dict>
        <key>UIApplicationSupportsMultipleScenes</key>
        <false/>
        <key>UISceneConfigurations</key>
        <dict>
            <key>UIWindowSceneSessionRoleApplication</key>
            <array>
                <dict>
                    <key>UISceneConfigurationName</key>
                    <string>Default Configuration</string>
                    <key>UISceneDelegateClassName</key>
                    <string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
                </dict>
            </array>
        </dict>
    </dict>
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
    </array>
</dict>
</plist>
```

**Important:** No `SFDCOAuthLoginHost` key — that is what the skill is supposed to add.

### Task 1.4: Write the seed Podfile

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/Podfile`

- [ ] **Step 1: Write the seed Podfile**

```ruby
platform :ios, '18.0'

source 'https://cdn.cocoapods.org/'

target 'MinApp' do
  use_frameworks!
end
```

Path: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/Podfile`

**Important:** No Salesforce specs source, no `pod 'SalesforceSDKCore'`. Those are what the skill adds.

### Task 1.5: Add seed `.gitignore`

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/.gitignore`

- [ ] **Step 1: Write `.gitignore` excluding build artifacts that `xcodebuild` may produce in this directory**

Path: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/.gitignore`

```
.DS_Store
build/
DerivedData/
*.xcuserstate
xcuserdata/
Pods/
Podfile.lock
*.xcworkspace
```

The agent's run produces `Pods/`, `Podfile.lock`, and `*.xcworkspace` — those should never end up in the seed directory of the repo. (They're only present in the agent's output workspace, which is not this directory.)

### Task 1.6 (GATE 1): Manual simulator verification by the user

**Files:** none (verification step)

- [ ] **Step 1: Build the seed for the simulator**

```
cd skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data
xcodebuild \
  -project MinApp.xcodeproj \
  -scheme MinApp \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug \
  CODE_SIGNING_ALLOWED=NO \
  build 2>&1 | tail -20
```

Expected: ends with `** BUILD SUCCEEDED **`.

- [ ] **Step 2: Find the built `.app` bundle**

```
DD=$(xcodebuild -project MinApp.xcodeproj -scheme MinApp -showBuildSettings 2>/dev/null | awk -F' = ' '/[[:space:]]BUILT_PRODUCTS_DIR /{print $2}' | head -1)
ls "$DD/MinApp.app"
```

Expected: lists the bundle contents (Info.plist, MinApp executable, LaunchScreen.storyboardc).

- [ ] **Step 3: Boot a simulator and install the app**

```
xcrun simctl boot "iPhone 16" 2>/dev/null || true
open -a Simulator
xcrun simctl install booted "$DD/MinApp.app"
xcrun simctl launch booted com.example.minapp
```

Expected: simulator window shows the app's empty white view (the `UIViewController` from `SceneDelegate.swift`).

- [ ] **Step 4: User confirmation**

**STOP HERE.** Ask the user to verify the simulator shows the empty MinApp view. Do not proceed until the user confirms. If the simulator does not boot the app correctly, diagnose and fix the seed before continuing.

### Task 1.7: Commit Phase 1

- [ ] **Step 1: Stage the seed**

```
git add skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/
```

- [ ] **Step 2: Commit**

```
git commit -m "Add iOS eval seed-data: minimal MinApp Xcode project

Hand-crafted minimal CocoaPods-ready iOS app for the mobile-sdk-ios
eval domain's add-msdk-default case. Generated once via xcodegen,
checked in as a static fixture. Builds green via xcodebuild for the
iOS Simulator with CODE_SIGNING_ALLOWED=NO. No Mobile SDK wired up
yet — that is what the skill adds.

W-22453398"
```

---

## Phase 2 — Domain config and prompt

### Task 2.1: Author `eval.config.json`

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/eval.config.json`

- [ ] **Step 1: Write the config file**

Path: `skills-eval/domains/mobile-sdk-ios/eval.config.json`

```json
{
  "domain": "mobile-sdk-ios",
  "type": "knowledge",
  "protocols": ["baseline", "skill"],
  "surfaces": ["vibes"],
  "skipDeployValidation": true,
  "hooks": {
    "preTest": "hooks/pre-test.ts",
    "postTest": "hooks/post-test.ts"
  },
  "expectedInvocations": [
    { "name": "ios-mobile-sdk", "type": "skill" }
  ]
}
```

**Note:** `expectedInvocations[0].name` must be `ios-mobile-sdk` (the **skill directory name** in `skills/`), not `mobile-sdk-ios` (the **domain name**). This is a common mistake — see the spec § "Common mistakes" callout.

### Task 2.2: Author `prompt.md`

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/prompt.md`

- [ ] **Step 1: Write the prompt**

Path: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/prompt.md`

```
Add the Salesforce Mobile SDK to this iOS Swift app.

- App target: MinApp
- Consumer Key: 3MVG9_PLACEHOLDER_CONSUMER_KEY
- Callback URL: msdkapp://oauth/success
- Login host: https://login.salesforce.com
```

### Task 2.3: Commit Phase 2

- [ ] **Step 1: Commit**

```
git add skills-eval/domains/mobile-sdk-ios/eval.config.json \
        skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/prompt.md
git commit -m "Add mobile-sdk-ios domain config and add-msdk-default prompt

W-22453398"
```

---

## Phase 3 — Pre-test hook

### Task 3.1: Author `pre-test.ts`

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/hooks/pre-test.ts`

- [ ] **Step 1: Write the hook**

Path: `skills-eval/domains/mobile-sdk-ios/hooks/pre-test.ts`

```typescript
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
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit -p .
```

Expected: zero output, exit 0.

### Task 3.2 (GATE 2): Pre-test smoke test

**Files:**
- Create (temp, do not commit): `/tmp/pre-test-driver.mjs`

- [ ] **Step 1: Write a one-shot driver**

```
cat > /tmp/pre-test-driver.mjs <<'EOF'
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(process.argv[2] ?? '.');
const domainDir = resolve(repoRoot, 'skills-eval/domains/mobile-sdk-ios');
const promptPath = resolve(domainDir, 'datasets/add-msdk-default/prompt.md');
const prompt = readFileSync(promptPath, 'utf-8');

const ctx = {
  domainDir,
  testCaseName: 'add-msdk-default',
  prompt,
};

const mod = await import(`${domainDir}/hooks/pre-test.ts`);
await mod.default(ctx);
EOF
```

- [ ] **Step 2: Run the driver via tsx (already installed transitively as a vitest dep, available via `npx`)**

```
cd /Users/ben.zhang/Work/github/forcedotcom/SalesforceMobileSDK-Templates/.claude/worktrees/W-22453398-mobile-sdk-ios-eval
npx tsx /tmp/pre-test-driver.mjs .
```

Expected stdout, no warnings:
```
[mobile-sdk-ios:preTest] add-msdk-default
[mobile-sdk-ios:preTest] Domain dir: <abs-path-to-domain>
[mobile-sdk-ios:preTest] add-msdk-default ready
```

If any warning appears, the seed file list or the prompt has drifted from the hook's expectations — fix before proceeding.

- [ ] **Step 3: Clean up driver**

```
rm /tmp/pre-test-driver.mjs
```

### Task 3.3: Commit Phase 3

- [ ] **Step 1: Commit**

```
git add skills-eval/domains/mobile-sdk-ios/hooks/pre-test.ts
git commit -m "Add mobile-sdk-ios pre-test hook

Direct port of the Android pre-test, adapted for iOS seed file names
(Podfile, MinApp.xcodeproj, AppDelegate.swift, Info.plist) and prompt
keywords (target, consumer key, callback, login host). Warnings only;
never fails the eval.

W-22453398"
```

---

## Phase 4 — Gold tree

The gold tree captures what a perfect agent run would produce. It is overlaid onto the seed before Gate 3, and the post-test hook must pass against that overlay. Files we author here mirror the **Add Mobile SDK** path in `skills/ios-mobile-sdk/SKILL.md` Steps 3–7.

### Task 4.1: gold/Podfile

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/gold/Podfile`

- [ ] **Step 1: Write gold Podfile**

```ruby
source 'https://cdn.cocoapods.org/'
source 'https://github.com/forcedotcom/SalesforceMobileSDK-iOS-Specs'

platform :ios, '18.0'

target 'MinApp' do
  use_frameworks!
  pod 'SalesforceSDKCore'
end

post_install do |installer|
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |config|
      config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '18.0'
    end
  end
end
```

### Task 4.2: gold/MinApp/AppDelegate.swift

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/gold/MinApp/AppDelegate.swift`

- [ ] **Step 1: Write gold AppDelegate**

```swift
import UIKit
import SalesforceSDKCore

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?

    override init() {
        super.init()
        SalesforceManager.initializeSDK()
    }

    func application(_ application: UIApplication,
                     configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        return UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }

    func application(_ application: UIApplication,
                     didDiscardSceneSessions sceneSessions: Set<UISceneSession>) {}

    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        return true
    }
}
```

### Task 4.3: gold/MinApp/SceneDelegate.swift

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/gold/MinApp/SceneDelegate.swift`

- [ ] **Step 1: Write gold SceneDelegate**

```swift
import UIKit
import SalesforceSDKCore

class SceneDelegate: UIResponder, UIWindowSceneDelegate {

    var window: UIWindow?

    func scene(_ scene: UIScene,
               willConnectTo session: UISceneSession,
               options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }
        window = UIWindow(frame: windowScene.coordinateSpace.bounds)
        window?.windowScene = windowScene

        AuthHelper.registerBlock(forCurrentUserChangeNotifications: {
            self.resetViewState {
                self.setupRootViewController()
            }
        })
    }

    func sceneWillEnterForeground(_ scene: UIScene) {
        initializeAppViewState()
        AuthHelper.loginIfRequired {
            self.setupRootViewController()
        }
    }

    func initializeAppViewState() {
        guard Thread.isMainThread else {
            DispatchQueue.main.async { self.initializeAppViewState() }
            return
        }
        window?.rootViewController = InitialViewController(nibName: nil, bundle: nil)
        window?.makeKeyAndVisible()
    }

    func setupRootViewController() {
        let vc = UIViewController()
        vc.view.backgroundColor = .systemBackground
        let label = UILabel()
        label.text = "Mobile SDK ready"
        label.translatesAutoresizingMaskIntoConstraints = false
        vc.view.addSubview(label)
        NSLayoutConstraint.activate([
            label.centerXAnchor.constraint(equalTo: vc.view.centerXAnchor),
            label.centerYAnchor.constraint(equalTo: vc.view.centerYAnchor)
        ])
        window?.rootViewController = vc
    }

    func resetViewState(_ postResetBlock: @escaping () -> Void) {
        if let root = window?.rootViewController, root.presentedViewController != nil {
            root.dismiss(animated: false, completion: postResetBlock)
        } else {
            postResetBlock()
        }
    }

    func sceneDidDisconnect(_ scene: UIScene) {}
    func sceneDidBecomeActive(_ scene: UIScene) {}
    func sceneWillResignActive(_ scene: UIScene) {}
    func sceneDidEnterBackground(_ scene: UIScene) {}
}
```

### Task 4.4: gold/MinApp/InitialViewController.swift

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/gold/MinApp/InitialViewController.swift`

- [ ] **Step 1: Write gold InitialViewController**

```swift
import UIKit

class InitialViewController: UIViewController {}
```

### Task 4.5: gold/MinApp/bootconfig.plist

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/gold/MinApp/bootconfig.plist`

- [ ] **Step 1: Write gold bootconfig.plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>remoteAccessConsumerKey</key>
    <string>3MVG9_PLACEHOLDER_CONSUMER_KEY</string>
    <key>oauthRedirectURI</key>
    <string>msdkapp://oauth/success</string>
    <key>shouldAuthenticate</key>
    <true/>
</dict>
</plist>
```

### Task 4.6: gold/MinApp/Info.plist

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/gold/MinApp/Info.plist`

- [ ] **Step 1: Write gold Info.plist (full file, with `SFDCOAuthLoginHost`)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleDevelopmentRegion</key>
    <string>$(DEVELOPMENT_LANGUAGE)</string>
    <key>CFBundleExecutable</key>
    <string>$(EXECUTABLE_NAME)</string>
    <key>CFBundleIdentifier</key>
    <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
    <key>CFBundleInfoDictionaryVersion</key>
    <string>6.0</string>
    <key>CFBundleName</key>
    <string>$(PRODUCT_NAME)</string>
    <key>CFBundlePackageType</key>
    <string>$(PRODUCT_BUNDLE_PACKAGE_TYPE)</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>LSRequiresIPhoneOS</key>
    <true/>
    <key>SFDCOAuthLoginHost</key>
    <string>login.salesforce.com</string>
    <key>UIApplicationSceneManifest</key>
    <dict>
        <key>UIApplicationSupportsMultipleScenes</key>
        <false/>
        <key>UISceneConfigurations</key>
        <dict>
            <key>UIWindowSceneSessionRoleApplication</key>
            <array>
                <dict>
                    <key>UISceneConfigurationName</key>
                    <string>Default Configuration</string>
                    <key>UISceneDelegateClassName</key>
                    <string>$(PRODUCT_MODULE_NAME).SceneDelegate</string>
                </dict>
            </array>
        </dict>
    </dict>
    <key>UILaunchStoryboardName</key>
    <string>LaunchScreen</string>
    <key>UISupportedInterfaceOrientations</key>
    <array>
        <string>UIInterfaceOrientationPortrait</string>
    </array>
</dict>
</plist>
```

### Task 4.7: Commit Phase 4

- [ ] **Step 1: Commit**

```
git add skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/gold/
git commit -m "Add mobile-sdk-ios gold tree for add-msdk-default

Reference \"after\" files representing what a perfect agent run looks
like: Podfile with Salesforce specs source + SalesforceSDKCore pod,
AppDelegate with SDK init, SceneDelegate with AuthHelper wiring,
InitialViewController, bootconfig.plist, Info.plist with
SFDCOAuthLoginHost. Used by Gate 3 to validate the post-test hook
itself; not enforced as a diff at eval-runtime.

W-22453398"
```

---

## Phase 5 — Post-test hook

### Task 5.1: Author `post-test.ts` (env precheck only)

**Files:**
- Create: `skills-eval/domains/mobile-sdk-ios/hooks/post-test.ts`

- [ ] **Step 1: Write the env precheck phase**

Path: `skills-eval/domains/mobile-sdk-ios/hooks/post-test.ts`

```typescript
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
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit -p .
```

Expected: zero output, exit 0.

### Task 5.2 (GATE 3): Smoke-test post-test against the gold overlay

**Files:**
- Create (temp, do not commit): `/tmp/post-test-driver.mjs`

- [ ] **Step 1: Build the gold-overlay workspace**

```
TMPDIR=$(mktemp -d -t mobile-sdk-ios-gate3)
echo "TMPDIR=$TMPDIR"
cp -R skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/. "$TMPDIR/"
cp -R skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/gold/. "$TMPDIR/"
ls "$TMPDIR"
```

Expected: shows `MinApp.xcodeproj`, `MinApp/`, `Podfile`. The gold overlay added the SDK files and replaced AppDelegate, SceneDelegate, Info.plist.

- [ ] **Step 2: Write the driver**

```
cat > /tmp/post-test-driver.mjs <<'EOF'
import { resolve } from 'node:path';

const repoRoot = resolve(process.argv[2]);
const outputDir = resolve(process.argv[3]);

const ctx = {
  domainDir: resolve(repoRoot, 'skills-eval/domains/mobile-sdk-ios'),
  testCaseName: 'add-msdk-default',
  outputDir,
};

const mod = await import(`${ctx.domainDir}/hooks/post-test.ts`);
const results = await mod.default(ctx);
for (const r of results) {
  const tag = r.passed ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${r.name}: ${r.message}`);
}
const failed = results.filter((r) => !r.passed);
process.exit(failed.length > 0 ? 1 : 0);
EOF
```

- [ ] **Step 3: Run the driver**

```
npx tsx /tmp/post-test-driver.mjs . "$TMPDIR"
```

Expected: every result `[PASS]`. Exit code 0. The full sequence should be:

```
[PASS] env:xcode-cli: Xcode developer dir: /Applications/Xcode.app/...
[PASS] env:xcodebuild: Xcode 16 detected
[PASS] env:ios-simulator-runtime: N iOS simulator runtime(s) available
[PASS] env:cocoapods: CocoaPods x.y.z detected
[PASS] setup:pod-install: pod install succeeded
[PASS] compile:xcodebuild: BUILD SUCCEEDED
```

If `setup:pod-install` fails, the gold Podfile is wrong (e.g., spec source URL typo) — fix gold, re-run.
If `compile:xcodebuild` fails, the gold sources don't compile against `SalesforceSDKCore` — fix gold (likely a wrong API name), re-run.
If env checks fail, fix the local environment, not the hook.

- [ ] **Step 4: Clean up**

```
rm /tmp/post-test-driver.mjs
rm -rf "$TMPDIR"
```

### Task 5.3: Commit Phase 5

- [ ] **Step 1: Commit**

```
git add skills-eval/domains/mobile-sdk-ios/hooks/post-test.ts
git commit -m "Add mobile-sdk-ios post-test hook

Three sequential phases: env precheck (Xcode 16+, iOS sim runtime,
CocoaPods), pod install in ctx.outputDir, then xcodebuild build for
iOS Simulator with CODE_SIGNING_ALLOWED=NO. Each phase failure
short-circuits the rest, producing distinct QualityCheckResults so
LangSmith filters can attribute failures by stage. Verified against
the gold overlay (Gate 3) before checking in.

W-22453398"
```

---

## Phase 6 — Wire into package.json + README

### Task 6.1: Update package.json scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Read current scripts block**

```
sed -n '/"scripts"/,/}/p' package.json
```

- [ ] **Step 2: Replace the scripts block**

Edit `package.json` so the `"scripts"` block reads:

```json
  "scripts": {
    "eval:setup": "adk-eval --init",
    "eval:validate-env": "adk-eval --validate-env",
    "eval:download-vsix": "adk-eval --download-vsix",
    "eval:android:baseline": "adk-eval --domain mobile-sdk-android --protocol baseline",
    "eval:android:skill": "adk-eval --domain mobile-sdk-android --protocol skill",
    "eval:android:both": "npm run eval:android:baseline && npm run eval:android:skill",
    "eval:ios:baseline": "adk-eval --domain mobile-sdk-ios --protocol baseline",
    "eval:ios:skill": "adk-eval --domain mobile-sdk-ios --protocol skill",
    "eval:ios:both": "npm run eval:ios:baseline && npm run eval:ios:skill"
  },
```

- [ ] **Step 3: Verify the JSON parses**

```
node -e "console.log(Object.keys(require('./package.json').scripts))"
```

Expected: prints all 9 script names without throwing.

### Task 6.2: Update `skills-eval/README.md`

**Files:**
- Modify: `skills-eval/README.md`

- [ ] **Step 1: Update the "Domain layout" list (around line 13–25)**

Old:
```
- `mobile-sdk-android` — measures the **Add Mobile SDK** scenario inside
  the consolidated `skills/android-mobile-sdk` skill...
```

New:
```
- `mobile-sdk-android` — measures the **Add Mobile SDK** scenario inside
  the consolidated `skills/android-mobile-sdk` skill. It transforms an existing
  Kotlin Android app into one with Salesforce Mobile SDK authentication wired
  up. Pass/fail is `./gradlew assembleDebug` succeeding in the agent's
  output directory.

- `mobile-sdk-ios` — measures the **Add Mobile SDK** scenario inside the
  consolidated `skills/ios-mobile-sdk` skill. It transforms an existing
  CocoaPods-based iOS Swift app into one with Salesforce Mobile SDK
  authentication wired up. Pass/fail is `xcodebuild ... build` (iPhone
  simulator, Debug, `CODE_SIGNING_ALLOWED=NO`) succeeding in the agent's
  output directory.
```

- [ ] **Step 2: Update Section 0 (Setup) prerequisites**

After the existing Android prereqs block, add an iOS prereqs subsection:

```
**iOS prerequisites (only if running `eval:ios:*`)**

- Xcode 16+ with Command Line Tools (`xcode-select -p` must return a valid path)
- At least one available iOS simulator runtime (`xcrun simctl list runtimes`)
- CocoaPods (`pod --version`; install with `sudo gem install cocoapods`)
```

- [ ] **Step 3: Update the "Run the eval" block**

Old:
```
npm run eval:baseline   # agent without the skill loaded
npm run eval:skill      # agent with the skill loaded
npm run eval:both       # both, sequentially
```

New:
```
# Android domain
npm run eval:android:baseline   # agent without the skill loaded
npm run eval:android:skill      # agent with the skill loaded
npm run eval:android:both       # both, sequentially

# iOS domain
npm run eval:ios:baseline
npm run eval:ios:skill
npm run eval:ios:both
```

- [ ] **Step 4: Replace Recipe C with a finished, generic version**

Recipe C currently presents `mobile-sdk-ios` as hypothetical. Rewrite the section so it reads as a generic "bootstrap a new domain" guide with mobile-sdk-ios cited as the worked example.

Replace the current `### Recipe C: bootstrap a new domain (mobile-sdk-ios)` section with:

```
### Recipe C: bootstrap a new domain (e.g., a new platform)

Worked example: `mobile-sdk-ios`. The repo currently ships two domains
(`mobile-sdk-android` and `mobile-sdk-ios`) — when adding a third (e.g.,
`mobile-sdk-react-native`):

1. `cp -r skills-eval/domains/mobile-sdk-ios skills-eval/domains/<new-domain>`
2. Update `eval.config.json` `domain` and `expectedInvocations` names. The
   `expectedInvocations[0].name` field must match the **skill directory
   name** in `skills/`, not the domain name.
3. Replace `seed-data/` with the minimal buildable starting project for the
   new platform.
4. Replace `gold/` with the post-skill expected files.
5. Rewrite `hooks/post-test.ts`:
   - Replace the build invocation (e.g., `xcodebuild` → `npx react-native run-ios`).
   - Update env precheck for the new platform's tools.
6. Add scripts in the root `package.json`:
   `eval:<short-name>:baseline`, `eval:<short-name>:skill`, `eval:<short-name>:both`.
7. Add a row to the domain layout list at the top of this README.
8. Run **Gate 3** (overlay gold onto seed, run the post-test hook directly)
   before committing — if gold doesn't pass, the gold tree is wrong.
9. Iterate **Gate 5** (`npm run eval:<short-name>:skill`) until two
   consecutive green runs.
```

- [ ] **Step 5: Add a "What the `mobile-sdk-ios` domain evaluates" section after Section 1**

Insert as Section 2 (renumber subsequent sections accordingly):

```
## 2. What the `mobile-sdk-ios` domain evaluates

The skill modifies an existing CocoaPods-based iOS Swift app to integrate
Salesforce Mobile SDK: edits `Podfile`, `MinApp/AppDelegate.swift`,
`MinApp/SceneDelegate.swift`, `MinApp/Info.plist`; creates
`MinApp/InitialViewController.swift`, `MinApp/bootconfig.plist`. "Good"
means: the resulting workspace builds (`pod install` succeeds, then
`xcodebuild ... build` for the iOS Simulator succeeds).

The pass/fail signal lives in
`skills-eval/domains/mobile-sdk-ios/hooks/post-test.ts`. The gold tree is
for human reviewers and similarity scoring; it isn't enforced by the
post-test hook today.
```

- [ ] **Step 6: Add common-mistakes entry**

In the Section 6 "Common mistakes" list, add:

```
- **`expectedInvocations.name` mismatched with skill directory name** —
  the iOS skill is named `ios-mobile-sdk`, the Android skill is
  `android-mobile-sdk`. `expectedInvocations[0].name` in `eval.config.json`
  must match the skill directory name exactly, NOT the domain name.
- **Missing `CODE_SIGNING_ALLOWED=NO` for iOS builds** — the eval seed
  has no signing identity. The post-test hook always passes this flag;
  if you write a one-off script that calls `xcodebuild` against the seed
  outside the hook, you must too.
```

- [ ] **Step 7: Update LangSmith project guidance**

In Section 6 (or wherever `LANGCHAIN_PROJECT` is referenced), note that iOS evals should use a separate project: `LANGCHAIN_PROJECT=mobile-msdk-ios-evals` (or similar). The Android default in `.env.template` is `mobile-msdk-android-evals` — keep this Android-specific and call out the iOS override.

### Task 6.3 (GATE 4): Validate env

- [ ] **Step 1: Run validation**

```
npm run eval:validate-env
```

Expected: prints OK / no missing vars. If anything is missing, this is a local `.env` problem (the template is unchanged); fix `.env` and re-run. Do not modify `.env.template`.

### Task 6.4: Commit Phase 6

- [ ] **Step 1: Commit**

```
git add package.json skills-eval/README.md
git commit -m "Wire mobile-sdk-ios into package scripts and README

Renames eval:baseline/skill/both to eval:android:* and adds
eval:ios:baseline/skill/both. Updates skills-eval/README.md with the
mobile-sdk-ios domain entry, iOS prereqs (Xcode 16+, sim runtime,
CocoaPods), worked-example Recipe C, common-mistakes entries about
skill-name vs domain-name and CODE_SIGNING_ALLOWED=NO.

W-22453398"
```

---

## Phase 7 — GATE 5: iterate until green

This phase is a structured iteration loop, not a single task. **Do not commit a passing eval as the closing step until two consecutive green runs reproduce.**

### Task 7.1: Run the eval the first time

**Files:** none

- [ ] **Step 1: Set the iOS LangSmith project**

```
# In .env, ensure:
LANGCHAIN_PROJECT=mobile-msdk-ios-evals
```

(Override per-run with `LANGCHAIN_PROJECT=mobile-msdk-ios-evals npm run eval:ios:skill` if preferred.)

- [ ] **Step 2: Run**

```
npm run eval:ios:skill 2>&1 | tee /tmp/eval-ios-run-1.log
```

Expected: either green, or a specific failed `QualityCheckResult` plus a LangSmith run URL. Do not interpret transient warnings as failures — the official signal is the post-test results.

### Task 7.2: Iteration loop

For each failed run:

- [ ] **Step 1: Capture diagnostics**

Note in the iteration report:
- Which `QualityCheckResult` failed (`setup:pod-install`, `compile:xcodebuild`, etc.)
- Last 50 lines from the failed-result message.
- LangSmith run URL.

- [ ] **Step 2: Classify the failure**

Use this decision tree:

| Symptom | Class |
|---|---|
| Agent never invoked the `ios-mobile-sdk` skill | **Skill-invocation bug** (skill description / wording); see carve-out below |
| `pod install` failed: "Unable to find a specification for `SalesforceSDKCore`" | **Skill bug**: agent wrote wrong spec source URL |
| `pod install` failed: malformed Podfile syntax | **Skill bug**: agent's edit was bad OR **Seed bug** if seed Podfile was wrong |
| `xcodebuild` failed: "Cannot find type `SalesforceManager`" | **Skill bug**: agent didn't add the import |
| `xcodebuild` failed: "no such module SalesforceSDKCore" | **Build/integration bug**: pod was installed but framework not linked — investigate Podfile post_install or workspace config |
| `xcodebuild` failed: scheme not found / workspace not found | **Seed bug**: `MinApp.xcscheme` is not shared, or `MinApp.xcworkspace` was not produced (often a `pod install` issue masquerading as a build issue) |
| Env precheck failed | **Local env bug** — fix `.env` / install missing tool |

- [ ] **Step 3: Apply the fix or report**

For **Seed bugs** or **Gold bugs**: fix the file in this repo, commit immediately with a message like `Fix iOS eval seed: <one-line>`, re-run.

For **Skill bugs**: do **NOT** edit `skills/ios-mobile-sdk/SKILL.md` automatically. Document in the iteration report:
- File: `skills/ios-mobile-sdk/SKILL.md`
- Line(s) referenced
- What the wording said vs. what the agent produced
- Suggested rewording

If the eval can still complete (e.g., by tightening `prompt.md` to give more explicit guidance), apply that workaround and continue. Otherwise mark Gate 5 **blocked-on-skill-fix** and stop.

- [ ] **Step 4: Re-run**

```
npm run eval:ios:skill 2>&1 | tee /tmp/eval-ios-run-N.log
```

Continue the loop until the run is green.

### Task 7.3: Convergence — confirm flake-free green

- [ ] **Step 1: Run twice consecutively**

```
npm run eval:ios:skill 2>&1 | tee /tmp/eval-ios-final-1.log
npm run eval:ios:skill 2>&1 | tee /tmp/eval-ios-final-2.log
```

Expected: both runs pass with `compile:xcodebuild: BUILD SUCCEEDED`. If either fails, return to Task 7.2 — likely a flake (CocoaPods CDN, sim boot timing) or a non-deterministic skill output.

### Task 7.4: Commit any seed/gold/prompt fixes accrued during Gate 5

- [ ] **Step 1: Squash-commit any pending fix commits if needed, otherwise leave the per-fix commits as-is**

There is no specific commit at the end of Phase 7 — fix commits during the loop are committed in Task 7.2 step 3. Just ensure `git status` is clean before moving to Phase 8.

```
git status
```

Expected: `nothing to commit, working tree clean`.

---

## Phase 8 — GATE 6: validate against second model

### Task 8.1: Run with Claude 4.5 Sonnet

- [ ] **Step 1: Toggle the model in .env**

```
# In .env, set:
VIBES_MODEL=claude-45-sonnet
```

- [ ] **Step 2: Run**

```
npm run eval:ios:skill 2>&1 | tee /tmp/eval-ios-sonnet.log
```

Expected: green. If failures appear that didn't appear under GPT-5, classify per Task 7.2 and apply the same loop. Skill-bug carve-out still applies.

- [ ] **Step 3: Restore default model after testing**

```
# In .env, either unset VIBES_MODEL or set it back to whatever the user prefers.
```

### Task 8.2: No commit unless fixes were made

If Phase 8 surfaced bugs and produced commits, those should already be committed in the iteration loop. Otherwise nothing to do.

---

## Phase 9 — Memory entries and PR

### Task 9.1: Add project memory about CODE_SIGNING_ALLOWED=NO

**Files:**
- Create: `~/.claude/projects/-Users-ben-zhang-Work-github-forcedotcom-SalesforceMobileSDK-Templates/memory/ios_eval_codesigning.md`
- Modify: `~/.claude/projects/-Users-ben-zhang-Work-github-forcedotcom-SalesforceMobileSDK-Templates/memory/MEMORY.md`

- [ ] **Step 1: Write the memory file**

Path: `~/.claude/projects/-Users-ben-zhang-Work-github-forcedotcom-SalesforceMobileSDK-Templates/memory/ios_eval_codesigning.md`

```markdown
---
name: iOS eval seed needs CODE_SIGNING_ALLOWED=NO
description: Any xcodebuild against the mobile-sdk-ios eval seed must pass CODE_SIGNING_ALLOWED=NO; otherwise it aborts before compile.
type: project
---

The mobile-sdk-ios eval seed (`skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data/MinApp`) is committed without a signing identity to keep it minimal and prevent developer-account coupling.

**Why:** Adding a real signing identity would require either a hardcoded team ID (broken on every other dev's machine) or per-machine setup that the eval can't automate.

**How to apply:**
- The post-test hook in `skills-eval/domains/mobile-sdk-ios/hooks/post-test.ts` already passes `CODE_SIGNING_ALLOWED=NO` to `xcodebuild`.
- Any one-off command line that runs `xcodebuild` against the seed (e.g., manual Gate 1 verification, debugging) must include `CODE_SIGNING_ALLOWED=NO` or it will fail with "No signing certificate" before reaching compile.
- This applies to the seed only; the gold tree and the agent's runtime workspace inherit the same project settings.
```

- [ ] **Step 2: Add an index entry**

Append one line to `~/.claude/projects/-Users-ben-zhang-Work-github-forcedotcom-SalesforceMobileSDK-Templates/memory/MEMORY.md`:

```
- [iOS eval seed needs CODE_SIGNING_ALLOWED=NO](ios_eval_codesigning.md) — xcodebuild against the seed always needs this flag.
```

- [ ] **Step 3: No git operation**

Memory lives outside the repo (in `~/.claude/projects/...`), not in this worktree. Do not stage it.

### Task 9.2: Push branch and open PR

- [ ] **Step 1: Push**

```
git push -u origin worktree-W-22453398-mobile-sdk-ios-eval
```

- [ ] **Step 2: Open PR against `ben/W-22453398-eval-onboarding`**

```
gh pr create \
  --base ben/W-22453398-eval-onboarding \
  --head worktree-W-22453398-mobile-sdk-ios-eval \
  --title "Add mobile-sdk-ios eval domain (W-22453398)" \
  --body "$(cat <<'EOF'
## Summary

- Adds `skills-eval/domains/mobile-sdk-ios/` mirroring the existing `mobile-sdk-android` domain.
- Single dataset `add-msdk-default` covering the Add Mobile SDK scenario in `skills/ios-mobile-sdk` against a minimal CocoaPods iOS app.
- Pass/fail signal: env precheck (Xcode 16+, iOS simulator runtime, CocoaPods) → `pod install` → `xcodebuild -workspace MinApp.xcworkspace ... build` for iOS Simulator.
- `package.json`: renames `eval:baseline|skill|both` → `eval:android:*`, adds `eval:ios:*` siblings.
- `skills-eval/README.md`: domain table, iOS prereqs, worked-example Recipe C, common-mistakes entries.

## Spec / plan

- Spec: `docs/superpowers/specs/2026-05-19-mobile-sdk-ios-eval-domain-design.md`
- Plan: `docs/superpowers/plans/2026-05-19-mobile-sdk-ios-eval-domain.md`

## Verification

- [x] Gate 1: seed builds and boots in simulator (manual).
- [x] Gate 2: pre-test hook smoke test, no warnings.
- [x] Gate 3: post-test hook against gold overlay — all green.
- [x] Gate 4: `npm run eval:validate-env`.
- [x] Gate 5: two consecutive green `npm run eval:ios:skill` runs (GPT-5).
- [x] Gate 6: green `npm run eval:ios:skill` run with `VIBES_MODEL=claude-45-sonnet`.

## Test plan

- [ ] CI / reviewer: `npm install` then `npm run eval:ios:skill` after exporting required env vars; expect `compile:xcodebuild: BUILD SUCCEEDED`.
- [ ] Confirm Android domain still works: `npm run eval:android:skill`.
- [ ] Confirm `npm run eval:validate-env` still passes.

W-22453398
EOF
)"
```

- [ ] **Step 3: Capture PR URL**

`gh pr view --json url -q .url` — paste into the user-facing summary at end of session.

---

## Self-review

(Performed by plan author against the spec; documented here for the executing engineer's awareness.)

**Spec coverage:**
- Architecture (spec §"Architecture") → Phase 1–6 collectively create the directory structure.
- File-by-file design (spec §"File-by-file design") → Tasks 2.1, 2.2, 1.2/1.3/1.4, 4.1–4.6, 3.1, 5.1.
- Outside-the-domain edits (spec §"package.json", §"skills-eval/README.md") → Tasks 6.1, 6.2.
- Gate 1 → Task 1.6. Gate 2 → Task 3.2. Gate 3 → Task 5.2. Gate 4 → Task 6.3. Gate 5 → Phase 7 (Tasks 7.1–7.3). Gate 6 → Phase 8.
- Skill-bug carve-out → Task 7.2 step 3.
- Memory entry → Task 9.1.

**Placeholder scan:** No "TBD"/"TODO" placeholders in code blocks. Iteration loop in Phase 7 is intentionally procedure-driven because failure shapes are unknown — the deliverable is the procedure itself, not a pre-canned diff.

**Type consistency:** All `QualityCheckResult` names referenced in the plan (`env:xcode-cli`, `env:xcodebuild`, `env:ios-simulator-runtime`, `env:cocoapods`, `setup:pod-install`, `compile:xcodebuild`) are produced by the post-test code in Task 5.1, no drift. Hook export is `default async function` matching the Android domain's signature so adk-eval picks it up.
