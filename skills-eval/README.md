# Skills Eval Suite

This directory hosts evaluation domains for the agent skills shipped from this
repo's `skills/` directory. Each domain measures whether a target skill
produces the right output when invoked by an agent. Pass/fail is decided by
the domain's `hooks/post-test.ts`.

This README is also the contributor guide — see the recipes and common
mistakes sections below for how to add domains, cases, or fix failing evals.

## Domain layout

Domains live under `skills-eval/domains/<domain-name>/`. Today there are two:

- `mobile-sdk-android` — measures the **Add Mobile SDK** scenario inside
  the consolidated `skills/android-mobile-sdk` skill. It transforms an existing
  Kotlin Android app into one with Salesforce Mobile SDK authentication wired
  up. Pass/fail is `./gradlew assembleDebug` succeeding in the agent's
  output directory.

- `mobile-sdk-ios` — measures the **Add Mobile SDK** scenario inside the
  consolidated `skills/ios-mobile-sdk` skill. It transforms an existing
  CocoaPods-based iOS Swift app into one with Salesforce Mobile SDK
  authentication wired up. Pass/fail is `xcodebuild ... build` (iPhone
  Simulator, Debug, `CODE_SIGNING_ALLOWED=NO`) succeeding in the agent's
  output directory.

A new domain is created by adding a sibling directory with the same shape:
`eval.config.json`, `hooks/{pre,post}-test.ts`, and one or more
`datasets/<case-name>/` directories each containing `prompt.md`, `seed-data/`,
and (optionally) `gold/`.

---

## 0. Setup (one-time)

**Prerequisites**

- Node 20+
- Salesforce org access: due to Agentforce vibe evals run's under einstein enable org.
  ```
  sf org login web --instance-url <url> --alias mobile-eval-org
  ```

**Android prerequisites (only if running `eval:android:*`)**

- JDK 17 (`java -version` should print 17.x)
- Android SDK with `compileSdk = 36` platform installed
  (`sdkmanager "platforms;android-36"`)
- `ANDROID_HOME` exported and pointing at the SDK

**iOS prerequisites (only if running `eval:ios:*`)**

- Xcode 16+ with Command Line Tools (`xcode-select -p` must return a valid path)
- At least one available iOS simulator runtime (`xcrun simctl list runtimes`)
- CocoaPods (`pod --version`; install with `sudo gem install cocoapods`)

**Install dependencies**

```
npm install
```

**Configure credentials**

```
cp .env.template .env
npm run eval:setup        # interactive wizard (recommended)
# or fill in .env manually using the comments
```

You'll need:

- **Einstein API key** — request via `#genai-nonprod-api-key-requests`
  on Slack, or have the ADK team share the 1Password "lightning-gpt" vault.
- **LangSmith API key** — see adk-core's
  `docs/public/core/eval/evals-langsmith-setup.md`.
- **Agentforce VS Code extension VSIX** — download with
  `npm run eval:download-vsix`.

**Tell adk-eval where this repo's skills, domains, and vitest config live.**
Set the following in `.env`:

- `VIBES_SKILLS_DIR` → absolute path to `<repo>/skills` (where `android-mobile-sdk/SKILL.md` and `ios-mobile-sdk/SKILL.md` live)
- `EVAL_DOMAINS_ROOT` → absolute path to `<repo>/skills-eval/domains`
- `EVAL_VITEST_CONFIG` → relative path `skills-eval/vitest.config.ts` (override; adk-eval's default is `eval/vitest.config.ts`)

Example, if you cloned this repo to `~/work/SalesforceMobileSDK-Templates`:

```
VIBES_SKILLS_DIR=/Users/yourname/work/SalesforceMobileSDK-Templates/skills
EVAL_DOMAINS_ROOT=/Users/yourname/work/SalesforceMobileSDK-Templates/skills-eval/domains
EVAL_VITEST_CONFIG=skills-eval/vitest.config.ts
```

**Verify the env**

```
npm run eval:validate-env
```

**Run the eval**

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

## Choosing the model

`npm run eval:android:skill` and `npm run eval:ios:skill` run against the
Vibes/AFV surface. The model used by the agent inside Vibes is selected by
`VIBES_MODEL` in `.env`:

- Unset / absent → default GPT-5
- `VIBES_MODEL=claude-45-sonnet` → Claude 4.5 Sonnet

Note: `EINSTEIN_MODEL` does NOT control the Vibes-surface model — it's used by
other ADK paths. Editing it has no effect on `npm run eval:android:skill` or
`npm run eval:ios:skill`.

When changing eval content (gold, seed, prompt, skill), validate against both
GPT-5 and Sonnet before considering the change shipped.

---

## 1. What the `mobile-sdk-android` domain evaluates

The skill modifies an existing Kotlin Android app to integrate Salesforce
Mobile SDK: edits `app/build.gradle.kts`, `AndroidManifest.xml`, and
`MainActivity.kt`; creates `MainApplication.kt`, `bootconfig.xml`,
`servers.xml`, and `strings.xml`. "Good" means: the resulting app builds
(`./gradlew assembleDebug` succeeds).

The pass/fail signal lives in `skills-eval/domains/mobile-sdk-android/hooks/post-test.ts`.
The gold tree is for human reviewers and similarity scoring; it isn't
the source of truth and is NOT enforced by the post-test hook today.

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

## 3. Anatomy of a case

Each case lives in `datasets/<case-name>/` and has these parts:

- **`prompt.md`** — user-voice utterance the agent receives. Include the
  five prerequisites the skill asks for (app package, main activity,
  consumer key, callback URL, login host) so the agent doesn't need to
  ask follow-up questions an automated eval can't answer.
- **`seed-data/`** — a buildable Android project copied into the agent's
  workspace before each run. The agent operates on it. The canonical
  minimal seed is in `datasets/add-msdk-default/seed-data/`. **Verify
  your seed builds before treating it as a fixture: `cd seed-data &&
  ./gradlew assembleDebug`.**
- **`gold/`** — reference "after" files for similarity scoring and human
  diff review. The post-test hook does not enforce gold-file matching —
  a build that passes but diverges from gold is still a pass.

When to add a case-specific check vs. extend the shared hook: if the
check applies to *all* cases for this skill, put it in `hooks/post-test.ts`.
If it's specific to one case (e.g., a sandbox-host case wants to verify
`servers.xml` contains `test.salesforce.com`), add a per-case override —
patterns for that are TBD until the second case lands.

## 4. Three concrete recipes

### Recipe A: vary the prompt only (e.g., sandbox login host)

1. `cp -r datasets/add-msdk-default datasets/add-msdk-sandbox`
2. Edit `datasets/add-msdk-sandbox/prompt.md` — change `Login host:` to
   `https://test.salesforce.com`.
3. Edit `datasets/add-msdk-sandbox/gold/.../servers.xml` — change the
   `url=` attribute to `https://test.salesforce.com`.
4. Run `npm run eval:android:skill` (or `eval:ios:skill`) and confirm
   the new case is picked up.
5. Commit.

### Recipe B: vary the starting project (e.g., app already has a custom Application)

1. `cp -r datasets/add-msdk-default datasets/add-msdk-existing-app-class`
2. Add a `MyApp.kt` to `seed-data/.../kotlin/...` and reference it in
   `seed-data/.../AndroidManifest.xml` via `android:name=".MyApp"`.
3. Decide what "correct skill behavior" means: does the skill replace
   `.MyApp`, or merge MSDK initialization into it? Update `gold/`
   accordingly.
4. **Verify the seed builds before checking in**:
   `cd seed-data && ./gradlew assembleDebug`.
5. If the case needs a check the shared hook doesn't have (e.g., "skill
   preserved the original `MyApp` class"), file a follow-up to add it
   to `hooks/post-test.ts`.
6. Commit.

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

## 5. Running locally

```
# Both protocols, default case (Android):
npm run eval:android:both

# Both protocols, default case (iOS):
npm run eval:ios:both

# Just the structural + build check, without launching Vibes
# (handy when iterating on the hook):
#   pending — adk-eval --hook-only is a feature request; for now,
#   the post-test hook only runs after a real eval pass.
```

## 6. Authoring the gold tree

Recommended workflow:

1. Run `npm run eval:android:skill` (or `eval:ios:skill`) once — this
   triggers the agent with the skill loaded.
2. Inspect the agent's output directory (path printed in the run log;
   typically under `eval/.runs/` or wherever `ctx.outputDir` points).
3. Copy the files the skill modified or created into `datasets/<case>/gold/`.
4. Sanity-diff against the existing gold tree if updating.

This is *seeding*, not validating. Don't trust the agent's output as
ground truth without reviewing it. The post-test hook is the validator.

## 7. Common mistakes

- **Committing `.env`** — never. `.gitignore` should already prevent it;
  if `git status` ever shows `.env`, stop and fix the gitignore.
- **Reusing someone else's `EINSTEIN_API_KEY`** — keys are per-user.
  Sharing them muddles attribution and breaks LangSmith filters.
- **LangSmith runs landing in the wrong project** — set
  `LANGCHAIN_PROJECT=mobile-msdk-android-evals` (Android) or
  `LANGCHAIN_PROJECT=mobile-msdk-ios-evals` (iOS) so your runs are
  filterable. The Android default lives in `.env.template`; override
  per-run for iOS, e.g.
  `LANGCHAIN_PROJECT=mobile-msdk-ios-evals npm run eval:ios:skill`.
- **`expectedInvocations.name` mismatched with skill directory name** —
  the iOS skill is named `ios-mobile-sdk`, the Android skill is
  `android-mobile-sdk`. `expectedInvocations[0].name` in `eval.config.json`
  must match the skill directory name exactly, NOT the domain name.
- **Missing `CODE_SIGNING_ALLOWED=NO` for iOS builds** — the iOS eval
  seed has no signing identity. The post-test hook always passes this
  flag; if you write a one-off script that calls `xcodebuild` against
  the seed outside the hook, you must too.
- **VSIX out of date** — re-run `npm run eval:download-vsix`
  periodically.
- **Forgetting to commit `gradle-wrapper.jar`** — without it, `gradlew`
  can't bootstrap on a fresh clone and the post-test hook fails with a
  confusing error.
- **Hardcoded paths in seed-data** — the seed is copied into a different
  workspace per run. Anything absolute breaks. Stick to relative paths
  or values like `applicationId = "com.example.minapp"`.
- **Gold files using a different package than the seed** — comparison
  fails on path mismatch even when the skill behaved correctly.
- **Mistaking environment failures for skill failures** — if
  `compile:assembleDebug` fails because `ANDROID_HOME` is unset, the
  skill is innocent. The env precheck should catch this; if it doesn't,
  fix the precheck.
- **Editing `EINSTEIN_MODEL` to switch Vibes-surface model** — wrong
  knob; use `VIBES_MODEL`.

## 8. Where to look when something's wrong

- **The LangSmith run** — `LANGCHAIN_PROJECT=mobile-msdk-android-evals`
  (Android) or `LANGCHAIN_PROJECT=mobile-msdk-ios-evals` (iOS) on the
  LangSmith dashboard. The full agent transcript and tool calls are there.
- **The captured build output** — the post-test hook attaches the last
  50 lines of build output to the `compile:assembleDebug` (Android) or
  `compile:xcodebuild` (iOS) assertion message. Check the failing
  assertion message in LangSmith.
- **Pre-test warnings in stdout** — `hooks/pre-test.ts` warns about
  missing seed files or prompt keywords. These are warnings, not
  failures, but they almost always foretell a downstream failure.
