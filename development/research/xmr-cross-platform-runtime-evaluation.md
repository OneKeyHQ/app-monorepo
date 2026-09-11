# XMR cross-platform wallet runtime evaluation

Accessed: 2026-09-05

## Research questions

1. Which open-source Monero wallet runtimes have evidence of production use on
   Android, iOS, or desktop, and what actually performs scanning?
2. Is there one maintained runtime that OneKey can directly use across React
   Native and Electron without owning a native fork?
3. Which option best balances local scanning, package size, reliability,
   compatibility, licensing, and OneKey's existing runtime topology?

## Conclusion

There is no mature, directly consumable SDK that simultaneously covers React
Native Android/iOS and Electron with local wallet scanning.

- The most production-proven local-scanning lineage is native Monero
  `wallet2`, used through native wrappers by Cake Wallet, Stack Wallet, and
  Monerujo. It has the strongest mobile precedent, but it needs a React Native
  native module and a separate Electron Node-API/IPC bridge in OneKey. The
  currently distributed `monero_c` binaries are also much larger than the WASM
  option and its wrapper still has open stability and reproducible-build work.
- The smallest production-proven cross-platform family is MyMonero/Edge's
  light-wallet design. It uses a server that receives the private view key and
  scans for the wallet. Local code derives keys, checks key images, constructs,
  and signs transactions. It is not a local-scanning design.
- `monero-ts` is the smallest practical single-artifact local-scanner candidate
  for OneKey. It wraps full `wallet2` in a single-threaded WebAssembly module and
  exposes a Worker loader, but it has a bus factor close to one, little evidence
  of independent production-wallet adoption, and no Android/iOS WebView
  production baseline. Its current CI also does not exercise the complete
  funded sync-and-send lifecycle. It is suitable for a time-boxed prototype,
  not as OneKey's assumed production foundation.

There is therefore **no recommended drop-in local-scanning SDK**. If local
scanning and view-key privacy are release requirements, the defensible
production baseline is upstream Monero `wallet2` plus a minimal OneKey-owned
adapter and platform carriers. Existing wrappers such as `monero_c` are useful
implementation references, but their small maintainer base and open native
memory/reproducibility work mean OneKey should not delegate core reliability to
them without an independent audit and ownership plan. `monero-ts` may be used
only for a prototype to measure WebView compatibility and operational cost; a
successful prototype does not by itself resolve its upstream ownership risk.

If giving a view key to a OneKey-operated LWS is acceptable, the existing
MyMonero/Edge architecture remains the smallest and most mature implementation
choice. That is a product/privacy decision rather than an SDK optimization.

## Research baselines

| Source | Resolved revision | Role |
|---|---|---|
| `woodser/monero-ts` | `977b23e06030ff74c613497c2cb01ec210bb86b9` | Browser/Node full wallet2 WASM |
| `MrCyjaneK/monero_c` | `7352f1cdd5e59f09f7b2431df124a53e834a2ba5` | Cross-platform C wrapper over native wallet2 |
| `cake-tech/cake_wallet` | `73a739411f500249db9dc29a5f9db7dcdba54813` | Production native wrapper consumer |
| `m2049r/xmrwallet` | `41a7b7ba6123920ba88145c1fc1ec3a6974b991a` | Production Android JNI wallet2 consumer |
| `cypherstack/stack_wallet` | `9517439bea2ccab2ed84bd578de80773eeb20d04` | Production Flutter native wrapper consumer |
| `cypherstack/cs_monero` | `fb4d9561f0da8e495e072182989f13f6c9b766d9` | Dart abstraction over `monero_c` |
| `EdgeApp/edge-currency-monero` | `665d3a31e0219b45be36f7d5d0b31bce08fc4473` | Production light-wallet client |
| `EdgeApp/react-native-mymonero-core` | `d541667bf13a1d810dde3edffb89bc8e89c6d882` | React Native local crypto/transaction bridge |
| `mymonero/mymonero-app-js` | `5c7455d30e4e20150962f5f74efd83477962a05e` | Electron light-wallet implementation |
| `mymonero/mymonero-mobile` | `baa67f92ad6269f1dc847f053e29b05a33296117` | Capacitor iOS/Android light-wallet implementation |
| `mollyim/monero-wallet-sdk` | `6d4b2418b578b81fe2e232b72ce7b8a128376454` | Modern Android-only wallet2 SDK reference |

## Evidence and comparison

### Native wallet2 family

Monero itself exposes the C++ [`wallet2_api.h`](https://github.com/monero-project/monero/blob/master/src/wallet/api/wallet2_api.h).
Monerujo's JNI bridge directly includes that API at its fixed revision:
[`monerujo.cpp`](https://github.com/m2049r/xmrwallet/blob/41a7b7ba6123920ba88145c1fc1ec3a6974b991a/app/src/main/cpp/monerujo.cpp).

Cake builds `monero_c` for Android, iOS, macOS, Linux, and Windows. Its build
scripts show the actual native-library integration rather than a pure Dart
implementation:

- [Android native build](https://github.com/cake-tech/cake_wallet/blob/73a739411f500249db9dc29a5f9db7dcdba54813/scripts/android/build_monero_all.sh)
- [iOS native build](https://github.com/cake-tech/cake_wallet/blob/73a739411f500249db9dc29a5f9db7dcdba54813/scripts/ios/build_monero_all.sh)
- [Windows packaging](https://github.com/cake-tech/cake_wallet/blob/73a739411f500249db9dc29a5f9db7dcdba54813/windows/CMakeLists.txt)

`monero_c` is not a thin, pristine build of official Monero. Its fixed tree
contains a C wrapper plus 21 Monero patches, including storage, iOS, Windows,
coin-control, hardware, and serialization changes:
[`patches/monero`](https://github.com/MrCyjaneK/monero_c/tree/7352f1cdd5e59f09f7b2431df124a53e834a2ba5/patches/monero).
Its prebuilt documentation explicitly says release prebuilts should not be used
in production:
[`Using-prebuilds.md`](https://github.com/MrCyjaneK/monero_c/blob/7352f1cdd5e59f09f7b2431df124a53e834a2ba5/docs/Writerside/topics/Using-prebuilds.md).

Measured from the `v0.18.4.6-RC2` release bundle, without executing it:

| Target library | Raw | gzip -9 |
|---|---:|---:|
| Android arm64 | 38.08 MB | 10.87 MB |
| Android armv7 | 32.01 MB | 9.98 MB |
| iOS arm64 | 26.49 MB | 8.12 MB |
| macOS arm64 | 26.62 MB | 8.32 MB |
| macOS x64 | 28.62 MB | 8.51 MB |
| Linux x64 | 34.96 MB | 11.21 MB |
| Windows x64 | 54.26 MB | 13.78 MB |

The wrapper currently has an open memory-ownership defect that can crash the
host if a transaction ID is queried after commit, and its “becoming stable” and
reproducible-build work remain open:
[issue 193](https://github.com/MrCyjaneK/monero_c/issues/193),
[issue 12](https://github.com/MrCyjaneK/monero_c/issues/12), and
[issue 113](https://github.com/MrCyjaneK/monero_c/issues/113).

Molly's Android SDK is a stronger Android-specific reference: it puts wallet2
in an isolated Android Service, injects storage/networking, requires API 26,
and reports an approximately 6.5 MB AAR:
[`mollyim/monero-wallet-sdk`](https://github.com/mollyim/monero-wallet-sdk/tree/6d4b2418b578b81fe2e232b72ce7b8a128376454).
It is Android-only and GPL-3.0, so it is not a direct cross-platform dependency
for OneKey without a licensing decision.

### Light-wallet family

Edge's production plugin explicitly sends the address and private view key to a
MyMonero-compatible server for login, balance, history, and unspent outputs,
then performs key-image checks and transaction construction locally:
[`MyMoneroApi.ts`](https://github.com/EdgeApp/edge-currency-monero/blob/665d3a31e0219b45be36f7d5d0b31bce08fc4473/src/MyMoneroApi.ts).
Its React Native crypto bridge supports Android and iOS but intentionally
contains crypto/transaction methods rather than a local scanner:
[`react-native-mymonero-core`](https://github.com/EdgeApp/react-native-mymonero-core/tree/d541667bf13a1d810dde3edffb89bc8e89c6d882).

MyMonero also shipped the same broad design in an
[Electron application](https://github.com/mymonero/mymonero-app-js/tree/5c7455d30e4e20150962f5f74efd83477962a05e)
and a [Capacitor Android/iOS application](https://github.com/mymonero/mymonero-mobile/tree/baa67f92ad6269f1dc847f053e29b05a33296117).
The server side is available as `monero-lws`, which stores view keys and scans
continuously:
[`vtnerd/monero-lws`](https://github.com/vtnerd/monero-lws).

This is the only family with clear mobile and Electron production precedent
while remaining small. Its cost is privacy and server operations, not client
compatibility.

### Full wallet2 WASM family

`monero-ts` documents full client-side wallets in Browser and Node, defaults to
a shared Worker, and exposes a custom worker loader:
[`LibraryUtils.ts`](https://github.com/woodser/monero-ts/blob/977b23e06030ff74c613497c2cb01ec210bb86b9/src/main/ts/common/LibraryUtils.ts).
Its build includes `wallet2.cpp`, uses `-Oz`, `ASYNCIFY`, `SINGLE_FILE`, and
memory growth, with pthread support disabled:
[`CMakeLists.txt`](https://github.com/woodser/monero-ts/blob/977b23e06030ff74c613497c2cb01ec210bb86b9/CMakeLists.txt).

Static measurement of the published `monero-ts@0.11.15` tarball:

| Artifact | Raw | Compressed |
|---|---:|---:|
| Decoded wallet2 WASM | 5.93 MB | 1.68 MB gzip |
| In-thread `monero.js` | 2.59 MB | 1.74 MB gzip |
| Recommended `monero.worker.js` | 3.61 MB | 2.06 MB gzip / 1.92 MB brotli |

Both the in-thread and Worker artifacts embed the WASM. A target bundler must
prove that it ships only the selected runtime asset or the WASM can be duplicated.

The current CI builds from source and runs type/build checks on Node 20/22/24,
but only runs the offline utility subset; the complete wallet test suite still
requires external Monero nodes and wallet RPC processes:
[`ci.yml`](https://github.com/woodser/monero-ts/blob/977b23e06030ff74c613497c2cb01ec210bb86b9/.github/workflows/ci.yml).
Open issues include transfer-readiness consistency, Worker/save interaction,
and environment URL/`Response` failures:
[issue 306](https://github.com/woodser/monero-ts/issues/306),
[issue 207](https://github.com/woodser/monero-ts/issues/207),
[issue 278](https://github.com/woodser/monero-ts/issues/278), and
[issue 267](https://github.com/woodser/monero-ts/issues/267).

## OneKey mapping

| OneKey target | Runtime scope and carrier | Native/resource ownership | Required integration |
|---|---|---|---|
| iOS/Android | `main` WebEmbed hosts wallet Worker; `bg` calls through bridge | WebView owns the WASM heap and wallet FS; `main` and `bg` initialize independently | Reuse the Zcash WebEmbed proxy pattern; explicit readiness, cancellation, persistence, and WebView-process-loss recovery |
| Extension | Offscreen document hosts wallet Worker; MV3 `bg` is the caller | Offscreen and background have separate JS heaps | Reuse the Zcash offscreen proxy; reconstruct after offscreen loss |
| Desktop | Single renderer JS runtime, dedicated Worker owns wallet state | Electron process owns files separately; renderer is sandboxed and has Node integration disabled | Use Worker asset; do not load native dylibs in the renderer |
| Web | Single page runtime, dedicated Worker | Origin storage owns persisted wallet data | Worker plus browser storage quota/recovery checks |

The existing mobile XMR implementation is currently disabled and throws before
returning an API, while the old MyMonero WASM binary remains approximately
2.46 MB. The existing Zcash carrier implementations provide the closest target
architecture:

- `packages/core/src/chains/xmr/sdkXmr/index.native.ts`
- `packages/kit-bg/src/webembeds/WebEmbedApiChainZcash.ts`
- `packages/kit-bg/src/offscreens/OffscreenApiZcashSdk.ts`

## Prototype and release gate

An unforked `monero-ts` prototype may advance to a production security review
only after all of these pass:

1. Exact-version and source-chain pin, license inventory, and reproducible
   locally generated artifact checksum.
2. Bundle assertion that neither the main JS bundle nor WebEmbed/offscreen
   contains duplicate wallet2 artifacts.
3. Real iOS 16.4 and Android API 26 tests: cold restore, long scan, suspend,
   resume, WebView process loss, low-memory pressure, and application restart.
4. Desktop Electron and extension tests: worker/offscreen termination,
   reconstruction, storage persistence, and MV3 suspension.
5. Funded test matrix: receive, locked/unlocked balance, confirmed history,
   send, relay-unknown recovery, reorg, rescan, and no duplicate send after
   process loss.
6. One serialized owner per wallet, bounded sync turns, durable write before
   relay, and no use of unbounded `startSyncing()`.

Passing these gates establishes technical feasibility, not dependency maturity.
Production adoption would additionally require OneKey to own reproducible
builds, review the C++/Embind boundary, monitor upstream, and be prepared to
maintain the integration if its primary maintainer becomes unavailable. If
OneKey does not want that ownership, choose upstream native `wallet2` with thin
owned adapters, or explicitly accept the privacy trade-off of a self-hosted LWS.
