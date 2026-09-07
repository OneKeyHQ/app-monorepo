# NativeList selector performance and validation

Measured on 2026-09-07. The account and network selectors use NativeList V2 while preserving the V1 components and existing route names/parameters. The four migrated lists are the wallet sidebar, accounts, all networks, and single networks.

The URI avatar/cache change passes the listed pixel and persistence checks. Steady scrolling is approximately 60 JS rAF FPS. **Cold opening and first-time avatar loading during extreme scrolling have not passed an all-scenarios full-frame requirement.**

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

## Measurement conditions

| Target | Environment | Scrolling sample |
| --- | --- | --- |
| iOS | iPhone 17 Pro Simulator, iOS 26.5, Debug, 402 x 874 points, DPR 3 | Public NativeList `scrollToOffset`, about 10 s per list |
| Android | API 36 arm64 emulator, Debug, 1080 x 2400 pixels, density 420, 60 Hz | Public NativeList `scrollToOffset`, about 10 s per list |
| Desktop | Actual isolated Electron renderer, 1280 x 900 CSS pixels, DPR 2 | Six real CDP mouse-scroll gestures, about 8 s per list |

Native programmatic scrolling isolates list rendering from the extra accessibility-tree work performed by XCUI. Separate real finger-gesture recordings validate visible behavior. These Debug simulator results do not establish Release-device, panel presentation, or 120 Hz performance.

The account stress fixture supplies 1000 wallets and 1000 accounts per wallet at the original service boundary. Only the current wallet is materialized, with an LRU of three wallets / 3000 account records. This represents one million logical accounts, not one million persisted accounts. It does not measure database ingestion, address derivation, or transactions. Production selectors continue to use the original real wallet/account services; the temporary fixture was restored after testing.

Network tests use the QA environment's normal server/configuration data: 157 all-network rows and 177-178 single-network rows, including structural rows. Network configuration and selected/asset groups can differ between devices.

Steady samples below were collected without concurrent native builds. rAF FPS is calculated from recorded JS frame intervals, not the screen-recording frame count. All twelve samples contain zero reported JS long tasks.

## Steady scrolling

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

## Cold opening and payload size

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

## Avatar pixels, persistence, and visibility

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

## UI and correctness coverage

- The original V1 implementations and route identifiers remain. Prior whole-page V1/V2 comparisons used matching QA data/theme/device, not user-provided screenshots. Native text, antialiasing, and rounded-edge differences are documented separately; whole-page PNG byte equality is not claimed.
- Prior migration acceptance covered account selection/search/menu/add, wallet/group interactions, network search/selection/Apply, and supported custom-network flows. This avatar round does not claim to rerun all hardware transport, address creation, or transaction paths.
- The final iOS binary passed all-network index dragging in both directions and single-network index dragging. The modal remained open and the section changed. Ordinary header dragging closed the modal (navigation root index returned to zero).
- Android fixture account values of `$0.00` were traced to Ethereum being disabled in that QA network configuration. The fixture contributes only an Ethereum value; V1/V2 retain the same enabled-network aggregation rules.
- Focused cache/lifecycle checks cover duplicate requests, cancellation, row reuse, stale callbacks, invalid/corrupted cache entries, active URL retention, Worker recovery, and Web patches arriving before mount. Strict module type checks and the Android host Kotlin/JUnit suite passed.
- Both final native apps were built locally and their installed artifacts matched the frozen patch/native contract. The final pre-publication commit profile passed eight local gates. Hosted CI/review status is tracked separately by the PR.

Extension packaging/CSP source review found no definite external-Worker or Blob-image blocker. Published Web code was tested under a strict same-origin Worker CSP and actual Electron file loading with production security settings. **An actual installed browser-extension runtime has not been tested.**

## Reproduction and evidence provenance

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

Open acceptance items are cold-page initialization long tasks, first-visit avatar waiting at extreme scroll speeds, actual extension runtime coverage, and Release-device/high-refresh-rate measurement.
