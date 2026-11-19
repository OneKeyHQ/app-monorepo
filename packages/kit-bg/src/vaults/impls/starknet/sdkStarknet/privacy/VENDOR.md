# Vendored: StarkWare `starknet-privacy` SDK

This folder is a vendored copy of the `sdk/` workspace from StarkWare's
`starknet-privacy` monorepo, patched to bundle on OneKey's extension,
desktop/web and React Native targets. It is not a OneKey-authored SDK.

It lives inside kit-bg at `packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/` (it was a standalone workspace package
until 2026-10-21) and is only reached through
`packages/kit-bg/src/services/ServiceStarknetPrivacy/strk20Sdk.ts`. Paths below
are relative to this folder unless they start with `packages/`.

## Provenance

| | |
|---|---|
| Upstream repo | <https://github.com/starkware-libs/starknet-privacy> |
| Upstream path | `sdk/` |
| Package name | `@starkware-libs/starknet-privacy-sdk` |
| Version | `0.14.3-rc.8` |
| Commit | `b40bf109c8e5b97d9d6e8ec6db48b16b9d10a106` |
| Commit subject | `chore(release): 0.14.3-rc.8 (#992)` |
| Commit date | 2026-09-15 |
| Vendored on | 2026-09-18 |

The release is tracked by `sdk/package.json` version, not by a git tag. No git
tag points at that commit, so the commit SHA is the only precise anchor.

### License discrepancy — unresolved

Upstream carries **two different license claims** for the same code:

- Apache License 2.0 at the repo root (`LICENSE`, `README.md`). That file is
  copied verbatim to `./LICENSE` here.
- ISC in `sdk/package.json` (`"license": "ISC"`).

The two differ on the patent grant and on attribution requirements. This must be
settled with StarkWare before OneKey ships the code. Until then, treat the code
as Apache-2.0 (the stricter, repo-level claim) and keep `./LICENSE` intact.

The package is **not on the public npm registry**. Upstream publishes to GitHub
Packages (`publishConfig.registry`), which needs an authenticated token, so
vendoring is the only route for a public repo. Replace this package with a real
dependency if and when upstream publishes publicly.

## What was copied, and what was left out

This folder is upstream `sdk/src/` with these exclusions:

- `testing/**` — the devnet/mocknet harness. It is the only importer of
  `starknet-devnet`, `fs`, `path` and `url`, so dropping it removes a runtime
  dependency on `starknet-devnet` (which drags in `axios` and `decompress`) and
  every Node built-in from the graph. Nothing in `index.ts` re-exports it.
- `tests/**`, `scripts/**`, `vitest.config.ts`, `eslint.config.js`,
  `tsconfig*.json`, `package-lock.json`, `.prettier*` — upstream tooling.

43 vendored TypeScript files remain, plus 8 OneKey-authored ones (see below).
The public entry is `index.ts`.

## Dependencies

Declared in `packages/kit-bg/package.json`.

| Package | Declared here | Upstream | Why the difference |
|---|---|---|---|
| `starknet` | `10.8.0` (exact) | `10.5.0` (exact) | Must match `@onekeyhq/core`, which pins `10.8.0`. Verified compatible: the vendored tree typechecks clean against 10.8.0, and `proofFacts` / `proof` are still on `UniversalDetails` (`node_modules/starknet/dist/index.d.ts:764`), which the submission path needs. |
| `ohttp-ts` | `0.3.0` (exact) | `^0.3.0` | Pinned exact: `^0.3.0` resolved 0.3.5, which depends on `hpke@1.1.2` and installed a second `hpke` copy beside our 1.0.6 (observed 2026-09-21). Latest is 0.6.0; do not bump without re-checking the HPKE suite wiring. |
| `hpke` | `1.0.6` (exact) | **not declared** | Phantom dependency upstream: `internal/ohttp-client.ts` imported it while resolving only through `ohttp-ts`. Pinned to the exact version `ohttp-ts@0.3.0` depends on. A range would hoist `1.1.7`, install two copies, and hand `OHTTPClient` a `CipherSuite` from the wrong one. |
| `@panva/hpke-noble` | `1.0.6` (exact) | not declared | Added for the React Native path (see modification 1). Version-matched to `hpke@1.0.6`; it is the version `ohttp-ts@0.3.0` itself dev-tests against, and its `hpke` peer range is `^1.0.0`. |
| `zod` | `^3.23.0` | `^3.24.0` | Reuses the range already in `@onekeyhq/shared`; resolves to the installed `3.25.76`, which satisfies both. |
| `@starknet-io/starknet-types-0101` | `npm:@starknet-io/types-js@0.10.2` | `npm:@starknet-io/types-js@~0.10.2` | The alias is replicated because `interfaces.ts:73` imports that exact specifier. Pinned to `0.10.2` because `starknet@10.8.0` declares the identical alias descriptor, so yarn dedupes to the single already-installed copy. |
| `starknet-devnet` | **dropped** | `^0.7.2` | Test harness shipped as a runtime dependency upstream. Only `testing/` used it, and that directory is not vendored. |

## Local modifications

2026-11-17 integration update:

- `ProvingServiceProofProviderOptions.getNonce` injects the wallet's nonce reader;
  OneKey uses its backend/custom RPC transport at `latest` instead of creating a
  separate `RpcProvider` or silently using nonce zero when no URL is exposed.
- Discovery remains a direct OHTTP connection with the operator-pinned public
  key. Its HTTP 429/503 retries are bounded and respect `Retry-After`; HTTP 413
  is terminal. OHTTP and indexer HTTP errors retain status/retry metadata without
  retaining sensitive response bodies.

Eight upstream files were changed; three new paths were added. Net +91 / −46
lines across vendored files. Every in-place edit carries a `// onekey:` comment at the site, so
`grep -rn "// onekey:" .` (run in this folder) is the authoritative list.

### 0. Tree-wide: relative import specifiers lost their `.js` extension

Upstream builds with `moduleResolution: NodeNext` and writes
`from "./errors.js"`. Metro and the repo's webpack/rspack configs resolve the
literal string, find no `errors.js` next to `errors.ts`, and fail. 175
specifiers across the tree were rewritten. Reproduce with:

```sh
find src -name '*.ts' -print0 \
  | xargs -0 sed -i '' -E 's#(from "\.{1,2}/[^"]*)\.js"#\1"#g'
```

This is the one change with no per-site marker. Apply it first when syncing a
new upstream revision, then diff to isolate the real patches below.

### 1. HPKE suite made injectable — `internal/ohttp-client.ts:9`, `:162`

Upstream hardcoded `new CipherSuite(KEM_DHKEM_X25519_HKDF_SHA256,
KDF_HKDF_SHA256, AEAD_AES_128_GCM)` from `hpke` inside `ensureClient()`
(upstream line 159). Those primitives are WebCrypto-backed and need
`crypto.subtle` for X25519 `deriveBits`, HMAC-SHA256 and AES-GCM. Hermes has no
`crypto.subtle` at all, so OHTTP could not run on React Native.

The construction now goes through `createHpkeSuite()`:

- `platform/hpkeSuiteRegistry.ts` (new) — resolves the platform default and
  exposes `setHpkeSuiteFactory()` for hosts that the file suffix cannot
  distinguish (extension offscreen document, web-embed) and for tests.
- `platform/hpkeSuite.ts` (new) — WebCrypto suite from `hpke`. Used by
  browser, desktop, extension and jest (`jest-expo/web` ignores `.native.ts`).
- `platform/hpkeSuite.native.ts` (new) — the same suite built from
  `@panva/hpke-noble`, which implements `hpke`'s `KEMFactory` / `KDFFactory` /
  `AEADFactory` interfaces in pure JS over `@noble/*`.

After this change `ohttp-client.ts` no longer imports `hpke` directly; only the
two platform files do.

### 2. `require("async_hooks")` removed — `utils/logging.ts:16`

Upstream loaded `node:async_hooks` to get `AsyncLocalStorage` for trace-ID
propagation, guarded by `typeof window === "undefined"`. The guard is false on
React Native, and Metro resolves the static string at bundle time regardless, so
the native build broke on an unresolvable module.

The `require` and the `import("async_hooks")` type reference are gone.
`traceStorage` is now a locally-typed slot that stays `undefined`, so
`getTraceId()` always uses the existing counter fallback and `withLogging()`
calls its body directly. Nothing in the SDK depends on async context
propagation, so behaviour is unchanged apart from trace IDs no longer nesting
across `await` boundaries.

### 3. `AbortSignal.timeout` polyfilled — `internal/proving-service.ts:9`, `internal/indexer-discovery.ts:15`

Both fetch call sites used `AbortSignal.timeout(ms)`, which Hermes and older
WebViews do not ship. They now call `timeoutSignal(ms)` from
`platform/timeoutSignal.ts` (new), which uses the native method when present
and otherwise an `AbortController` plus `setTimeout`.

### 4. OHTTP streaming isolated, and made to fail loudly on native — `internal/ohttp-client.ts:195`

`readResponseText` decompressed `Content-Encoding: gzip|deflate` inner responses
with `response.body.pipeThrough(new DecompressionStream(format))`. React Native
gives no readable `response.body` and Hermes has no `DecompressionStream`.

That branch moved to `platform/decompressResponseText.ts` (web: unchanged
behaviour, plus explicit guards) and `.native.ts` (rejects with a
`StarknetPrivacySdkPlatformError` naming the encoding and telling the operator to
serve identity-encoded OHTTP responses). Per the task scope, native OHTTP
decompression is **not** implemented.

**The rest of the OHTTP path is reachable on native.** Verified by reading
`ohttp-ts@0.3.0`'s published `dist/index.js`: the non-chunked `OHTTPClient` is
entirely buffer-based — `encapsulateRequest` reads `request.arrayBuffer()`, the
outer request body is an `ArrayBuffer`, `decapsulateResponse` reads
`response.arrayBuffer()`, and the inner `Response` is rebuilt from a
`Uint8Array`. `ReadableStream` / `TransformStream` / `pipeThrough` appear only in
`ChunkedOHTTPClient` and the server classes, which this SDK never instantiates,
and only inside methods — module evaluation constructs nothing but a
`TextEncoder` and a `TextDecoder`. So the only native blocker on the OHTTP
transport is response compression.

`new Request(...)` in `OhttpClient.get`/`post` also runs only inside methods, so
no OHTTP or HPKE code executes at module-evaluation time on any platform, even
though `indexer-discovery.ts` and `proving-service-provider.ts` import
`ohttp-client.ts` statically with OHTTP switched off.

One incidental behaviour change: the early-return guard dropped its
`!response.body` term, because a missing body is now the platform file's
business. A compressed response with no readable body used to be returned as
`""`; it now raises a clear error.

### 5. `crypto.getRandomValues` routed through `globalThis` — `utils/crypto.ts:85`

`generateRandom120()` called the bare `crypto` global, which throws an opaque
`ReferenceError` where the global is absent. It now goes through
`globalThis.crypto` and raises a named error naming the missing CSPRNG. React
Native supplies it via `react-native-get-random-values`, polyfilled at app
startup.

### 6. `process.env` reads collected into `debugFlags.ts` — `utils/logging.ts:2`, `:159`

`logging.ts` read `SDK_DEBUG`, `SDK_DEBUG_COLOR`, `NO_COLOR` and `FORCE_COLOR`
from `process.env`, and probed `process.stdout.isTTY`. `process` does not exist
in the extension, native or web-embed bundles. Upstream's own browser build
worked around this by `define`-ing all four to `undefined`
(`sdk/scripts/build-browser.ts:31-36`).

`debugFlags.ts` (new) holds the four flags, defaults them all to off, and
exposes `getSdkDebugFlag()` / `setSdkDebugFlag()` so a host can switch logging on
at runtime. The `process.stdout.isTTY` probe was deleted.

### 7. `override` modifiers added — `internal/indexer-discovery.ts:366`, `internal/private-transfers.ts:90`, `:140`

The repo's `tsconfig.json` sets `noImplicitOverride: true`; upstream does not.
Three methods that override a base-class member needed the keyword.

### 8. Added: `platform/errors.ts`

`StarknetPrivacySdkPlatformError`, thrown by the platform shims. The repo's
`onekey/no-raw-error` lint rule forbids `throw new Error`, and this package stays
free of `@onekeyhq/*` imports so it can be swapped for an upstream npm release
later. **kit-bg should map this to a `OneKeyLocalError` at its boundary** —
errors crossing the background bridge need the OneKey shape to serialize and
auto-toast correctly.

### 9. Added: Starkscan REST prover transport — `onekey/`, `internal/proving-service.ts:183`, `:193`, `internal/proving-service-provider.ts`, `index.ts:33`

Starkscan hosts the only mainnet STRK20 prover
(https://starkscan.co/docs/api/strk20-prover). It takes the same
`{ block_id, transaction }` fields as `starknet_proveTransaction` and returns the
prover result verbatim, but as REST with async jobs: `POST {baseUrl}/prove`
with `Idempotency-Key`, then `GET {baseUrl}/prove/{jobId}` until `terminal`.
Starkscan also requires `X-Starkscan-Api-Key`; the adapter never sends it.
The app passes an empty `baseUrl` and a `fetchImpl` that tunnels each call
through the OneKey wallet proxy, where the backend adds the key. Upstream's
`ProvingService` only speaks JSON-RPC.

Vendored-file edits are a seam and nothing more:

- `proving-service.ts` exports a new `ProveTransport` interface, which
  `ProvingService` already satisfies structurally, and exports the existing
  `ProveTransactionResultSchema`.
- `ProvingServiceProofProviderOptions` gained `transport?: ProveTransport`.
  When it is set the provider uses it instead of building a `ProvingService`,
  builds no `OhttpClient`, and ignores `provingServiceUrl` (may be `""`).
- `index.ts` exports `StarkscanProvingService`, `StarkscanProverError`,
  `StarkscanProvingServiceOptions` and `ProveTransport`.

The adapter lives in `onekey/starkscan-proving-service.ts` and
`onekey/starkscan-prover-error.ts` (split for `max-classes-per-file`):

- One random 32-hex-char idempotency key per `proveTransaction` call, from
  `crypto.getRandomValues` (Hermes may lack `crypto.randomUUID`). It is reused
  on every internal resubmit.
- Only submit HTTP 503 and a terminal `unavailable` job are resubmitted, with
  the SDK's own backoff (`ProvingRetryOptions`, `MAX_PROVE_BACKOFF_MS`). 429,
  401, 403, 409, 400, other 5xx and `unknown_delivery` surface at once.
- A status GET that fails with a network error, timeout, 429 or 5xx is polled
  again on the same job, up to `maxRetries` consecutive failures. Resubmitting
  there would open a second job, debit the daily budget twice and lose the
  first job's once-only result.
- Polling honours `pollAfterSeconds`, clamped to 1–30 s, default 5 s. The whole
  call, retries included, is bounded by `maxWaitMs` (default 300 s).
- Results go through `ProveTransactionResultSchema`. A `failed` job whose
  `error.source` is `"prover"` with a numeric code throws the SDK's
  `ProvingServiceError`, so `screeningErrorFromProvingError` and code-based
  mappers keep working. Everything else throws `StarkscanProverError` with
  Starkscan's `code`, `http_<status>`, or a synthesized `prover_delivery_unknown`
  / `poll_timeout` / `result_expired` / `invalid_result` / `invalid_response`.
- The request body is never logged or put in error messages.

## Lint and format exemptions

`.oxlintrc.json` and `.oxfmtrc.json` both list the vendored file set under
`ignorePatterns`:

```
packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/index.ts
packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/factory.ts
packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/interfaces.ts
packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/simple-private-transfers.ts
packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/internal/**
packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/utils/**
```

Keep `.oxfmtrc.json` comment-free: `apps/desktop/scripts/generate-desktop-api-methods.js`
reads it with `JSON.parse`, and a comment there breaks the desktop main build.
`.oxlintrc.json` is JSONC and already carries comments.

Running the repo's rules over the tree produced ~330 errors, none of them bugs:
161 `import-js(order)`, 38 `onekey(no-raw-error)`, 34 `sort-imports`, 20
`consistent-type-imports`, 12 `no-continue`, 11 `no-plusplus`, 7
`max-classes-per-file`, and so on. Fixing them would restyle the whole tree and
turn every upstream sync into a manual merge.

The exemption list is deliberately the exact upstream file set, so it doubles as
the manifest of what is vendored. **OneKey-authored files in this package are
linted and formatted normally**: `platform/**`, `onekey/**`,
`debugFlags.ts` and the `*.test.ts` files. Keep it that way when adding files.

`development/spellCheckerSkipWords.txt` gained `hpke`, `ohttp`, `dhkem` and
`panva` for the authored files' comments.

## Syncing a new upstream revision

1. Check out the new revision of `starkware-libs/starknet-privacy`.
2. `rsync -a --exclude 'testing/' <upstream>/sdk/src/ packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/`.
   Do not add `--delete`: without it the OneKey-authored `platform/**`,
   `onekey/**`, `debugFlags.ts`, the tests, `VENDOR.md` and `LICENSE` survive,
   since upstream has no files at those paths.
3. Apply the `.js`-extension strip from modification 0.
4. Re-apply modifications 1–7 and the vendored-file seam of 9 by grepping the previous revision for
   `// onekey:`. Read upstream's `CHANGELOG.md` first: the SDK is pre-1.0 with
   breaking changes per release candidate.
5. Update the provenance table and the dependency table above.
6. Re-run the verification below.

## Verification status

| Check | Result |
|---|---|
| Typecheck, repo `tsconfig.json`, deps mapped to unpacked `.d.ts` | clean |
| `oxlint packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy` | clean (vendored files ignored) |
| `oxfmt --check "packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/**/*.ts"` | clean (authored files checked, vendored files ignored) |
| `yarn jest packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy` | entry smoke + Starkscan transport tests pass |


## Open integration risks for whoever wires this into kit-bg

1. **Metro subpath resolution.** `apps/mobile/metro.config.js:152` sets
   `unstable_enablePackageExports = false`. `@panva/hpke-noble` imports
   `@noble/hashes/sha2.js`, `@noble/hashes/hkdf.js`, `@noble/hashes/sha3.js`,
   `@noble/hashes/sha3-addons.js`, `@noble/ciphers/aes.js`,
   `@noble/ciphers/chacha.js`, `@noble/curves/ed25519.js`,
   `@noble/curves/ed448.js`, `@noble/curves/nist.js`,
   `@noble/post-quantum/ml-kem.js`, `@noble/post-quantum/hybrid.js` and
   `@noble/post-quantum/utils.js`. Confirm each resolves to a physical file after
   install; if not, add entries alongside the existing `HWK_SUBPATH_ALIASES`
   block in the metro config. Not verifiable until install.
2. **`ohttp-ts` entry under Metro.** It is `"type": "module"` with
   `main: ./dist/index.cjs` and `module: ./dist/index.js`. Metro's default
   `resolverMainFields` picks `main`, i.e. the CJS build, which `require`s
   `quicvarint@0.1.6`. Confirm that resolves.
3. **Native bundle weight.** `@panva/hpke-noble` statically imports
   `@noble/post-quantum` (ML-KEM, hybrid KEMs) even though only
   DHKEM(X25519, HKDF-SHA256) is used, and Metro does not tree-shake. It also
   pulls `@noble/{curves,hashes,ciphers}` v2 alongside the v1.6/1.7 copies
   `starknet@10.8.0` pins, so those land twice.
4. **Native globals.** The OHTTP transport needs `URL` (already covered by
   `react-native-url-polyfill` in `@onekeyhq/shared`), `TextEncoder` /
   `TextDecoder` (constructed at `ohttp-ts` module evaluation), and
   `Request` / `Response` with working `arrayBuffer()`. Verify before enabling
   OHTTP on mobile.
5. **Chrome baseline for the extension.** The default WebCrypto suite needs
   X25519 in `crypto.subtle`. Check the minimum Chrome version OneKey supports
   against WebCrypto X25519 availability, or call `setHpkeSuiteFactory()` with
   the noble suite in the extension too.
6. **perf-CI attribution.** Not needed any more: the SDK sits inside kit-bg, so
   `development/perf-ci/lib/importChain.js` attributes it to `@onekeyhq/kit-bg`.
7. **`ohttp-ts` declares `engines: { node: ">=24" }`.** The repo's root
   `engines.node` is `>=22.12.0`. Only relevant to Node-side tooling, not the app
   bundles, but `yarn install` may warn.
8. **Pin discipline.** Upstream is pre-1.0 and ships breaking changes per release
   candidate, including a wholesale Sub-account → Shadow-account rename in RC.5.
   Keep this vendored revision in lockstep with the deployed pool class hash.
