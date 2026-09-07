# NativeList selector performance and validation

Measured on 2026-09-07. The account and network selectors use NativeList V2 while preserving the V1 components and existing route names/parameters. The four migrated lists are the wallet sidebar, accounts, all networks, and single networks.

The latest Desktop development-mode foreground samples sustain approximately 60 JS rAF FPS, with no unready avatar observations across the tested continuous-scroll matrix. **Native cold opening and first-scroll stalls remain above the frame budget.** Android main-thread profiling identifies repeated SWR cache serialization as a hotspot. Production Desktop avatar readiness now passes after repairing file-origin Worker startup; two account/wallet scrolling samples record approximately 120 JS rAF FPS, while opening/switching still exceeds the frame budget. Earlier URI-only pixel/persistence results are retained below with their original provenance.

## Implementation

- V2 account rows contain a stable `onekey-avatar://blockie/v1/<encoded lowercase seed>` URI. They no longer synchronously generate or transport PNG/Base64 avatars in list snapshots. The original seed precedence and 128 x 128 pixels are preserved.
- Wallet animal avatars retain their existing resource URIs. External-wallet logos retain their original image source, with numeric React Native assets resolved to a URI.
- iOS resolves the URI in the native image loader, with at most two generation jobs and a dedicated SDImageCache: 8 MiB / 128 memory entries, 32 MiB / 30 days on disk. Cleanup follows cache policy rather than a strict instantaneous disk bound.
- Android resolves it on the Glide source executor and stores the original PNG with `DiskCacheStrategy.DATA` in the existing shared disk LRU. Rendering sizes and other image cache policies are unchanged.
- Desktop/Web use an external Worker for generation, PNG validation, and IndexedDB persistence (32 MiB / 2048 entries, two concurrent jobs). The list thread receives Blob URL strings. The memory cache targets 128 total URLs; active leases are protected and may exceed that target.
- Requests are coalesced, canceled when no longer needed, and guarded against stale results after row reuse. Corrupted persisted avatar images are regenerated. Web pre-mount row patches are retained against the matching snapshot, including imperative snapshot replacement.
- The iOS index-bar gesture owns touches originating in the index rail; ordinary modal header dragging still dismisses the selector.

iOS and Android main/background JS runtimes have separate heaps. Avatar generation and caching use process-owned native image resources; PNG bytes are not copied into list snapshots or between those JS runtimes. Desktop app main/background code shares one JS thread; the avatar Worker has its own execution context. Extension UI/background runtimes remain separate and use the same Web image adapter; actual extension runtime validation is still open.

## Reuse boundaries

NativeList remains a reusable list implementation. Virtualization, index navigation,
row updates, image request scheduling, and reusable native cells belong to the
module. Other screens can reuse them by supplying the supported row descriptors
and stable keys/URIs; they do not need wallet services or the selector hooks.
The generated-avatar cache specifically handles the `onekey-avatar://blockie/v1/`
URI scheme. Ordinary image URLs continue through the existing image loaders.

Balance loading, fiat/DeFi aggregation, account formatting dependencies, and
enabled/missing-address network state belong to the selector business layer.
These optimizations benefit both selectors' supported platforms, but are not
generic list behavior. Existing selector-specific row presentations also remain
optional module templates rather than a requirement for other list consumers.

The `accSelList` cache namespace now retains at most three recently updated list
scopes and 6 Mi serialized characters in total, under the unchanged global
per-entry limit. A wallet/network/derive combination is one scope, not necessarily
one wallet. V1/V2 use the same keys and revalidate evicted entries through the
original service. Other namespaces retain their existing budgets. This bounds
cache capacity; it is not evidence that the previous memory sample was a leak.

## Follow-up: scheduling, avatar preparation, and bounded retention

The follow-up changes address four areas: repeated account-list work, duplicate network-selection work, avatar display waiting on disk operations, and retained account/group capacity. V1 components and existing route names/parameters remain available. Source provenance for this follow-up is `52fdb1bbee3681a5c9176d1aa9535905870edb40`; sample files retain their own capture timestamps. This source reference does not retroactively change the build provenance of older results.

| Patch used for the following native/development samples | SHA-256 |
| --- | --- |
| `@onekeyfe+react-native-native-list+3.0.105.patch` | `0648ad8087a9e092c1390c78942cccf9d40b0d09eccbc3237b6b34c8f948f5f1` |
| `@onekeyfe+react-native-image+3.0.105.patch` | `323181a9086abfc26a33e531333eeb8b341c765600128871bbcb759e24f36f08` |

### What changed and where it can be reused

| Area | Implemented behavior | Reuse and correctness boundary |
| --- | --- | --- |
| Account initialization | Compute each snapshot diff once; skip unchanged references/content; invalidate formatting for the affected account or changed shared formatting context. A V2 loader merges pending results and yields through rAF plus a subsequent task when its work budget is used. | Account V2 business code: `WalletDetailsV2.tsx`, `accountSelectorAccountRowsV2.ts`, `accountSelectorValueRowsV2.ts`, `useAccountSelectorValuesLoaderV2.ts`. The original service and shared values/DeFi atoms remain. It preserves account-selector `num`, wallet/network context, Perps aggregation, refresh values, cancellation and subsequent batches after a service failure. Other NativeList consumers do not automatically receive this business scheduler. |
| Network selection | Derive enabled networks in the same render as selection; remove the extra missing-address query trigger; memoize amount/image descriptors independently of checkboxes. | Network selector V2 code in `UnifiedNetworkSelectorV2.tsx` and `NetworksSectionListV2.tsx`. It still uses the existing enabled/missing-address hooks and ordinary NativeList selection events. Deltas update affected network IDs and preserve selections outside a filtered result; Apply/custom-network business APIs are unchanged. |
| Avatar preparation | Prioritize visible and forward-direction blockie requests; reuse pending generated bytes; return Blob URLs without awaiting persistence; use readonly cache reads with an 8 ms soft waiting budget and idle, bounded writes/touches. | Generic NativeList/image behavior for the existing `onekey-avatar://blockie/v1/` URI in supported image descriptors. Ordinary HTTP image URLs are not swept into this blockie prefetch path. No new public API is required. Native preload keeps at most one uncancelable request in flight and replaces pending work on direction changes; image patches update a sparse prefetch overlay rather than disabling future prefetch. |
| Retention | Apply a dedicated account-list SWR capacity budget and trim reusable native wallet-group members after safe reuse/rebind. | `accSelList:` is a selector-business namespace shared by V1/V2, not a global cache reduction. Native group pools are reusable module behavior: retain `max(8, current required members)` and protect compact drag proxies/expansion. These are capacity controls, not proof that a measured heap increase was a leak. |

In the controlled 1000-account test, the loader still makes 20 service requests of 50 accounts. Effective values/DeFi map publications decrease from 40 to 4; an identical refresh changes no values. These are state publications, not React commit counts. Slower service responses may legitimately cause more budgeted publications. The mounted network fixture (three network rows plus an asset header, initial render and one checkbox change) records missing-address calls 4→2, amount lookups 6→3, formatting 8→4, and leading-image construction 6→3. These call-count tests are not a device-speed benchmark.

The saved focused reports contain 18 passed account tests and 10 passed network tests. They cover formatting invalidation, same-reference updates, structural/cleared-field fallback, deferred patches, cancellation, context changes, filtered selections and money presentation. These saved reports were reviewed rather than rerun for this documentation update.

### Desktop: corrected foreground measurements

Desktop main/background business code shares the Electron renderer JS thread; the avatar Worker and Electron native/main processes are separate resources. These measurements use the Debug renderer. Each of the twelve steady samples records the owned Electron process as the system foreground application immediately before and after the sample. This is stronger than `page.bringToFront()` or `document.visibilityState`; it is still a before/after observation, not continuous system-focus telemetry.

Each list has three samples of four real CDP mouse-scroll legs, 1800 CSS px per leg at speed 1400. No CPU profiler, heap collection, or concurrent native build was used in these frame samples.

| List | Samples | Total rAF intervals | JS rAF FPS range | Worst sample P95 (ms) | Maximum (ms) | Intervals >25 ms | JS long tasks | Mounted rows at recorded checkpoints |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Accounts | 3 | 970 | 60.000–60.011 | 17.50 | 17.70 | 0 | 0 | 18 |
| Wallet sidebar | 3 | 959 | 60.000–60.005 | 17.60 | 17.80 | 0 | 0 | 14 |
| All networks | 3 | 973 | 59.996–60.004 | 17.60 | 17.70 | 0 | 0 | 21 |
| Single network | 3 | 971 | 59.998–60.008 | 17.60 | 17.70 | 0 | 0 | 24 |

The combined 3873 sampled intervals contain no >25 ms interval and no reported JS long task. This supports approximately 60 Hz steady renderer scheduling in these samples. It does not mean every interval was at most 16.67 ms, establish a 120 Hz budget, or directly measure compositor presentation. Mounted counts are checkpoints, not a continuous maximum.

The earlier `desktop-acceptance-final.json` is retained as a non-passing sample whose system foreground state was not verified: 48.632–54.112 rAF FPS across twelve samples, with 592 intervals over 25 ms despite zero JS long tasks. The similarly earlier avatar matrix recorded 40 unready row-frame observations across 14 sampled frames, involving five keys and five unready reentries. These are observed failures, not silently discarded data. The corrected foreground run supplies the accepted measurement condition; the evidence does not prove every earlier deviation was caused exclusively by focus.

Source: `evidence/perf-fixes/desktop-acceptance-front.json`; earlier boundary: `desktop-acceptance-final.json` and `desktop-avatar-matrix-final.json` in the same directory.

### Desktop: fresh-seed avatar visibility

Before this matrix, all 1000 avatar URI keys for each of six distinct fixture wallets were checked against the avatar store; every wallet had zero matching disk keys. Each wallet was then opened, its initial visible images were allowed to become ready, and the harness waited one second before scrolling. Therefore these are **fresh-seed/disk-cold at wallet entry** cases, not a claim that the initial viewport or every future row remained uncached at the instant scrolling began. Bounded prefetch is deliberately allowed to prepare future rows.

All six samples record the owned Electron PID as system foreground before and after the measurement. Four real CDP scroll legs are observed at every rAF; visible rows are checked for URI/image/paint-state readiness and internal gaps. This geometry instrumentation is separate from FPS acceptance.

| Speed (CSS px/s) | Runs | Sampled frames per run | Total frames | Unready row-frame observations | Unready reentries | Internal gaps / errors |
| --- | ---: | --- | ---: | ---: | ---: | --- |
| 1200 | 3 | 1090 / 1091 / 1093 | 3274 | 0 | 0 | 0 / 0 |
| 6500 | 3 | 681 / 681 / 682 | 2044 | 0 | 0 | 0 / 0 |

Across 5318 sampled frames, unready sampled frames, unique unready keys, already-ready-to-unready transitions, unready reentries, internal gaps and image errors are all zero. This replaces the earlier unresolved continuous-scroll result for this tested foreground matrix. It is not a guarantee of zero latency for arbitrary cold index jumps, every scroll speed, or unrecorded transient compositor frames. DOM/image-state observations are not an independent frame-by-frame raster comparison, and the 5318 count is not an FPS measurement.

Source: `evidence/perf-fixes/desktop-avatar-cache-front.json`, `desktop-avatar-matrix-front.json`, and the six referenced `evidence/performance/desktop-io-front-quiet-{1200,6500}-{0,1,2}.json` files. `worker-generator-unchanged.json` records unchanged generator bytes; its generator SHA-256 is `953afab26f5bd227ce8955f20f63acc32761655b6cb0f97e8490a759ceb81e02`. Existing V1 pixel-golden evidence remains separate from this scheduling test.

### Cold page opening remains above the frame budget

These are selector/fresh-wallet page observations, not full application process-start measurements. The native targets are Debug simulators/emulators, and the Desktop measurements use the corrected foreground condition. The Desktop DEV harness pre-focuses the intended wallet outside the timed open; a future production real-mouse first-modal sample has a different trigger and must not be directly labeled the same before/after test.

| Target | Maximum rAF interval, runs 0 / 1 / 2 (ms) | Largest JS long task, runs 0 / 1 / 2 (ms) | Long-task counts |
| --- | --- | --- | --- |
| Desktop, corrected foreground | 99.60 / 99.70 / 83.30 | 112.00 / 105.00 / 99.00 | 2 / 1 / 1 |
| Android | 159.28 / 146.03 / 216.48 | 155.78 / 145.91 / 200.93 | 5 / 3 / 5 |
| iOS, latest completed run | 231.67 / 273.74 / 269.83 | 141.96 / 273.22 / 203.63 | 4 / 4 / 5 |

None of these cold-opening rows establishes a full-frame pass. Long-task and rAF boundaries differ: a task before the probe's first callback can be larger than its largest recorded rAF interval. The old 7.2-second iOS long task remains the earlier URI-migration baseline; it must not be described as isolated PNG encoding time or used to claim that these latest runs controlled every other cache/state variable.

Separate time-aligned Desktop CPU profiles place the first 104 / 109 / 104 ms long tasks mainly in React DEV mounting: `performWorkOnRoot` inclusive 74.36 / 78.10 / 73.89 ms, including Error-stack construction self 29.98 / 35.59 / 29.14 ms. The account loader and patch builder had no samples inside those first tasks. These Error samples are framework stack construction, not application error counts. An independent later 73 ms task contained 64.67 ms of debug timer configuration synchronous IPC. Those costs overlap and cannot be summed or assigned millisecond-for-millisecond to the unprofiled cold samples above. Production disables the identified DEV paths, but that source fact is not a production performance result.

Across the separate full CPU sampling windows, excluding profiler startup, loader self samples changed from 39.19 / 38.05 / 36.72 ms to 1.09 / 1.26 / 0 ms; patch builder inclusive samples changed from 13.34 / 6.28 / 5.98 ms to 1.25 / 2.52 / 2.38 ms. These are cumulative sampled attribution, not isolated call durations or a controlled device-speed ratio. Zero means no sampling hit, not proven zero work.

Sources: `evidence/perf-fixes/desktop-acceptance-front.json`, `android-final-acceptance.json`, `ios-final-staged-acceptance.json`, and `desktop-cold-cpu-audit.md` with its cited profiles/time-base JSON.

### Android: retain the unresolved scroll-window spike

Android main and background run in separate Hermes heaps; the service fixture lives in background. The rolling native sampler is process-owned. The existing steady test drives the public `scrollToOffset` API at 1200 px/s; it is not a finger-gesture arbitration test.

| List | Three-sample rAF FPS range | Worst P95 (ms) | Maximum recorded interval (ms) | Intervals >25 ms | Long tasks |
| --- | ---: | ---: | ---: | ---: | ---: |
| Accounts | 57.701–59.996 | 21.07 | 212.82 | 2 | 1 |
| Wallet sidebar | 59.998–60.002 | 17.78 | 20.31 | 0 | 0 |
| All networks | 58.211–60.000 | 17.64 | 190.02 | 2 | 1 |
| Single network | 59.844–59.999 | 17.98 | 44.42 | 1 | 0 |

The original probe includes reset/double-rAF preparation. Offline monotonic-interval/wall-marker alignment gives distinct boundaries:

- Account run 0: the 212.821 ms interval begins approximately 19.179 ms after the gesture marker and ends at +232 ms. Its 68.469 ms interval is also after the marker. The approximately 213 ms stall cannot be removed as preparation and remains unassigned to a function or subsystem.
- All-network run 0: the 190.019 ms interval runs approximately −199.019 to −9 ms relative to the gesture marker, entirely in preparation. It must not be reported as a 190 ms sustained-scroll task. A separate 54.293 ms interval crosses the marker (−0.293 to +54 ms).
- Single-network run 0: a 44.418 ms interval occurs after the marker without a >50 ms long task. The other nine samples have no >25 ms interval.

The old gesture marker predates the exact first moving command, and wall endpoints have integer-ms precision. The timeline does not attribute the account stall to avatars, React, GC, cache reads or NativeList updates. Main-runtime `Profiler.enable` was unavailable (`Unsupported method 'Profiler.enable'`); that attempt did not produce an attribution profile. A subsequent native sampling profile is described below. These original Android results must not be relabeled as having used the later preparation-separated helper.

Sources: `evidence/perf-fixes/android-final-acceptance.json`, `android-final-steady-timeline-audit.json`, `android-final-steady-harness-audit.md`, and `android-first-scroll-profiler-availability.json`.

### Android: main-runtime SWR attribution

A separate diagnostic run used the existing native Sentry/Hermes sampling API without calling upload methods or changing Sentry configuration. RN `Tracing` was not used because `ReactNativeApplication.systemStateChanged.isSingleHost` was false. The native sample contains 812 samples on thread 10182 (`mqt_v_js`); 83 contain the main `index.bundle`/`runtimeTarget=main`, with no background bundle frames. This establishes the main-runtime scope for this profile. Main/background heaps remain separate; background owns persistence through the shared native MMKV resource.

The 224.894 ms preparation long task contains 22 sampling hits, all on the SWR flush path, including optimistic mirror processing and RPC dispatch. The call chain repeatedly parses, prunes and serializes the complete store: `flush → applyNativeSWRCachePatchToSerializedStore`, followed by `mutate → applyNativeSWRCacheCanonicalEntries`. GC appears within the same chain. A 66.748 ms interval during the later scroll contains four hits, three in `acknowledgeRemoteMutation → applyCanonicalMutation → applyNativeSWRCacheCanonicalEntries → parseStore/prune`. That interval is a frame gap, not a measured 66.748 ms single task; its observer did not report a >50 ms task.

This confirms repeated full-store work during optimistic writes and background acknowledgements as an observed hotspot. It does not retroactively assign every millisecond of the earlier unprofiled 213 ms sample, or the iOS 70 ms interval, to this cause. Both fixture runtimes were restored. The proposed shared-storage fix is under scope confirmation and has not been implemented or performance-accepted.

Sources: `evidence/perf-fixes/android-first-scroll-attribution.json`, `android-first-scroll-attribution.hermes.json`, `android-first-scroll-attribution-audit.md`, and `android-first-scroll-profile-audit.json` (input hashes and time-aligned stacks).

### iOS: latest steady sample separates preparation

The latest completed iOS Debug Simulator run uses the staged helper. It records module search/load, ref lookup, reset and wait separately; the sample starts immediately before the first moving public `scrollToOffset` command. Its main/background heaps are separate, and native rolling metrics are process-owned. These are API-driven rendering samples, not new physical-finger or compositor proof.

| List | Intervals across 3 runs | JS rAF FPS range | Worst P95 (ms) | Maximum sampled interval (ms) | Intervals >25 ms | Sample long tasks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Accounts | 1167 | 59.537–59.999 | 16.95 | 70.15 | 1 | 1 |
| Wallet sidebar | 1170 | 59.999–60.000 | 16.81 | 26.21 | 1 | 0 |
| All networks | 1172 | 59.989–60.002 | 16.75 | 17.87 | 0 | 0 |
| Single network | 1171 | 60.000–60.004 | 16.79 | 17.56 | 0 | 0 |

The 4680 sampled intervals include one 70.154 ms account interval with a 67.798 ms long task and one 26.208 ms wallet interval without a long task. The other ten samples have no >25 ms interval or sample long task. The account stall is inside the measured moving-command window, remains unattributed, and cannot be explained away as preparation. The maximum measured synchronous public-command call was 4.255 ms; this does not account for asynchronous native/render work.

Preparation lasted 33.944–542.183 ms and separately contained six long tasks, largest 344.517 ms. None crossed the recorded preparation/sample boundary. Those preparation results remain visible rather than being deleted to make the steady table look clean. Main/background fixture restoration both completed according to the JSON. Latest native cold-opening and actual-scroll spikes remain open performance work; this run is not an all-scenarios pass.

Source: `evidence/perf-fixes/ios-final-staged-acceptance.json` and its paired `.log`; helper `steady-scroll-perf-staged.cjs`.

Separately, the final `0648…f5f1` iOS build received real native drag input on the All networks index rail. The saved after-images show the index selecting U/Unichain on the downward drag and B/Bitcoin on the upward drag while the modal remains open. The two 30 fps recordings contain 59 and 56 analyzed frames, no missing header-pill frame and a 1-point scanned pill-top variation; this small raster/scan variation does not establish a modal pan. A header-origin downward drag still dismisses the modal: the independent final navigation state is `rootIndex: 0` with `lists: []`. These recordings verify gesture ownership and dismissal in the tested Simulator; their encoding frame rate is not JS/UI FPS. The single-network index gesture was not rerun in this final-build check.

Gesture sources: `evidence/ios-index-gesture/final-0648-portfolio-{down,up}.json`, their `-after.png` images and `.mp4` recordings, `final-0648-header-dismiss.json`, and `evidence/perf-fixes/ios-final-header-dismiss-state.json`.

### Memory: bounded capacity, not a proven leak reduction

The follow-up Desktop memory run opens/closes six different 1000-account fixture wallets and explicitly requests GC between stages, outside FPS sampling. It measures renderer JS heap/DOM only; Worker, image decode, GPU and native process memory are not included.

| Stage | Renderer JS heap (MiB) | DOM nodes | Mounted lists |
| --- | --- | --- | --- |
| Initial closed state | 177.960 | 3154 | 0 |
| Six opened states | 183.001 → 186.376 | 3719 each | 2 |
| Six closed states | 180.016 → 182.707 | 3174 each | 0 |
| Fixture restored and closed | 180.326 | 3179 | 0 |

Post-restore heap is 2.366 MiB above this run's initial state. There is no progressive closed-DOM node growth, but this short run proves neither a long-term leak nor a memory improvement. An earlier run began at 169.986 MiB and ended at 171.553 MiB (+1.566 MiB), with different document/DOM baselines; subtracting the two runs is not a controlled regression/improvement calculation. In the earlier direct persistent-SWR inspection, all 34 entries used 433531 serialized characters and `accSelList` entries were zero. The observed heap growth cannot be assigned to SWR from those results.

The new `accSelList:` budget is at most three recently updated complete list scopes and 6 Mi serialized characters in total, under the unchanged 5 Mi per-entry global limit. A wallet/network/derive combination is a scope, not necessarily one wallet. V1/V2 share the keys. Evicted results revalidate through the original service; other namespace budgets and shared values/DeFi atoms are not cleared. Serialized-character budgets are not actual heap or RSS limits, and native main/background budgets must not simply be multiplied into alleged occupied memory.

The current account formatting cache retains the current account set, not every prior wallet; native snapshot/row representations remain O(N). The fixture's three-wallet LRU bounds only fixture-generated records, not every application cache. Native group pools trim idle historical capacity while retaining current members and animation/drag state. In the separate iOS 32-child→2-child group check, `NativeListCell` objects reachable from window view hierarchies decreased 43→18; a subsequent real group drag emitted the parent reorder and expanded correctly. This counts reachable views, not all allocated cells, process RSS or every animation frame.

Web avatar limits also need distinct ownership labels: 128 is the document cache's target entry count, with active leases protected and potentially exceeding it. Worker pending writes retain at most 32 items or 4 MiB, LRU touches at most 128 keys, and disk data at most 2048 entries or 32 MiB under normal metadata operation. Two display loads and two physical disk-read permits are independent bounds. The 8 ms timer only limits display waiting for disk; generation/decode/paint can take longer. Continuous scrolling may postpone persistence or evict queued old writes, and a blocked database may keep disk caching unavailable while visible generation continues. No guarantee of immediate persistence or total process-memory ceiling is claimed.

Sources: `evidence/perf-fixes/desktop-memory.json`, `evidence/cold-init-analysis/desktop-memory.json`, `desktop-swr-counts.json`, and `evidence/perf-fixes/ios-group-before.log`, `ios-group-after.log`, `ios-group-drag.json`.

### Production Desktop: file-origin Worker repair

Direct Worker construction from the packaged `file:` URL succeeded synchronously but subsequently aborted script loading. Fetching the same script through Electron's existing file interceptor succeeded. The NativeList patch now fetches the packaged script asynchronously and starts a Blob Worker only for `file:` assets. HTTP and extension URLs retain the existing bundler-recognized Worker entry. Startup coalesces pending leases, honors cancellation and current priority, guards failed generations, and revokes the temporary script URL. Image generation, cache formats, native sources, public declarations, CSP and Electron security settings are unchanged.

The resulting NativeList patch SHA-256 is `cc47d17108763b047db4619a8c64aa21a9d59386d6e2696213a322653124b4bf`. Relative to `0648…f5f1`, only the Web avatar broker's TypeScript source and published JavaScript changed. The earlier native evidence therefore retains its original build label. Eight startup behavior tests pass against each broker entry, the existing nine scheduling tests and strict TypeScript checks pass, and pristine patch replay matches 207 installed files with no build artifacts. An independent real file-origin probe verifies IndexedDB write, read from a new Blob Worker, and deletion; it does not establish that every application avatar has been persisted.

Production renderer build `7863b1f557b28d0a` completed with zero errors and 16 existing warnings; all 26 initial-script integrity values matched. A stale dependency-cache build was rejected before acceptance, then rebuilt with persistent cache disabled in a temporary wrapper. Neither tracked build scripts nor either Electron main build changed. No Sentry upload or `ONEKEY_USER_NOTICE` was emitted by this renderer build. These runtime results use app source `105e3f8c99` plus the `cc47…b4bf` patch. The remote branch subsequently merged `x` at `2bc29eac64`; the final combined branch has not been rebuilt for these measurements.

The actual production Electron used an isolated QA profile, the normal production renderer and normal password verification. Main/background business code shares one renderer JS thread; the avatar Worker and Electron main process are separate. Geometry was 1200 × 675 CSS pixels, DPR 2. The owned Electron process was the system foreground application before and after every sample. No CPU profiler ran during these samples.

| Production trigger | rAF intervals | Maximum interval (ms) | JS long tasks | Readiness / steady result |
| --- | ---: | ---: | --- | --- |
| First modal mouse-open in this harness | 7 | 42.0 | One, 50 ms | Visible avatars ready at the first successful poll, 81.8 ms after input; two real QA accounts and 1000 fixture wallets |
| Fresh 1000-account wallet switch 1 | 8 | 40.9 | One, 50 ms | Visible avatars, amounts and target identity ready at 96.6 ms |
| Fresh 1000-account wallet switch 2 | 8 | 32.7 | None | Ready at 85.4 ms |
| Fresh 1000-account wallet switch 3 | 6 | 33.4 | None | Ready at 76.1 ms |
| Accounts, three scroll round trips | 954 | 9.4 | None | 120.005 rAF FPS; P95 9.3 ms; zero intervals >16.8 ms |
| Wallet sidebar, three scroll round trips | 954 | 9.4 | None | 119.989 rAF FPS; P95 9.2 ms; zero intervals >16.8 ms |

Scrolling uses real CDP mouse gestures at 1400 CSS px/s, 1800 px per leg. Image readiness is checked at gesture checkpoints, not every raster frame. The measured rAF cadence is approximately 120 Hz; this is not panel presentation proof and must not be compared directly with the earlier development client's 60 Hz cadence or different geometry. Short opening samples are reported as intervals/tasks rather than misleading average FPS. Readiness polling is every 100 ms, and the measured first modal was already code/image-warmed by preceding diagnosis. Fresh service build counts were zero before each synthetic wallet switch, but avatar disk keys were not preflighted; none of these samples establishes process cold-start or a disk-cold avatar result.

All 15 recorded console errors have the same digest, independently identified as the unsupported `sentry-ipc` URL-scheme error. No page error was recorded. The report remains `MEASURED_WITH_CONSOLE_ERRORS`; the trace does not attribute the remaining 50 ms tasks to Sentry or any other subsystem. Real-account screenshots and DOM checks confirm ready Blob-backed account avatars and unchanged file-backed wallet images. The fixture, original selected account/network and closed-modal state were restored, and QA globals were removed. The earlier readiness/cleanup failures remain saved and are not counted as successful samples.

Sources under `evidence/production-measurement/`: `file-worker-fix/verification.json`, `file-worker-fix/production-renderer-result.json`, `production-file-worker-fixed-cc47-ready.json`, and `production-file-worker-repaired-ui.json` with its screenshot. Production network-list, continuous-avatar, memory and process cold-start measurements are not supplied by these two account/wallet scrolling samples.

### Remaining acceptance boundary

The corrected Desktop development steady/continuous-avatar matrix is complete within the stated environment and speeds. Android's approximately 213 ms scroll-window stall, iOS's approximately 70 ms sampled account stall, and cold-opening long tasks remain unresolved. Production account-avatar loading is repaired and the account/wallet samples above are complete, but 33–42 ms opening/switching intervals and two 50 ms tasks remain. Shared-storage changes await scope confirmation. The separate development-mode client remains running. First production modal opening, a fresh service wallet switch, and a cold avatar disk lookup are separate triggers/cache states; file-origin storage cannot be assumed equivalent to the copied HTTP profile.

Actual installed extension behavior, Release physical-device results, 120 Hz/compositor presentation, arbitrary cold index jumps, hardware SDK communication and transaction/derivation work are not established by this follow-up. Do not merge a blanket “all platforms full-frame” or “no memory leak” conclusion from these samples.

## Earlier URI-only baseline

The following measurements belong to the earlier `8077a93a…` NativeList patch. They preserve the original before/after and pixel/persistence evidence; they are not the latest follow-up build results.

### Measurement conditions

| Target | Environment | Scrolling sample |
| --- | --- | --- |
| iOS | iPhone 17 Pro Simulator, iOS 26.5, Debug, 402 x 874 points, DPR 3 | Public NativeList `scrollToOffset`, about 10 s per list |
| Android | API 36 arm64 emulator, Debug, 1080 x 2400 pixels, density 420, 60 Hz | Public NativeList `scrollToOffset`, about 10 s per list |
| Desktop | Actual isolated Electron renderer, 1280 x 900 CSS pixels, DPR 2 | Six real CDP mouse-scroll gestures, about 8 s per list |

Native programmatic scrolling isolates list rendering from the extra accessibility-tree work performed by XCUI. Separate real finger-gesture recordings validate visible behavior. These Debug simulator results do not establish Release-device, panel presentation, or 120 Hz performance.

The account stress fixture supplies 1000 wallets and 1000 accounts per wallet at the original service boundary. Only the current wallet is materialized, with an LRU of three wallets / 3000 account records. This represents one million logical accounts, not one million persisted accounts. It does not measure database ingestion, address derivation, or transactions. Production selectors continue to use the original real wallet/account services; the temporary fixture was restored after testing.

Network tests use the QA environment's normal server/configuration data: 157 all-network rows and 177-178 single-network rows, including structural rows. Network configuration and selected/asset groups can differ between devices.

Steady samples below were collected without concurrent native builds. rAF FPS is calculated from recorded JS frame intervals, not the screen-recording frame count. All twelve samples contain zero reported JS long tasks.

### Steady scrolling

| Target | List | Sampled intervals | JS rAF FPS | P95 (ms) | Maximum (ms) | Intervals >25 ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| ios | Accounts | 601 | 60.06 | 16.76 | 21.08 | 0 |
| ios | Wallet sidebar | 601 | 60.02 | 16.83 | 18.62 | 0 |
| ios | All networks | 601 | 60.08 | 16.77 | 18.10 | 0 |
| ios | Single network | 602 | 60.01 | 16.76 | 21.32 | 0 |
| android | Accounts | 601 | 60.00 | 18.01 | 22.98 | 0 |
| android | Wallet sidebar | 601 | 59.99 | 18.44 | 21.81 | 0 |
| android | All networks | 602 | 60.00 | 18.25 | 22.49 | 0 |
| android | Single network | 602 | 60.00 | 18.45 | 25.08 | 1 |
| desktop | Accounts | 489 | 60.02 | 17.50 | 17.70 | 0 |
| desktop | Wallet sidebar | 485 | 60.00 | 18.50 | 18.70 | 0 |
| desktop | All networks | 486 | 60.01 | 18.50 | 18.70 | 0 |
| desktop | Single network | 487 | 59.99 | 18.40 | 18.70 | 0 |

The native rolling UI sampler reported 59.94-60.09 for the iOS account list and 59.65-60.92 for Android. The iOS wallet-sidebar sample included one rolling reading near 58. These counters have sampling variation and are not direct panel-presentation evidence. Android single-network scrolling had one 25.08 ms JS interval; it is retained in the table.

The Desktop account row above is a warm steady sample. Fresh-wallet scrolling had one 33.4 ms interval in a separate traced sample. Its renderer thread spent about 29.4 ms across consecutive React updates; PNG decode work was on other threads. The source of those business-state updates has not been fully identified.

### Cold opening and payload size

| Target | Before: maximum rAF interval (ms) | URI: maximum rAF interval (ms) | Before: maximum JS long task (ms) | URI: maximum JS long task (ms) |
| --- | ---: | ---: | ---: | ---: |
| ios | 7719.55 | 719.31 | 7206.29 | 154.24 |
| android | 6562.36 | 233.28 | 6561.96 | 233.15 |
| desktop | Not a valid cold baseline | 151.10 | Not a valid cold baseline | 110.00 |

The old approximately 7.2 s iOS result is an entire JS long task that included eager avatar generation, not an isolated PNG-encoding measurement. An earlier approximately 1 s sample had warmed the old avatar cache and is excluded as a cold baseline. The 719.31 ms new iOS interval spans multiple tasks; its largest individual long task is 154.24 ms. Cold avatar caches were checked separately; these are page observations, not a claim that every unrelated application cache/heap was identical.

| 1000-account payload | Before | URI | Reduction |
| --- | ---: | ---: | ---: |
| Native account snapshot, including the add-account row | 22,847,723 bytes | 736,723 bytes | 96.8% |
| Avatar visual JSON only | 22,389,001 bytes | 302,001 bytes | 98.7% |

A same-code host V8 descriptor-construction comparison measured approximately 622 ms versus 0.45 ms. This is a host microbenchmark, not phone page time. Non-image descriptor fields were compared and remained identical.

### Avatar pixels, persistence, and visibility

| Check | Observed result | Boundary |
| --- | --- | --- |
| iOS generator golden images | 1014 seeds, zero RGBA pixel differences from V1 | Host generator and PNG decoding |
| Android generator golden images | 1227 seeds, zero RGBA pixel differences | Host JVM, independent PNG decoding |
| Actual Chrome Worker golden images | 1011 seeds / 16,564,224 pixels, zero differences | Worker-generated PNGs compared against V1 |
| Device PNGs | 20 iOS and 20 Android cached avatars, zero pixel differences | Same deterministic seeds |
| iOS process restart | All 84 prior avatar-cache files retained identical content, size, mtime, and inode | Proves file reuse/no rewrite; does not directly count generator calls |
| Android process restart | All 20 inspected prior avatar files retained identical content, size, mtime, and inode | Exact synthetic cache keys only |
| Desktop new document and Worker | 18 persisted PNG validations, 18 Blob URL responses, zero PNG encodes | Document/Worker restart, not full Electron process restart |
| Desktop displayed avatar raster | 18 images, 1024 x 1042 region, zero different pixels | Same frozen V2 layout with URI images versus original V1 PNGs; not a substitute for whole-page V1/V2 comparison |
| iOS real finger scrolling | 492 decoded frames / 5164 fully visible account-row observations; no whole-avatar disappearance | Variable-rate recording; unrecorded transient frames remain outside coverage |
| Android real finger scrolling | 261 decoded frames / 2876 complete row observations; no missing, misplaced, or wrong-account avatars | Clipped edge rows excluded; H264 tolerance used for color matching |

A separate Desktop test scrolls four legs at 6500 px/s and samples visible DOM/image states every rAF. Across 682 sampled frames, already-ready-to-unready transitions, missing images on return, internal row gaps, and image errors were all zero. However, 82 newly encountered accounts had first-load waiting: 377 of 398 unready observations had no URI yet. Sixty-six visible waiting episodes ended by leaving the viewport. The approximately 101 ms stage P95 is therefore not a guaranteed time-to-ready. DOM observations cannot separate queueing, generation, disk writes, and message delivery. Geometry sampling adds overhead, so this test is not used for an FPS claim.

### UI and correctness coverage

- The original V1 implementations and route identifiers remain. Prior whole-page V1/V2 comparisons used matching QA data/theme/device, not user-provided screenshots. Native text, antialiasing, and rounded-edge differences are documented separately; whole-page PNG byte equality is not claimed.
- Prior migration acceptance covered account selection/search/menu/add, wallet/group interactions, network search/selection/Apply, and supported custom-network flows. This avatar round does not claim to rerun all hardware transport, address creation, or transaction paths.
- The final iOS binary passed all-network index dragging in both directions and single-network index dragging. The modal remained open and the section changed. Ordinary header dragging closed the modal (navigation root index returned to zero).
- Android fixture account values of `$0.00` were traced to Ethereum being disabled in that QA network configuration. The fixture contributes only an Ethereum value; V1/V2 retain the same enabled-network aggregation rules.
- Focused cache/lifecycle checks cover duplicate requests, cancellation, row reuse, stale callbacks, invalid/corrupted cache entries, active URL retention, Worker recovery, and Web patches arriving before mount. Strict module type checks and the Android host Kotlin/JUnit suite passed.
- Both final native apps were built locally and their installed artifacts matched the frozen patch/native contract. The final pre-publication commit profile passed eight local gates. Hosted CI/review status is tracked separately by the PR.

Extension packaging/CSP source review found no definite external-Worker or Blob-image blocker. Published Web code was tested under a strict same-origin Worker CSP and actual Electron file loading with production security settings. **An actual installed browser-extension runtime has not been tested.**

### Reproduction and evidence provenance

1. Build the pinned 3.0.105 module set with the repository patches. Use an isolated QA wallet/profile.
2. Supply deterministic wallet/account metadata through the existing account-selector service interface. Keep logical size, the three-wallet LRU, and enabled networks fixed between comparisons. Do not persist the million-account fixture.
3. Check that the avatar cache lacks the tested seed keys. Open the unchanged account-selector route and collect rAF/long-task data. Record the serialized snapshot size separately.
4. Wait for the intended list and images to be ready before steady scrolling. Collect warm and first-visit samples separately; avoid concurrent builds and accessibility snapshots during performance sampling.
5. Restart the native process, or the Desktop document/Worker, without clearing persistent storage. Reopen the same seeds and compare exact cache files or Worker encode counters.
6. Capture real gestures independently. Compare V1/V2 under identical visual state, and distinguish first-load waiting from an already-rendered image disappearing.

Measurements were captured on application parent `b5b152a1adcccde687e6fbb3b437dec0afb17da4` plus the selector changes and the two exact patches below. Raw traces, recordings, screenshots, QA credentials, and native build products remain local and are not committed. Local evidence includes the named steady/cold JSON samples, cache restart manifests, golden-pixel reports, and frame-visibility reports. The tables above are the portable result record.

| Patch | SHA-256 |
| --- | --- |
| `@onekeyfe+react-native-native-list+3.0.105.patch` | `8077a93a271f44f8a23fa15c1315ff01b7b7b34990cbc5d3cf33b214445cb3e6` |
| `@onekeyfe+react-native-image+3.0.105.patch` | `323181a9086abfc26a33e531333eeb8b341c765600128871bbcb759e24f36f08` |

Pristine patch replay matched 203 NativeList and 195 native-image source files with zero build artifacts. Both native builds reported a web-embed OCI HTTP 404 and succeeded after local-build fallback; these runs were not clean remote-cache hits.

At this earlier URI-only baseline, open items were cold-page initialization, first-visit avatar waiting at extreme speeds, extension runtime and Release/high-refresh coverage. The follow-up above records the current results and remaining failures.
