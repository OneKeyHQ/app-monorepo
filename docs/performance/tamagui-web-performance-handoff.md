# Tamagui Web Performance Optimization Handoff

## Session

- Status: In progress
- Started: 2026-07-13 20:01 +08:00
- Last updated: 2026-07-14 00:32 +08:00
- Worktree: `D:\Project\app-monorepo-tamagui-analysis`
- Branch: `feat/tamagui-performance-analysis`
- Baseline commit: `71432893052f677abbda7d9a1a488397c91a4eee`
- Tamagui version: `1.108.0`
- Runtime scope: Web main JavaScript runtime. The same renderer-side risks may apply to Desktop and Extension, but they require separate baselines before rollout.
- Out of scope for this phase: React Native main/bg runtimes, native resources, wallet data flow, and a Tamagui version upgrade.

## Objective

Reduce Web Market-table viewport-resize jank and Tamagui runtime style-resolution cost, then enable measurable static style extraction in the default Rspack production build. The primary benchmark must keep the desktop shell stable and cross only a real list-column breakpoint; desktop/mobile shell replacement is tracked separately as a structural stress regression.

The work is split into five ordered workstreams:

1. Replace CSS-only `useMedia` decisions with responsive props and consolidate structural media decisions at layout boundaries.
2. Remove avoidable `useStyle`, `usePropsAndStyle`, and `useProps` resolution passes from hot component paths.
3. Provide a compiler-safe OneKey component entry that Tamagui can load without application side effects.
4. Add one shared `tamagui.build.ts` configuration and deterministic generated CSS output.
5. Integrate extraction into the default Web Rspack production build, then evaluate Desktop and Extension separately.

## Current Evidence

### Media fan-out

- Explicit `useMedia()` calls: 351 across 308 files.
- Package distribution: 317 in `packages/kit`, 34 in `packages/components`.
- Key usage: `gtMd` 225, `md` 85, `gtLg` 23, `gtSm` 20, `gtXl` 20, plus less frequent keys.
- The 768 px boundary flips both `md` and `gtMd` and replaces large parts of the page shell. It is therefore not a fair primary benchmark for list/style optimization and is retained only as a structural stress regression.
- Tamagui has one `matchMedia` listener per configured query, but subscriber callbacks are broadcast and every styled component internally participates in media handling. Key tracking can avoid some React updates but does not remove callback and resolution overhead.

### Corrected primary scenario: Market column resize

- Route: `/market`, normal trending token list, Web main JavaScript runtime.
- The page remains in `DesktopLayout` throughout the primary transition.
- `useColumnsDesktop()` reads only `gtLg` and `gtXl` for responsive column membership.
- Below 1024 px the normal list has 8 columns: star, name, price, 24h change, market cap, liquidity, turnover, and transactions.
- Crossing 1024 px adds `uniqueTraders`, producing an 8 -> 9 column transition.
- Crossing 1280 px adds `holders` and `tokenAge`, producing a 9 -> 11 column transition.
- `TableRow` is memoized, but each row receives the complete `columns` array. Rebuilding that array at a breakpoint invalidates the memoized prop for every rendered row and reconstructs its cells.
- Primary pair: control `984 <-> 1000` versus column transition `1016 <-> 1032`; both move 16 px and remain in the same desktop shell.
- Secondary pair: control `1240 <-> 1256` versus column transition `1272 <-> 1288`.
- The runner checks the unique visible `list-column-*` test IDs at both endpoints before timing. A count mismatch invalidates the run instead of silently measuring the wrong tab/category.

### Historical Home structural stress baseline

- Stable profile: `C:\Users\workboring\perf-profiles\web`.
- Web mode: wallet mode, persisted only in the dedicated profile via `$onekey_web_dapp_mode=wallet`.
- Account: public Ethereum watch-only address `0xF977814e90dA44bFA03b6295A0616a897441aceC`, named `Binance Hot Wallet 20 Perf`; no private key or recovery phrase was used.
- Job: `web-resize-home-production-baseline-v2-20260713`.
- Report: `development/perf-ci/output/web-resize-home-production-baseline-v2-20260713/report.json`.
- Method: uninstrumented production build, Service Worker and Cache Storage cleared without clearing wallet data, current bundle identity verified, extensions disabled during measurement, headless Chrome, three runs, four warmups and 20 measured transitions per scenario.

| Median-of-runs metric  | `control-gt-md` 780 <-> 850 | `cross-md` 760 <-> 780 | Cross/control ratio |
| ---------------------- | --------------------------: | ---------------------: | ------------------: |
| Settle median          |                    39.50 ms |              406.95 ms |              10.30x |
| Scripting              |                   367.36 ms |            6,336.18 ms |              17.25x |
| Recalculate style      |                    86.63 ms |            1,153.26 ms |              13.31x |
| Layout                 |                    49.75 ms |              249.04 ms |               5.01x |
| Long tasks             |                           0 |                     20 |                 n/a |
| Long-task total        |                        0 ms |               6,483 ms |                 n/a |
| Maximum frame          |                    17.30 ms |              416.60 ms |              24.08x |
| Dropped-frame estimate |                           0 |                    416 |                 n/a |
| Heap delta             |                   12.83 MiB |             153.66 MiB |              11.98x |

The original formal job was invalidated after its CPU trace loaded old instrumented `main~14` chunks while the disk build contained `main~11`. The persistent PWA Service Worker was serving stale cached assets. The runner now clears only `service_workers`, `cache_storage`, and the network cache, preserves localStorage/IndexedDB wallet state, and fails if the scripts in the page do not match the current disk `index.html`.

The v2 direction is consistent in all three runs and proves that the 768 px shell replacement is expensive. It must not be used as the comparison anchor for Market table/style work because the route and ownership are different. A clean three-run Market baseline is now required before retaining any new optimization.

### Style-resolution chain

- Observed hot chain: `createComponent -> useComponentState -> useThemeWithState -> useMedia -> useSplitStyles -> getSplitStyles -> propMapper/getStyleAtomic`.
- `createComponent` has a deep hook chain and `getSplitStyles` recomputes substantial per-render state.
- Existing caches are partial; there is no whole-result cache that makes repeated component resolution free.
- A clean 1,056 ms two-transition CPU window attributes self time to Tamagui helpers including the anonymous `getSplitStyles` body (43.97 ms), `mergeProps` (17.79 ms), `mergeStyle` (16.04 ms), `isValidStyleKey` (13.97 ms), `propMapper` (11.93 ms), `getStyleObject` (10.63 ms), and `useSplitStyles` (9.86 ms). DOM measurement/removal and React reconciliation remain material alongside style resolution.
- Project usage: `usePropsAndStyle` 19, `useStyle` 33, `useProps` 3.
- A global cache inside Tamagui is not the first intervention because the returned object also contains current children/viewProps and correctness depends on theme, media, pseudo, group, animation, component state, and prop state. A cache must separate reusable style computation from current render props rather than memoizing the complete result.

### Static extraction

- Web defaults to Rspack and its JavaScript rule currently has no Tamagui loader/plugin.
- The legacy Webpack configuration has `tamagui-loader`, with extraction disabled in development.
- Direct imports from `tamagui` extract in a minimal compiler experiment.
- Imports through `@onekeyhq/components/src/shared/tamagui` do not extract.
- Registering the full OneKey components package is not compiler-safe because loading the package traverses non-static application dependencies.
- Runtime atomic classes and CSS variables work today; component flattening, static prop removal, hook elimination, and generated external CSS are not broadly effective.
- A compiler-safe manifest containing only the public identity aliases `Stack`, `XStack`, `YStack`, `ZStack`, `View`, and `ThemeableStack` successfully loads and a standalone `PortfolioContainer` experiment reports five matches, three optimizations, and two flattened nodes.
- Broad Rspack extraction is not releasable: it produced 332 CSS files / 2.69 MiB and the app entered its caught unknown-error fallback.
- A Home Portfolio allowlist was functionally loadable and limited output to six CSS files / 102,958 bytes, but `cross-md` style recalculation rose from 1,153.26 ms to 5,331.49 ms (+362%), long tasks rose from 20 to 60, and total task time regressed 49%. Extraction must therefore include CSS rule deduplication/merging and enough flatten coverage to offset browser media-rule invalidation before it is reconsidered.

## Test Machine

- OS: Windows
- CPU: Intel Core i5-9400F, 6 cores / 6 logical processors
- Memory: approximately 16 GB
- Node: `v24.13.0`
- Yarn: `4.12.0`
- Primary browser: installed Google Chrome
- Secondary browser: installed Microsoft Edge

Because this machine has six logical processors, baseline and candidate runs must be made with unrelated browsers, IDE indexing, sync clients, and build jobs stopped. Power mode, browser version, browser profile, page data, and build mode must remain fixed.

## Reproduction And Pass Conditions

### Reproduction

1. Use a production Web build with the stable perf profile.
2. Open `/market` and wait for `__onekeyMarketListReadyCount > 0` plus the visible normal-list fixture.
3. Verify 8 columns at 1016 px and 9 columns at 1032 px.
4. Run the equal-distance `984 <-> 1000` control, then resize `1016 <-> 1032` 20 times.
5. Capture a Chrome performance trace and aggregate browser metrics across at least three runs.

### What Does Not Count As Passing

- Dev-mode profiling alone.
- A single run or a visually smoother result without trace data.
- Fewer explicit `useMedia` calls without lower resize CPU/long-task cost.
- Generated CSS existing without proof that a real OneKey component was flattened.
- Improved resize metrics accompanied by startup, bundle, visual, hydration, focus, or interaction regressions.

### Final Pass Condition

- At least three controlled runs with median aggregation.
- Primary Market column-resize scripting time improves by at least 10% for a retained change.
- Important secondary metrics do not regress by more than 5%.
- Results point in the same direction in at least two of three runs.
- Functional breakpoint, theme, focus, dialog, and scrolling checks pass.
- `yarn agent:check --profile commit` passes before commit.

## Baseline Procedure

Run from the analysis worktree:

```powershell
Set-Location D:\Project\app-monorepo-tamagui-analysis
yarn install --immutable
yarn perf:web:prepare --headed
$env:PERF_JOB_ID = 'tamagui-baseline-release'
yarn perf:web:release --headed
yarn perf:web:cold
```

The release runner performs three runs and median aggregation. Outputs are written below `development/perf-ci/output/<job-id>/`.

Preserve these artifacts for every accepted comparison:

- `report.json`
- `runs.json`
- `derived/`
- resize trace and summary JSON
- commit SHA, browser version, scenario, and run count
- initial JavaScript and CSS compressed sizes

## Dedicated Resize Benchmark

Implemented files:

- `development/perf-ci/run-web-resize-perf.js`
- `development/perf-ci/thresholds/web.resize.json`

Primary Market scenarios:

| Scenario            | Viewport transition | Expected visible columns | Purpose                                              |
| ------------------- | ------------------- | -----------------------: | ---------------------------------------------------- |
| `market-control-lg` | 984 <-> 1000        |                  8 <-> 8 | Equal-distance resize below the column breakpoint    |
| `market-cross-lg`   | 1016 <-> 1032       |                  8 <-> 9 | Primary single-column change                         |
| `market-control-xl` | 1240 <-> 1256       |                  9 <-> 9 | Equal-distance resize below the XL column breakpoint |
| `market-cross-xl`   | 1272 <-> 1288       |                 9 <-> 11 | Secondary two-column change                          |

Generic and structural regression scenarios:

| Scenario                | Viewport transition | Purpose                                      |
| ----------------------- | ------------------- | -------------------------------------------- |
| `control-gt-md`         | 780 <-> 850         | Historical Home resize without crossing 768  |
| `cross-md`              | 760 <-> 780         | Structural desktop/mobile shell stress only  |
| `all-width-breakpoints` | boundary +/- 8 px   | Validate 640, 768, 896, 1024, 1280, and 1536 |
| `cross-height`          | 812 <-> 828         | Validate the 820 px height media boundary    |

Primary metrics:

- resize settle duration
- main-thread scripting duration
- long-task count, total duration, and maximum duration
- style recalculation, layout, and paint duration
- maximum frame duration and dropped frames when available

Diagnostic metrics:

- `useMedia` callback activity
- `getSplitStyles` and related style-resolution samples
- React render/commit ownership in a profiling build

Regression guards:

- release Home metrics
- cold entry metrics
- initial JavaScript and CSS compressed size
- peak and ending JavaScript heap

## Experiment Rules

1. Make one targeted change per iteration.
2. Use the same production build path for baseline and candidate.
3. Run at least three times and compare medians; use five runs for the short resize microbenchmark when practical.
4. If median absolute deviation exceeds 10%, discard and rerun the experiment.
5. Retain a change only when the primary metric improves by at least 10% and important secondary metrics remain within 5% of baseline.
6. Document failed experiments and revert their code.
7. Do not combine a Tamagui dependency upgrade with extraction integration.
8. Do not patch `node_modules` or add a global `getSplitStyles` cache without a separate measured experiment and correctness model.

## Workstream Plan

### 1. Media subscriptions

- Produce an AST-backed inventory with file, line, key, component, usage category, and expected mount multiplier.
- Audit the ten unknown/broad uses first.
- Prioritize repeated Home/list components using `md` and `gtMd`.
- Convert style-only branches to Tamagui responsive props.
- Consolidate structural decisions in a parent layout and pass a stable layout variant to children.
- Change 10-20 call sites per batch and measure after each batch.

Target for the first retained batch on Market:

- at least 10% lower scripting time in `market-cross-lg`
- at least 20% lower cumulative long-task duration when the baseline contains long tasks
- fewer `TableRow`/column-cell renders in the profiling build
- no more than 5% regression in `market-control-lg`

### 2. Redundant style hooks

- Classify all 55 project calls as required bridge/plain-element resolution, double Tamagui resolution, static token lookup, or dynamic measurement.
- Start with repeated list/card primitives.
- Pass original responsive props directly to the final Tamagui component where possible.
- Hoist truly static definitions and only memoize after profiling demonstrates value.

Target:

- at least 20% lower cumulative `getSplitStyles` CPU in the target screen
- at least 30% fewer hot-path style-hook calls
- no more than 5% release/cold regression

### 3. Compiler-safe component entry

- Add a narrow entry that exports styled primitives and static variants only.
- Do not import routes, stores, wallet services, native modules, animation setup, or broad business barrels.
- Build the entry while preserving the form and metadata required by Tamagui 1.108.
- Add a fixture containing tokens and a `$gtMd` prop.
- Require compiler logs to show at least one optimized/flattened real OneKey component.

### 4. Shared Tamagui build configuration

- Add root `tamagui.build.ts` with config, components, generated CSS path, extraction mode, and diagnostics.
- Import generated CSS once from the Web entry.
- Keep extraction disabled in development during the initial rollout.
- Verify deterministic regeneration and CSS side-effect retention.

### 5. Rspack integration

- Start with the compiler fixture and reproduce the legacy Webpack loader options in an isolated Rspack spike.
- Verify loader order, source maps, compiler logs, and generated CSS processing.
- Expand in order: fixture, one Home module, full Web build.
- Baseline Desktop and Extension separately before applying the same integration.
- If the 1.108 loader is incompatible, evaluate CLI precompilation or a separately measured Tamagui upgrade.

## Functional Verification Matrix

- Widths: 639/640, 767/768, 895/896, 1023/1024, 1279/1280, 1535/1536.
- Heights: 819/820/821.
- Themes: light and dark.
- Inputs: mouse hover, no-hover, and coarse pointer where emulation is available.
- Interactions: keyboard focus, scrolling, dialog/popover open and close, and layout transitions.
- Rendering: screenshots before and after each boundary, hydration warnings, and style flashes.

## Iteration Log

### Iteration 0: Baseline and harness

- Status: Complete; infrastructure and the stable three-run Home baseline passed.
- Hypothesis: Existing release/cold tooling protects startup and bundle behavior, while a dedicated breakpoint-crossing trace is required to quantify the reported resize jank.
- Environment setup:
  - `yarn install --immutable` completed in 8 minutes 47 seconds with exit code 0.
  - The optional Windows Bluetooth native package `@stoprocent/bluetooth-hci-socket` failed to build. It is outside the Web renderer path and did not fail installation.
  - No existing `~/perf-profiles/web` or `~/perf-sessions` data was present.
- Stable profile preparation:
  - Installed browser control was used only to prepare the isolated perf profile.
  - Switched the Web build from its default dapp mode to wallet mode in that profile; the application source and ordinary browser profile were not changed.
  - Imported the public Ethereum address `0xF977814e90dA44bFA03b6295A0616a897441aceC` as a watch-only account named `Binance Hot Wallet 20 Perf`.
  - Home loaded a large portfolio and activity history, making this a substantially more representative stress fixture than the onboarding smoke.
- Infrastructure changes:
  - Added Windows Chrome and Edge discovery to the shared Chromium helper.
  - Made shared perf command execution invoke the repository Yarn release through Node on Windows, avoiding `.cmd` spawn failures with detached process trees.
  - Replaced Web production postbuild `cp`/`bash` steps with a cross-platform Node script.
  - Added `perf:web:resize`, resize metric aggregation, baseline comparison thresholds, tests, and documentation.
- Failed setup attempts:
  - `web-resize-smoke-20260713`: `spawn yarn ENOENT`; fixed by adding Windows Yarn resolution.
  - `web-resize-smoke-20260713-2`: `.cmd` plus detached spawn returned `EINVAL`; fixed by invoking `.yarn/releases/yarn-4.12.0.cjs` through Node.
  - `web-resize-smoke-20260713-3`: Rspack compiled successfully, then the Web package failed on Unix-only `cp`; fixed with `apps/web/scripts/postbuild.js`.
- Successful resize smoke:
  - Job: `web-resize-smoke-20260713-4`.
  - Mode: production build output, isolated temporary profile, extensions disabled, headless Chrome.
  - Scope: one run, two warmups, four measured transitions. This validates the harness and does not count as the Home baseline.
  - `control-gt-md` scripting: 95.119 ms; long tasks: 0; median settle: 80.45 ms.
  - `cross-md` scripting: 7519.998 ms; long tasks: 17 / 8207 ms total; median settle: 1818.95 ms.
  - The 768 px boundary reproduced severe fan-out even on the onboarding route, but the temporary route, one-run sample, and 154 console errors prevent using these values as an optimization baseline.
- Successful cold smoke:
  - Production build output, root scenario, one run, non-fatal budget mode.
  - FCP: 744 ms; first text: 731 ms; long tasks: 1651 ms total / 265 ms max / 12 count.
  - Initial JavaScript raw/gzip/Brotli: 6.11 MiB / 1.60 MiB / 1.30 MiB.
  - Existing budget misses: resource count 247/240, script count 197/175, decoded JavaScript 22.14/16.80 MiB, and initial raw JavaScript 6.11/6.00 MiB.
- Successful real Home resize baseline:
  - Provisional instrumented job: `web-resize-20260713-212600`. CPU sampling showed the function-hit logger itself consumed about 72 ms across two transitions, so this job is retained for diagnostics but is not the comparison anchor.
  - The first formal job `web-resize-home-production-baseline-20260713` was later invalidated because its persistent Service Worker served stale instrumented chunks.
  - Clean formal job: `web-resize-home-production-baseline-v2-20260713`.
  - The formal runner defaults `PERF_MONITOR_ENABLED` to off; diagnostics can opt in with `PERF_WEB_RESIZE_FUNCTION_MONITOR=1`.
  - Each run clears only PWA/network caches, verifies current disk bundle names, and preserves the watch-only wallet state.
  - Three runs, four warmups, 20 measured transitions, extensions disabled during measurement.
  - `control-gt-md`: scripting 367.36 ms; recalculate style 86.63 ms; long tasks 0; median settle 39.50 ms; heap delta 12.83 MiB.
  - `cross-md`: scripting 6,336.18 ms; recalculate style 1,153.26 ms; long tasks 20 / 6,483 ms total; median settle 406.95 ms; heap delta 153.66 MiB.
- Verification:
  - Eleven focused Jest tests pass across Chromium discovery, Windows command resolution, build identity, aggregation, and comparison logic.
  - Node syntax checks and `git diff --check` pass.
  - `yarn agent:check --profile commit` passes: worktree JavaScript lint, staged lint command, and staged TypeScript check are all green.
  - A complete Rspack production rebuild passed with the existing 72 warnings, and the cross-platform Node postbuild copied all expected files successfully.
- Baseline job: Complete for the Home structural stress case only. It remains the anchor for that historical case; the Market list comparison anchor is pending Iteration 3.
- Result: Harness validated and the reported breakpoint problem reproduced on a real, data-heavy Home screen. No production component has been optimized yet.

### Iteration 1: Media subscription boundary

- Status: Rejected and reverted.
- Job: `web-resize-home-media-boundary-candidate-20260713`.
- Change: Move the Home `md` subscription from `HomePageView` to the TabBar child; merge NavigationBar's two media subscriptions; remove one unused and two redundant Home media reads.
- Result: `cross-md` scripting improved from 6,336.18 ms to 6,038.21 ms (4.70%), below the 10% retention threshold. Control scripting regressed 3.36% and one control run contained a 33.2 ms maximum-frame outlier.
- Verdict: The direction supports shrinking media ownership, but this batch is too small to retain as a performance change.

### Iteration 2: Tamagui static extraction

- Status: Rejected and reverted.
- Broad experiment:
  - A compiler-safe six-primitive component manifest and a Base64URL Rspack adapter made real first-party flattening compile.
  - The build emitted 332 CSS files / 2.69 MiB and the application entered its caught unknown-error fallback before Home readiness.
- Home Portfolio allowlist:
  - Job: `web-resize-home-targeted-extraction-candidate-20260713`.
  - The app reached Home and CSS was limited to six files / 102,958 bytes.
  - `cross-md` scripting improved only 0.75% (6,288.48 ms), while recalculation rose 362% (5,331.49 ms), task duration rose 49% (12,615.13 ms), long-task total rose 75% (11,324 ms), and long-task count rose from 20 to 60.
- Verdict: Generated CSS alone is not proof of optimization. Per-chunk duplicated atomic/media rules can move work from JavaScript into more expensive browser style invalidation. Do not re-enable extraction until CSS is globally deduplicated/merged and flatten coverage plus functional semantics are measured together.

### Iteration 3: Benchmark correction to Market responsive columns

- Status: Harness and clean production baseline complete.
- Reason: The prior `760 <-> 780` Home case crosses the desktop/mobile ownership boundary and replaces the navigation, header, and content structure. It is useful as a worst-case regression but is not an accurate primary measure of list/Tamagui style work.
- Target: `/market`, normal trending token list, stable desktop shell.
- Primary scenario: `market-control-lg` (`984 <-> 1000`, 8 columns) versus `market-cross-lg` (`1016 <-> 1032`, 8 <-> 9 columns).
- Secondary scenario: `market-control-xl` (`1240 <-> 1256`, 9 columns) versus `market-cross-xl` (`1272 <-> 1288`, 9 <-> 11 columns).
- Fixture guard: Before trace collection, the harness enumerates unique visible `list-column-*` cells and fails if the expected endpoint counts do not match.
- Source evidence: `useColumnsDesktop()` reconstructs the full column array when `gtLg` or `gtXl` changes. The memoized `TableRow` receives that array, so all rendered rows receive a changed prop and rebuild their cell children.
- Compatibility: `PERF_WEB_RESIZE_TARGET=home` preserves the old Home benchmark explicitly; it is no longer the default.
- Smoke job: `web-resize-market-smoke-20260713`; the real fixture reported 50 rows and verified `8 -> 8` for the control plus `8 -> 9` for the primary transition.
- Formal baseline job: `web-resize-market-production-baseline-20260713`.
- Formal report: `development/perf-ci/output/web-resize-market-production-baseline-20260713/report.json`.
- Method: clean production build, current bundle identity verified, three runs, four warmups, 20 measured transitions, extensions disabled, headless Chrome.

| Median-of-runs metric  | `market-control-lg` 984 <-> 1000 | `market-cross-lg` 1016 <-> 1032 | Cross/control ratio |
| ---------------------- | -------------------------------: | ------------------------------: | ------------------: |
| Settle median          |                         45.40 ms |                       277.90 ms |               6.12x |
| Scripting              |                        384.52 ms |                     3,926.36 ms |              10.21x |
| Recalculate style      |                        158.09 ms |                       991.58 ms |               6.27x |
| Task duration          |                      1,046.22 ms |                     5,839.67 ms |               5.58x |
| Long tasks             |                                0 |                              23 |                 n/a |
| Long-task total        |                             0 ms |                        4,203 ms |                 n/a |
| Maximum frame          |                         33.30 ms |                       300.00 ms |               9.01x |
| Dropped-frame estimate |                                1 |                             265 |                265x |

- Per-run cross scripting was 3,886.02 / 3,957.68 / 3,926.36 ms, showing low variance and the same direction in all runs.
- All runs loaded 50 rows and had zero uncaught page errors. Repeated resource cancellation/404 console messages remain in the realistic workload; timings were nevertheless stable.
- CPU diagnostic job: `web-resize-market-clean-cpu-20260713`, two measured transitions with a 985.41 ms marked window.
- In that window the Tamagui bundle (`16428`) accounted for 439.65 ms self time (44.6% of the window), versus 118.07 ms in the React bundle. Leading Tamagui samples included the anonymous `getSplitStyles` body, `getStylesAtomic`, `useSplitStyles`, `resolveVariants`, `mergeProps`, `mergeStyle`, `resolveTokensAndVariants`, `normalizeStyle`, `isValidStyleKey`, and `useMedia`.
- Conclusion: the first candidate should stabilize column descriptor identity and prevent unchanged cells from rerendering. Keeping all responsive columns mounted is only acceptable if measurement proves that its extra DOM and style work is cheaper; it must not be assumed.

### Iteration 4: Stable descriptors and memoized table cells

- Status: Retained in the worktree; production comparison passed.
- Baseline: `web-resize-market-production-baseline-20260713`.
- Retained candidate: `web-resize-market-memo-cells-candidate-20260714`.
- Change:
  - Build all eligible Market column descriptors independently of `gtLg`/`gtXl`, then filter the returned descriptor list by the active breakpoint. Unchanged columns preserve object identity.
  - Extract the cell body from `TableRow` into `MemoTableCell`. When the breakpoint adds a column, the existing cells receive the same `column`, `item`, `index`, and skeleton props and skip reconstruction.
  - Continue mounting only the real 8, 9, or 11 visible columns. No hidden responsive cell trees are added to the DOM.

| Median-of-runs metric  | Baseline `market-cross-lg` | Retained candidate | Change |
| ---------------------- | -------------------------: | -----------------: | -----: |
| Settle median          |                  277.90 ms |          124.70 ms | -55.1% |
| Scripting              |                3,926.36 ms |          894.80 ms | -77.2% |
| Recalculate style      |                  991.58 ms |          903.81 ms |  -8.9% |
| Task duration          |                5,839.67 ms |        2,534.49 ms | -56.6% |
| Long tasks             |                         23 |                 10 | -56.5% |
| Long-task total        |                   4,203 ms |             644 ms | -84.7% |
| Maximum frame          |                  300.00 ms |          100.10 ms | -66.6% |
| Dropped-frame estimate |                        265 |                 79 | -70.2% |

- The equal-distance control also improved: scripting 384.52 -> 325.52 ms (-15.3%), task duration -18.9%, recalculation -10.5%, layout -7.4%, and maximum frame 33.3 -> 17.6 ms. Candidate cross-layout time changed by +0.8%, inside the 5% guard.
- The comparison runner reported no triggered thresholds. The primary scripting improvement exceeded the 10% retention requirement and all configured guards passed.
- Secondary XL job: `web-resize-market-memo-cells-xl-20260714`. All three runs verified 9 -> 11 columns. `market-cross-xl` scripting was 1,190.13 ms, with 10 long tasks / 986 ms total and a 116.7 ms maximum frame. There is no clean pre-change XL baseline, so this is functional/stress evidence, not a before/after claim.
- Cold Market run used the same production candidate build. Median FCP was 904 ms, business/list readiness 3,711 ms, and long-task total 1,662 ms; all configured cold and initial-bundle budgets passed. There is no clean pre-change Market cold baseline, so this only rules out a gross budget regression.
- Functional production checks verified exact 8 -> 9 column counts, 0 px maximum header/row alignment difference, no horizontal overflow at either endpoint, and token-name navigation to the expected `/market/token/...` route. The destination detail screen then emitted account/network-context errors, so the list click-through chain passed but the detail screen is not claimed as a full end-to-end pass.

Rejected alternatives:

1. `web-resize-market-stable-columns-candidate-20260713` kept all 11 columns mounted and used Tamagui responsive visibility. Cross scripting regressed 24.3%, recalculation 20.2%, long-task total 37.3%, and maximum frame 22.2%. Reverted.
2. `web-resize-market-native-css-columns-candidate-20260713` kept all 11 columns mounted and used native CSS media classes. Cross scripting regressed 26.7%, recalculation 32.5%, layout 185.9%, long-task total 63.1%, and maximum frame 61.1%. Reverted.

Verdict: Stable object identity plus memoized unchanged cells is substantially cheaper than keeping hidden cell trees mounted. The remaining cross-LG cost is now dominated more by style recalculation for the newly inserted column and surrounding responsive system than by rebuilding all existing cell content.

## Current Next Actions

1. Complete the final focused tests, `agent:check`, and diff review for the retained descriptor/cell change; do not commit until explicitly requested.
2. Add React Profiler or development-only render counters in a separate diagnostic build to quantify skipped existing-cell renders. Do not ship the instrumentation.
3. Capture a clean pre-change XL baseline only if the 1280 px transition becomes a release gate; the current XL run proves function and stress behavior but not improvement.
4. Verify sorting plus keyboard focus on the Market list. The existing production check covers column counts, alignment, horizontal overflow, and click routing.
5. Treat `cross-md` as a separate structural project for `TabPageHeader` and `NavigationBar`; do not combine it with Market list iterations.
6. Build an offline extraction prototype that emits one globally deduplicated stylesheet and a manifest of flattened source locations. Do not integrate it until it proves lower style recalculation on the corrected Market benchmark.
7. If pursuing Tamagui caching, split cacheable style computation from current `viewProps`/children and key it on theme, exact media keys, pseudo/group/animation/component state, and prop values. Add upstream-level correctness tests before benchmarking.

## Handoff Checklist

When another engineer or agent continues this work:

1. Read this document and `CLAUDE.md`.
2. Confirm the worktree, branch, and clean Git status.
3. Do not modify application components until Iteration 0 has a recorded baseline.
4. Continue the iteration log with job IDs, session IDs, median metrics, deltas, verdict, and retained/reverted status.
5. Run `yarn agent:check --profile commit` before committing retained changes.
