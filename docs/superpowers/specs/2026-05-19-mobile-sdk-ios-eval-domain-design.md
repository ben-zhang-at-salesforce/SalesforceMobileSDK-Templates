# Add `mobile-sdk-ios` eval domain — design

- **Status:** approved, ready for implementation plan
- **Date:** 2026-05-19
- **Branch:** `ben/W-22453398-eval-onboarding`
- **Work item:** W-22453398
- **Related skill:** `skills/ios-mobile-sdk/SKILL.md`
- **Reference domain:** `skills-eval/domains/mobile-sdk-android/`

## Goal

Stand up an evaluation domain (`mobile-sdk-ios`) that mirrors the existing
`mobile-sdk-android` domain so we can score the **Add Mobile SDK to an
existing iOS Swift app** path in the consolidated `ios-mobile-sdk` skill the
same way we score the Android equivalent. Pass/fail signal is whether the
agent's transformed iOS project compiles via `xcodebuild build` for the iOS
Simulator.

## Non-goals

- The skill's other scenarios (Create New App via xcodegen, SmartStore,
  MobileSync, Biometric Auth) — out of scope for the first iOS eval; each
  earns its own dataset later.
- The skill's Swift Package Manager path. The seed commits to CocoaPods
  because the canonical iOS template (`iOSNativeSwiftTemplate`) ships with
  CocoaPods and the iOS SDK repo's podspecs/`mobilesdk_pods.rb` are the
  canonical install surface. SPM is a future case.
- Booting the simulator, launching the app, or attempting a real Salesforce
  login. The post-test stops at compile.
- Editing `skills/ios-mobile-sdk/SKILL.md` opportunistically. The skill is
  the unit under test; if the eval surfaces a skill-wording bug, it is
  reported and parked for explicit human approval.

## Architecture

A new sibling domain under `skills-eval/domains/`, parallel to the existing
Android domain. No shared utility module — both hooks are self-contained, and
the toolchains (gradle vs xcodebuild) are too different for premature
abstraction. If a third domain shows up later, that is the time to extract.

```
skills-eval/
├── domains/
│   ├── mobile-sdk-android/                 # unchanged
│   └── mobile-sdk-ios/                     # NEW
│       ├── eval.config.json
│       ├── hooks/
│       │   ├── pre-test.ts
│       │   └── post-test.ts
│       └── datasets/
│           └── add-msdk-default/
│               ├── prompt.md
│               ├── seed-data/              # bare iOS app, CocoaPods, no MSDK
│               └── gold/                   # post-skill expected files
```

Outside-the-domain edits:

1. `package.json` — rename `eval:baseline|skill|both` to `eval:android:*` and
   add `eval:ios:*` siblings.
2. `skills-eval/README.md` — domain table, Setup section iOS prereqs, new
   "What the `mobile-sdk-ios` domain evaluates" section, Recipe C cleanup,
   common-mistakes entry on `expectedInvocations` skill-name vs domain-name.
3. `.env.template` — no changes (paths are domain-agnostic).
4. `skills-eval/vitest.config.ts` — no changes.

## File-by-file design

### `skills-eval/domains/mobile-sdk-ios/eval.config.json`

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

### `datasets/add-msdk-default/prompt.md`

```
Add the Salesforce Mobile SDK to this iOS Swift app.

- App target: MinApp
- Consumer Key: 3MVG9_PLACEHOLDER_CONSUMER_KEY
- Callback URL: msdkapp://oauth/success
- Login host: https://login.salesforce.com
```

Mirrors the Android prompt. Provides the four prerequisites the iOS skill's
"Add Mobile SDK" section asks for (target name, consumer key, callback URL,
login host) so the agent does not need to ask follow-up questions.

### `datasets/add-msdk-default/seed-data/`

Hand-crafted minimal Xcode project. Naming is `MinApp` / bundle ID
`com.example.minapp` to match the Android seed.

| File | Purpose |
|---|---|
| `Podfile` | `platform :ios, '18.0'`; `target 'MinApp' do; use_frameworks!; end`. **No** `pod 'SalesforceSDKCore'` and **no** Salesforce specs source — those are added by the skill. |
| `MinApp.xcodeproj/project.pbxproj` | Single iOS app target. Bundle ID `com.example.minapp`. Deployment target 18.0. Code-signing style Manual, empty cert / team — `CODE_SIGNING_ALLOWED=NO` is forced at build time, so this is fine. Sources: `AppDelegate.swift`, `SceneDelegate.swift`, `LaunchScreen.storyboard`, `Info.plist`. |
| `MinApp.xcodeproj/xcshareddata/xcschemes/MinApp.xcscheme` | Shared scheme so `xcodebuild -scheme MinApp` works headlessly. |
| `MinApp/AppDelegate.swift` | Bare `@UIApplicationMain` AppDelegate, scene-based, no MSDK imports. |
| `MinApp/SceneDelegate.swift` | Bare `UIWindowSceneDelegate` showing an empty `UIViewController`. |
| `MinApp/LaunchScreen.storyboard` | Same content as the storyboard quoted in `SKILL.md` "Create New App" → Step 1. |
| `MinApp/Info.plist` | `CFBundleIdentifier=com.example.minapp`, `UILaunchStoryboardName=LaunchScreen`, scene manifest pointing at `SceneDelegate`. **No** `SFDCOAuthLoginHost` — the skill adds it. |

The seed must build green via `xcodebuild -project MinApp.xcodeproj -scheme
MinApp -sdk iphonesimulator ... build` **before** any `pod install` runs.
That is the load-bearing pre-commit gate (Gate 1 below).

### `datasets/add-msdk-default/gold/`

Reference "after" files for human review and similarity scoring. Not
enforced by the post-test hook — the post-test only enforces that the
agent's transformed project compiles. Mirrors `SKILL.md` Steps 3–7:

- `Podfile` — adds `source 'https://github.com/forcedotcom/SalesforceMobileSDK-iOS-Specs'`, adds `pod 'SalesforceSDKCore'`, adds `post_install` block setting `IPHONEOS_DEPLOYMENT_TARGET=18.0`.
- `MinApp/AppDelegate.swift` — adds `import SalesforceSDKCore`, adds `override init() { super.init(); SalesforceManager.initializeSDK() }`.
- `MinApp/SceneDelegate.swift` — `import SalesforceSDKCore`, adds `AuthHelper.registerBlock(...)` in `scene(_:willConnectTo:options:)`, `AuthHelper.loginIfRequired { ... }` in `sceneWillEnterForeground(_:)`, plus the `initializeAppViewState` / `setupRootViewController` / `resetViewState` helpers from the SKILL.
- `MinApp/InitialViewController.swift` — bare `class InitialViewController: UIViewController {}`.
- `MinApp/bootconfig.plist` — `remoteAccessConsumerKey`, `oauthRedirectURI`, `shouldAuthenticate=true`.
- `MinApp/Info.plist` — adds `SFDCOAuthLoginHost=login.salesforce.com`.

The gold tree is overlaid onto `seed-data/` to produce a "what a perfect
agent run looks like" workspace; that overlay must pass the post-test hook
(Gate 3 below) before the gold tree is checked in.

### `hooks/pre-test.ts`

Direct port of Android's pre-test hook. Logs ctx, warns on missing seed
files and missing prompt keywords. Warnings only, never fails the run.

```ts
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
```

### `hooks/post-test.ts`

Authoritative pass/fail. Three sequential phases; failure of any phase
short-circuits the rest (matches Android's `if (results.some(!passed))
return`).

**Phase 1 — env precheck.** Each is its own `QualityCheckResult` so failures
are individually attributable in LangSmith.

| Check | Probe | Pass condition |
|---|---|---|
| `env:xcode-cli` | `xcode-select -p` | exit 0, stdout is an existing path |
| `env:xcodebuild` | `xcodebuild -version` | parses `Xcode (\d+)` and version ≥ 16 |
| `env:ios-simulator-runtime` | `xcrun simctl list runtimes -j` | JSON has at least one `com.apple.CoreSimulator.SimRuntime.iOS-*` entry with `isAvailable=true` |
| `env:cocoapods` | `pod --version` | exit 0 |

**Phase 2 — `pod install`.** Runs in `ctx.outputDir`. 5-minute timeout.
Captures combined stdout+stderr; on non-zero exit, fails
`setup:pod-install` with last 50 lines attached. Separated from the build
phase so failures attributable to dependency resolution (e.g., agent wrote
the wrong spec source URL) are distinguishable from compile failures.

Hard preconditions checked before invocation:

- `ctx.outputDir` is defined.
- `Podfile` exists in `ctx.outputDir`.

**Phase 3 — `xcodebuild build`.** Runs in `ctx.outputDir`, 10-minute timeout
(matches Android's gradle timeout). Command:

```
xcodebuild \
  -workspace MinApp.xcworkspace \
  -scheme MinApp \
  -sdk iphonesimulator \
  -destination 'generic/platform=iOS Simulator' \
  -configuration Debug \
  CODE_SIGNING_ALLOWED=NO \
  build
```

`CODE_SIGNING_ALLOWED=NO` is required because the seed has no signing
identity; without it, `xcodebuild` aborts before compilation. This is a
non-obvious build flag and is captured as a project memory entry post-ship.

Hard precondition: `MinApp.xcworkspace` exists in `ctx.outputDir` after Phase
2 — otherwise CocoaPods didn't produce a workspace and `xcodebuild
-workspace` would fail with a confusing "workspace does not exist" error.

Reports `compile:xcodebuild` pass/fail with last 50 lines on failure.

## `package.json` script changes

Before:

```json
"eval:baseline": "adk-eval --domain mobile-sdk-android --protocol baseline",
"eval:skill":    "adk-eval --domain mobile-sdk-android --protocol skill",
"eval:both":     "npm run eval:baseline && npm run eval:skill"
```

After:

```json
"eval:android:baseline": "adk-eval --domain mobile-sdk-android --protocol baseline",
"eval:android:skill":    "adk-eval --domain mobile-sdk-android --protocol skill",
"eval:android:both":     "npm run eval:android:baseline && npm run eval:android:skill",
"eval:ios:baseline":     "adk-eval --domain mobile-sdk-ios --protocol baseline",
"eval:ios:skill":        "adk-eval --domain mobile-sdk-ios --protocol skill",
"eval:ios:both":         "npm run eval:ios:baseline && npm run eval:ios:skill"
```

The setup/diagnostic scripts (`eval:setup`, `eval:validate-env`,
`eval:download-vsix`) are domain-agnostic — leave alone. No backwards-compat
aliases for the renamed scripts: the only existing caller is
`skills-eval/README.md`, updated in the same commit.

## `skills-eval/README.md` updates

1. **Domain layout table.** Add `mobile-sdk-ios` row: "measures the **Add
   Mobile SDK** scenario inside `skills/ios-mobile-sdk`. Pass/fail is
   `xcodebuild ... build` succeeding in the agent's output directory."
2. **Section 0 (Setup).** Add iOS prerequisites subsection (Xcode 16+, iOS
   Simulator runtime, CocoaPods). Update the "Run the eval" block to show
   both `npm run eval:android:skill` and `npm run eval:ios:skill`. Update
   any reference to `npm run eval:baseline` / `eval:skill` / `eval:both` to
   the renamed `eval:android:*` form.
3. **New Section 8: "What the `mobile-sdk-ios` domain evaluates".** Same
   prose template as Section 1 but for iOS: lists what files the skill
   modifies/creates, defines "Good" as `xcodebuild ... build` succeeding.
4. **Recipe C.** Currently "bootstrap a new domain (mobile-sdk-ios)" as a
   hypothetical. Rewrite as "Recipe C: bootstrap a new domain (e.g., a new
   platform)" with `mobile-sdk-ios` as a worked-example footnote.
5. **Common mistakes.** Add: "iOS skill is named `ios-mobile-sdk`, Android
   skill is `android-mobile-sdk` — `expectedInvocations.name` in
   `eval.config.json` must match the **skill directory name**, not the
   domain name."

## Verification gates

Each gate must pass before moving to the next.

### Gate 1 — Seed boots in simulator (manual)

After seed-data files are generated, before any hooks are written, the
human (Ben) verifies locally:

```
cd skills-eval/domains/mobile-sdk-ios/datasets/add-msdk-default/seed-data
xcodebuild -project MinApp.xcodeproj -scheme MinApp \
  -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
  -configuration Debug CODE_SIGNING_ALLOWED=NO build
open -a Simulator
xcrun simctl install booted <DerivedData>/.../MinApp.app
xcrun simctl launch booted com.example.minapp
```

Confirms an empty UIViewController renders. The seed cannot be committed
until this passes — the README explicitly warns that an unbuildable seed
poisons every downstream eval run.

### Gate 2 — Pre-test hook smoke test

With the seed in place, run pre-test.ts against a synthetic
`PreTestHookContext`:

```
domainDir = <repo>/skills-eval/domains/mobile-sdk-ios
testCaseName = 'add-msdk-default'
prompt = <contents of datasets/add-msdk-default/prompt.md>
```

Expectation: prints `[mobile-sdk-ios:preTest] add-msdk-default ready`, zero
warnings. Any warning indicates the seed file list or prompt has drifted
from the hook's required-keywords list.

### Gate 3 — Post-test hook smoke test against gold tree

Overlay gold/ onto seed-data/ in a temp dir, run post-test.ts with
`ctx.outputDir` pointing at that dir.

```
TMP=$(mktemp -d)
cp -R seed-data/. "$TMP/"
cp -R gold/. "$TMP/"
node --experimental-strip-types ./driver.ts  # invokes post-test.ts
```

Expectation: all `QualityCheckResult`s pass — env precheck, `setup:pod-install`,
`compile:xcodebuild`. If gold doesn't pass the same check the agent's output
will be graded against, gold is wrong and must be fixed before checking
either gold or the hook in.

### Gate 4 — `npm run eval:validate-env`

Existing script. Confirms `.env` has all required values populated.

### Gate 5 — Iterate `npm run eval:ios:skill` until green

This is **not** a one-shot pass. Each failure is a diagnose-then-fix-then-rerun
cycle. For each iteration the agent reports:

1. **What failed** — which `QualityCheckResult` (`setup:pod-install`,
   `compile:xcodebuild`) and the relevant tail of build output and the
   LangSmith run URL.
2. **Diagnosis** — root cause classified into one of three buckets:
   - **Seed bug** — the seed-data was incomplete or invalid.
   - **Gold bug** — the gold tree, overlaid on the seed, doesn't compile.
   - **Skill bug** — the skill's wording led the agent to produce wrong
     output even when followed literally.
3. **Fix** — exact diff. One file change per iteration when possible.
4. **Re-run** — `npm run eval:ios:skill` again, report next result.

**Skill-bug carve-out.** The skill is the unit under test, not part of the
harness. If a failure is clearly a skill-wording problem, the agent:

- Documents the issue in the iteration report (file, line, what's
  misleading, what the agent produced).
- **Does not edit `skills/ios-mobile-sdk/SKILL.md`** until the human
  explicitly approves.
- If a workaround in `prompt.md` or `seed-data/` lets the eval still
  complete, applies it; otherwise marks Gate 5 blocked-on-skill-fix and
  stops.

**Convergence.** Gate 5 is done when the same green run reproduces twice
consecutively (rules out flakes from CocoaPods CDN sync or sim runtime hiccups).

### Gate 6 — Validate against both Vibes models

Per `skills-eval/README.md` Section 0: re-run `npm run eval:ios:skill` with
`VIBES_MODEL` toggled between GPT-5 (default, unset) and Claude 4.5 Sonnet
(`VIBES_MODEL=claude-45-sonnet`). Both must pass before considering the
work shipped.

## Risks / open questions

- **Hand-crafted `project.pbxproj` is brittle.** A wrong UUID, missing
  PBXBuildFile entry, or mis-shaped scheme breaks `xcodebuild` with cryptic
  errors. Mitigation: generate it once via a real Xcode session, copy the
  resulting files into the seed. If this proves too fragile in practice,
  fall back to xcodegen at pre-test time. Try the static approach first.
- **CocoaPods spec sync time.** First `pod install` on a fresh machine
  downloads the entire CocoaPods specs CDN repo — minutes, not seconds.
  Acceptable: same one-time cost Android pays for gradle/maven caches.
- **Xcode version drift.** Pinning to Xcode 16+ is reasonable for
  deployment target 18.0 today. Any future bump in MSDK's iOS minimum
  needs the seed updated in lockstep.

## Memory entries to add post-ship

- **Project memory (or feedback):** `xcodebuild` against the eval seed
  requires `CODE_SIGNING_ALLOWED=NO` because the seed has no signing
  identity. Reason: keeps the seed minimal and avoids developer-account
  coupling. How to apply: any future iOS-eval post-test that runs
  `xcodebuild build` must include this flag.

## Implementation sequencing

The implementation plan (next: writing-plans skill) will sequence work as:

1. Set up git worktree for the iOS-eval branch (per user request).
2. Generate the seed-data Xcode project; pause for **Gate 1** (manual
   simulator verification by the user).
3. Author `eval.config.json` and `prompt.md`.
4. Author `pre-test.ts`; run **Gate 2** smoke test.
5. Author the gold tree by hand (mirror of the SKILL's Steps 3–7).
6. Author `post-test.ts`; run **Gate 3** smoke test (post-test passes
   against gold-overlay).
7. Update `package.json` and `skills-eval/README.md`.
8. Run **Gate 4** (`npm run eval:validate-env`).
9. Iterate **Gate 5** until two consecutive green runs.
10. Run **Gate 6** (toggle `VIBES_MODEL`).
11. Add memory entries.
12. Commit, push, open PR.
