# starknet-privacy SDK: integration-facing analysis

Reference: `/private/tmp/claude-501/.../scratchpad/starknet-privacy-main`, commit `b40bf109c8e5` (`chore(release): 0.14.3-rc.8`, 2026-09-15). All paths below are relative to that root.

**Two steps were blocked and not performed.** A repo hook refused reads of the demo's testnet and mainnet environment sample files and the e2e environment sample file, so deployed pool addresses and hosted endpoint URLs could not be extracted from them. Separately, I did not run `npm ci && npm run build` in `sdk/`, because the npm supply-chain gate forbids running project scripts against an unreviewed dependency tree; `dist/` size is therefore unmeasured and I give a source-size proxy instead. Package inspection used `npm pack --ignore-scripts`, which the gate permits.

---

## 1. Protocol model

**Note.** A note is a private UTXO: `{ id, amount, created, witness, sender, open? }` (`sdk/src/interfaces.ts:77-85`). The witness is `{ channelKey, nonce, r }` (`sdk/src/internal/channel.ts:185-195`). A note's identity is `compute_note_id(channel_key, token, index)` (`sdk/src/utils/hashes.ts:87-89`), and spending it publishes `compute_nullifier(channel_key, token, index, owner_private_key)` (`sdk/src/utils/hashes.ts:97-99`). The nullifier binds the owner's viewing key, so only the owner can spend.

**Channels and subchannels.** A channel is a directed sender-to-recipient lane holding a shared `channelKey` plus per-token nonce state (`sdk/src/internal/channel.ts:104-150`, `:19-22`). The key is `compute_channel_key(sender_addr, sender_private_key, recipient_addr, recipient_public_key)` (`sdk/src/utils/hashes.ts:62-64`), an ECDH-style derivation over the Stark curve. Each token gets a subchannel identified by `compute_subchannel_id(channel_key, index)` (`sdk/src/utils/hashes.ts:77-79`). Notes are indexed sequentially inside a subchannel. Readiness is a four-level enum: `Register`, `SetupChannel`, `SetupToken`, `Ready` (`sdk/src/interfaces.ts:56-65`).

**Register.** The `SetViewingKey` action derives the public key from the viewing key and writes two storage slots for the user: `public_key[user_addr]` and `enc_private_key[user_addr]` (`packages/privacy/src/privacy.cairo:319-357`). The second is the viewing key encrypted to the pool's auditor public key. Registration is therefore an on-chain key escrow to the auditor, by design. Both writes are write-once. Views `get_public_key` and `get_enc_private_key` read them back. A sender cannot open a channel unless registered and unless the supplied key matches the stored public key (`packages/privacy/src/privacy.cairo:371-375`).

**Action phases.** Actions must be ordered and may not regress: `SetViewingKey` (0), `OpenChannel` (1), `OpenSubchannel` (2), `Deposit` (3), `UseNote` (4), `CreateEncNote` / `CreateOpenNote` (5), `Withdraw` (6), `InvokeExternal` (7) (`packages/privacy/README.md:29-39`). The TypeScript union mirrors this (`sdk/src/internal/client-actions.ts:78-88`).

**Deposit, transfer, withdraw.** Deposit is a plain `TransferFrom(user_addr, token, amount)` into the pool, with no token allowlist anywhere in the contract (`packages/privacy/src/privacy.cairo:486-503`; a grep for allowlist patterns in `packages/privacy/src/*.cairo` returns nothing). Any ERC-20 works, so the wallet owns the token list. Transfer creates encrypted notes for a recipient. Withdraw moves tokens out publicly and encrypts the initiator address for the auditor (`packages/privacy/src/privacy.cairo:507-521`).

**Surplus and change.** Inputs minus outputs per token is the surplus. The compiler either routes it to a declared `surplusTo` recipient, as a private change note or a public withdrawal, or throws if a surplus exists with no surplus action (`sdk/src/internal/compiler.ts:737-766`). `surplusTo(recipient, withdraw?)` sits on both the top-level and per-token builders (`sdk/src/interfaces.ts:612`, `:733`).

**Pool addresses.** No deployed mainnet or sepolia pool address exists anywhere in the repo. The demo requires `VITE_POOL_ADDRESS` at runtime (`demo/src/config.ts:214`), and `deploy/` contains only Dockerfiles and a discovery-service config example. The only long hex constants in source are the STRK fee token (`sdk/src/utils/proof-facts.ts:33`), the virtual OS program hash (`:30`) and the shadow-account primer class hash (`sdk/src/internal/shadow-account-address.ts:15`). UNVERIFIED whether a mainnet pool is deployed at all; addresses live in the environment sample files I could not read, and in the Vercel project.

**Deposit screening is mandatory at the contract level, not optional.** `apply_actions` takes a trailing `Option<ScreeningAttestation>`. Every `TransferFrom` marks its `from_addr` as the transaction's screening subject, and if a subject exists the attestation is required or the call reverts with `SCREENING_REQUIRED` (`packages/privacy/src/privacy.cairo:784-803`, `:864-876`). The attestation is a Stark-curve signature by the pool's `screener_public_key`, valid for 300 seconds and tolerating 60 seconds of clock skew (`packages/privacy/src/privacy.cairo:921-943`; `packages/privacy/src/utils.cairo:97,99`). At most one screening subject per transaction (`MULTIPLE_SCREENING_SUBJECTS`).

The attestation is produced off-chain: the `proof-interceptor` sidecar sits beside the prover, decodes the deposit action span, and calls `elliptic-proxy`, a GCP Cloud Function fronting the Elliptic AML API, over HMAC-signed HTTP (`proof-interceptor/README.md:37`). On allow it returns a signature that the prover attaches as `additional_data.signature`, which the SDK packs into calldata (`sdk/src/internal/screening-calldata.ts:20-29`). So a deposit on a screening-enabled pool cannot be built without a cooperating prover, and the wallet has a five-minute window between proving and submission.

---

## 2. Key material

**The viewing key is a Stark-curve private key**, constrained to `[1, n/2]` where `n` is the curve order (`sdk/src/interfaces.ts:24`, `sdk/src/utils/validation.ts:24-26`; enforced on-chain by `is_canonical_key`, `packages/privacy/src/utils.cairo:270-272`).

**Derivation is the integrator's choice.** The SDK only takes a `ViewingKeyProvider` with `getViewingKey(): Promise<ViewingKey>` (`sdk/src/interfaces.ts:116-118`); it never derives one. The demo derives it deterministically from the Starknet signing key by signing the canonical message `<chainId>:<poolAddress>` with ECDSA, Poseidon-folding `(r, s)`, reducing mod the curve order, and canonicalizing into the lower half (`demo/src/session.ts:29-37`). Stark ECDSA in starknet.js is RFC-6979 deterministic, so this is reproducible without storage. This is a demo convention, not a protocol rule; a wallet may pick any derivation, but it is then permanently bound to that choice per pool per chain.

**Discovery needs the viewing key only, never the spending signer.** `DiscoveryProviderInterface` takes `(address, viewingKey, params)` on every method (`sdk/src/interfaces.ts:775-815`), and the base class forwards nothing else (`sdk/src/internal/abstract-private-transfers.ts:61-97`). Balances, notes, channels, readiness and history are all reachable with the viewing key alone. The demo ships an explicit view-only mode on that basis (`demo/README.md:123-126`).

**The signer is needed exactly once per transaction**, inside `createProofInvocation`, to sign the proof invocation (`sdk/src/internal/private-transfers.ts:62-88` calling `sdk/src/internal/proof-invocation-factory.ts:148-161`). Only `{ address, signer }` is read (`sdk/src/interfaces.ts:47-50`), so a full starknet.js `Account` is optional. The pool validates that signature on-chain against the user's own account, trying SRC5 custom validation, then standard SNIP-6 `is_valid_signature` over the tx hash, then a legacy SNIP-12 `CallSet` hash (`packages/privacy/src/utils.cairo:385-420`).

**Two secrets leak to operators, and this is the single most important design fact.**

- The proving service receives the raw viewing key. The proof invocation's calldata is `compile_actions(user_addr, user_private_key, actions)` (`sdk/src/internal/proof-invocation-factory.ts:132-136`), and the ABI names the second argument `user_private_key` (`sdk/src/internal/abi.ts`, `compile_actions` entry). That invocation is posted verbatim to `starknet_proveTransaction` (`sdk/src/internal/proving-service.ts:282-293`).
- The discovery service also receives it, as a plaintext JSON field `viewing_key` on `/v1/sync/incoming_state`, `/v1/sync/outgoing_state` and `/v1/sync/preflight_check` (`sdk/src/internal/indexer-discovery.ts:162`, `:316`, `:378`). The service README confirms the model: "Per-request decryption keys: keys provided per request, never stored" (`crates/discovery-service/README.md:16`).

OHTTP encrypts these payloads to the gateway and hides the client IP from it, but the gateway is the service itself and decrypts them. The viewing key is confidential from the network, not from the operator.

**The local-only alternative exists.** `ContractDiscoveryProvider` reads pool storage over plain Starknet RPC and decrypts on device (`sdk/src/internal/contract-discovery.ts:67-68`, `:107`). All note and channel crypto is pure JS over `ec.starkCurve` from starknet.js, using `getSharedSecret` and Poseidon (`sdk/src/utils/encryptions.ts:132,163,377,400`). The SDK README calls this provider development-grade (`sdk/README.md:215`), and it bisects and scans per channel, so cost is many RPC round trips.

**Shadow accounts** are deterministic per-dapp contract addresses derived from `hash(compute_identity_key(user, viewingKey, anonymizer), dappName)` then `hash(partial, nonce)`, salted into a `deploy_from_zero: false` address off a fixed primer class hash (`sdk/src/internal/shadow-account-address.ts:24-60`, `sdk/src/utils/hashes.ts:27-29`). They need no extra key material beyond the viewing key, and are computed offline (`sdk/src/internal/shadow-accounts.ts:79-90`). They are only reachable when `shadowAccountAnonymizerAddress` is configured (`sdk/src/internal/builders.ts:226-240`). Out of scope for a first integration.

---

## 3. SDK public API surface

Everything below is from `sdk/src/index.ts:1-58`.

**Factory.** `createPrivateTransfers(params: CreatePrivateTransfersParams): PrivateTransfersInterface` (`sdk/src/factory.ts:91-93`). Params are `account: { address, signer }`, `viewingKeyProvider`, `provingProvider` (instance or `{ url, chainId, requestTimeoutMs?, blockIdentifier?, nodeUrl?, ohttp?, retry? }`), `discoveryProvider` (instance or `{ url }`), `poolContractAddress`, optional `proofInvocationFactory` and `shadowAccountAnonymizerAddress` (`sdk/src/factory.ts:35-55`, `sdk/src/interfaces.ts:124-155`).

**Builder chain.**

- `build(options?: ExecuteOptions): PrivateTransfersBuilder` (`sdk/src/interfaces.ts:515`).
- `.register(): this` (`:703`), `.setup(recipient): this` (`:706`), `.surplusTo(recipient, withdraw?): this` (`:733`), `.with(token)` or `.with(token, ops)` (`:736-738`), `.invoke(callBuilder)` (`:709`), `.computeAndInvoke(callBuilder)` (`:717`), `.shadowAccounts(dappName)` (`:726`).
- Token builder: `.setup(recipient)`, `.inputs(...notes)`, `.deposit(...{recipient?, amount})`, `.withdraw(...{recipient?, amount})`, `.transfer(...{recipient, amount | Open})`, `.surplusTo(recipient, withdraw?)`, `.done()` (`sdk/src/interfaces.ts:585-630`).
- Terminals on both: `.execute(options?)`, `.createProofInvocation(options?)`, `.simulate({ node, validateSignature? })`.

**ExecuteOptions** (`sdk/src/interfaces.ts:324-339`): `autoRegister`, `autoDiscover: { notes?: "missing"|"refresh"|"all", channels?: "missing"|"refresh" }`, `autoSetup`, `autoSelectNotes: "all"|"naive"`, `registry`, `registryConst`, `provingBlockId`.

**Discovery.**

- `discoverNotes(params?: { cursor?, tokens?, blockIdentifier? }): Promise<{ timestamp, notes: AddressMap<Note[]> }>` (`sdk/src/interfaces.ts:459-466`).
- `discoverChannels(recipients: "all" | "total-only" | address[], params?: { cursor?, blockIdentifier? }): Promise<{ timestamp, channels?, total? }>` (`:471-474`).
- `discoverRequirement(recipient, token): Promise<SetupRequirement>` (`:450-453`).
- `IndexerDiscoveryProvider(apiUrl, contractAddress, options?: { ohttp })`, plus `isHealthy()`, `getHealth()` and `fetchHistory(userAddress, notesCursor, channelCursor, options?)` (`sdk/src/internal/indexer-discovery.ts:108-121`, `:123-134`, `:388-415`). Note that `fetchHistory` is not on `DiscoveryProviderInterface`, only on the concrete indexer class.
- `ContractDiscoveryProvider(poolContract, { rateLimit? })` (`sdk/README.md:218`).

**Proving.** `ProvingServiceProofProvider(url, chainId, options)` implementing `getDefaultDetails()`, `prove(invocation, blockIdentifier?)`, `invalidateNonceCache()` (`sdk/src/internal/proving-service-provider.ts:61-140`). Lower-level `ProvingService` with `proveTransaction`, `getSpecVersion`, `isHealthy` (`sdk/src/internal/proving-service.ts:190-315`). `OhttpClient(gatewayUrl, { relayUrl?, publicKeyConfig? })` (`sdk/src/internal/ohttp-client.ts:51-59`).

**History.** `buildHistoryCursor`, `classifyTransaction(tx, options?)` producing actions of type `deposit | withdrawal | fee | transferSent | transferReceived | swap | transferSelf | register` (`sdk/src/internal/action-classifier.ts:8-22`).

**Errors and misc exports.** `ProvingService`, `ProvingServiceError`, `ProvingServiceHttpError`, `ScreeningRejected`, `ScreeningUnavailable`, `screeningErrorFromProvingError`, `AddressMap`, `SimplePrivateTransfersImpl`, `ShadowAccountAnonymizerABI`, `PRIMER_CLASS_HASH`, `shadowAccountAddress`, `shadowAccountCommitment`, `shadowAccountPartialCommitment`, plus the `Open` / `All` markers and `createEmptyRegistry` re-exported through `./interfaces.js`.

**Answer to the key question: `execute()` does not submit anything.** It returns `ExecuteResult = { callAndProof, registry, warnings }` (`sdk/src/interfaces.ts:362-368`). `callAndProof.call` is a plain starknet.js `Call` to the pool's `apply_actions` entry point, assembled at `sdk/src/internal/private-transfers.ts:125-134`. Grepping `sdk/src` outside `testing/` finds no `account.execute`, no `waitForTransaction` and no `invokeFunction`. The wallet keeps full custody of submission. The split is even cleaner than that: `createProofInvocation(actions, options)` returns the signed invocation without proving, and `executeWithInvocation(invocation, provingBlockId)` proves it (`sdk/src/interfaces.ts:495-506`). That is exactly the seam a background/UI split wants.

Submission requires passing the proof alongside the call. The demo does `account.execute(callAndProof.call, { tip: 0n, proofFacts, proof })` (`demo/src/hooks/useTransactions.ts:152-160`), and starknet.js 10.5.0 supports `proofFacts` and `proof` on `UniversalDetails` and in `calculateInvokeTransactionHash` (verified in the published `starknet@10.5.0` type declarations). Paymaster submission is equally supported, see section 6.

`simulate({ node })` swaps in a `CallMockProofProvider` that calls the pool view directly, producing identically shaped calldata for fee estimation without a real proof (`sdk/src/internal/private-transfers.ts:139-156`).

---

## 4. Runtime network dependencies

Four endpoints, all wallet-supplied:

| Dependency | Protocol | Notes |
|---|---|---|
| Starknet RPC | JSON-RPC | Balances, block numbers, receipts, and the optional pool nonce fetch |
| Discovery service | HTTP POST `/v1/sync/*`, `/v1/history`, `GET /health`, `GET /ohttp-keys` | Receives the viewing key |
| Proving service | JSON-RPC `starknet_proveTransaction` | Receives the viewing key |
| OHTTP relay (optional) | HTTP POST | Hides client IP from the two services above |

No hosted URLs are committed. They are environment-only (`demo/README.md:52-54`, `demo/DEPLOY.md:38-40`), and the Vercel deployment proxies them through `/api/*` paths.

**Latency and retries.** Proving is about 4 seconds (`sdk/README.md:149-150`). Default prove timeout 30s per attempt, with 3 retries at 1s/2s/4s backoff capped at 30s, retrying only JSON-RPC `-32005` service-busy and, on the plain-fetch transport, HTTP 503 (`sdk/src/internal/proving-service.ts:12-28`, `:265-276`, `:317-326`). Discovery health checks use an 8s abort (`sdk/src/internal/indexer-discovery.ts:422`). The client-side rate limiter is a simple concurrency gate defaulting to 8, used only by `ContractDiscoveryProvider` (`sdk/src/utils/rate-limiter.ts:6-13`).

**OHTTP key config.** The client fetches `GET /ohttp-keys` and caches for one hour, or uses a pinned `publicKeyConfig` blob and never fetches (`sdk/README.md:862-887`, `sdk/src/internal/ohttp-client.ts:132-161`). It parses the RFC 9458 section 3.2 list format via `KeyConfig.parseMultiple`.

**The 10-block rule, as concrete wallet state requirements** (`sdk/README.md:124-198`):

1. The prover reads finalized state and must not be pointed at `pre_confirmed`.
2. The sequencer accepts a proof only when its `base_block` is at least 10 blocks older than the submission block (upstream README: "at least 10 blocks older than the submission block"). That 10 is a minimum depth, not an expiry. The upper bound is the contract's `proof_validity_blocks`, a governable value the demo defaults to 450 (`packages/privacy/src/privacy.cairo:834-837`; `demo/src/config.ts:217`). So a slow prover, such as Starkscan's queued jobs, only makes the base block older, which the sequencer accepts until that upper bound.
3. After every accepted private transaction, persist `lastTxBlockNumber = receipt.block_number` and block the next private transaction until `latestBlock - lastTxBlockNumber >= 10`.
4. The same wait applies after any transparent transaction the proof will read: the account deploy before `register`, and the ERC-20 top-up before `deposit` (`sdk/README.md:176-177`).
5. Prove at `latestBlock - 9` and pass it as `provingBlockId`, which the compiler also forwards to discovery so proving and discovery see one state (`sdk/README.md:168`). The demo uses depth 9 (`demo/src/hooks/useTransactions.ts:94-113`).
6. For paginated discovery used to build a transaction, pin a block hash, not a tag. Only a hash gives cross-page consistency and reorg detection (`sdk/README.md:564-568`).

This is a hard UX constraint: roughly 20 to 30 seconds of forced waiting between consecutive private transactions, on top of proving.

---

## 5. Dependencies and packaging

**Declared dependencies** (`sdk/package.json:73-79`): `starknet@10.5.0` (exact pin), `ohttp-ts@^0.3.0`, `zod@^3.24.0`, `@starknet-io/starknet-types-0101` (alias of `@starknet-io/types-js@~0.10.2`), and `starknet-devnet@^0.7.2`. The last one is a test harness shipped as a runtime dependency, and it pulls `axios` and `decompress`. That is dead weight in a wallet bundle and should be excluded or stripped.

**`hpke` is a phantom dependency.** `sdk/src/internal/ohttp-client.ts:9` imports `CipherSuite`, `KEM_DHKEM_X25519_HKDF_SHA256`, `KDF_HKDF_SHA256` and `AEAD_AES_128_GCM` from `hpke`, but `hpke` is not in `sdk/package.json` (grep count is zero). It resolves only because `ohttp-ts` depends on `hpke@1.0.6` (lockfile confirmed). Under Yarn PnP or strict hoisting this breaks. Add it explicitly.

**Node >= 24** is required by `ohttp-ts` (`sdk/README.md:25`, and `engines: { node: ">=24" }` in the published `ohttp-ts@0.3.0` manifest). `starknet@10.5.0` requires Node >= 22. The repo's `.tool-versions` pins `nodejs 24.0.2`.

**Exactly what WebCrypto is needed, and only for OHTTP.** The pool's own cryptography uses `ec.starkCurve` from starknet.js, which is noble under the hood, pure JS, no WebCrypto. The OHTTP path with the SDK's hardcoded suite needs, via `hpke@1.0.6`:

- `crypto.subtle.generateKey({name:"X25519"}, ...)`, `importKey("raw" | "jwk")`, `exportKey("raw" | "jwk")`, `deriveBits({name:"X25519", public})` for the KEM (`hpke/index.ts:2724-2790`).
- `crypto.subtle.importKey("raw", ..., {name:"HMAC", hash:"SHA-256"})` and `sign("HMAC", ...)` for HKDF-SHA256 (`hpke/index.ts:2332-2366`).
- `crypto.subtle.encrypt` / `decrypt` with `AES-GCM` and a raw 128-bit key (`hpke/index.ts:3543-3576`, `:3602-3614`).
- `crypto.getRandomValues` separately, in `sdk/src/utils/crypto.ts:88`.

`ohttp-ts` itself also calls `crypto.subtle.importKey` / `sign` for HKDF directly in its bundled dist (`ohttp-ts/dist/index.js:1957-1975`), and uses `Request`, `Response`, `Headers`, `ReadableStream`, `TransformStream`, `TextEncoder` and `TextDecoder`.

Browser and extension: fine per the hpke runtime matrix, which marks DHKEM(X25519, HKDF-SHA256), HKDF-SHA256 and AES-128-GCM all supported in browsers (`hpke/README.md:92-127`). UNVERIFIED which minimum Chrome version ships WebCrypto X25519; that gates the extension target and should be checked against the Chrome baseline before committing.

React Native with Hermes: no. There is no `crypto.subtle` at all, so every call above fails. There is a clean escape hatch though. `hpke` accepts custom KEM, KDF and AEAD implementations conforming to its interfaces, and `@panva/hpke-noble` ships pure-JS versions of exactly these three (`hpke/README.md:76-85`). `ohttp-ts` already lists `@panva/hpke-noble` in its own devDependencies. The blocker is that the SDK hardcodes the suite at `sdk/src/internal/ohttp-client.ts:159`, so swapping requires a patch, a fork, or reimplementing `OhttpClient` and passing our own discovery and proving providers.

**Other React Native hazards in SDK source**, all outside `testing/`:

- `require("async_hooks")` at `sdk/src/utils/logging.ts:30`. It is guarded by `typeof window === "undefined"`, which is false in React Native, so it will not execute. But Metro collects the static string at bundle time and will fail to resolve it without an alias or empty shim.
- `AbortSignal.timeout` at `sdk/src/internal/proving-service.ts:236` and `sdk/src/internal/indexer-discovery.ts:422`. Needs a polyfill on older Hermes.
- `new Request(...)`, `response.body.pipeThrough`, `new DecompressionStream(...)` and `new Response(stream)` in `sdk/src/internal/ohttp-client.ts:67,76,191,192`. React Native's fetch has no streaming response body. This is OHTTP-only.
- `crypto.getRandomValues` at `sdk/src/utils/crypto.ts:88`, plus noble's `randomPrivateKey()`. Needs `react-native-get-random-values`, which OneKey already ships for other chains.

Crucially, `sdk/src/internal/ohttp-client.ts` is statically imported by both `indexer-discovery.ts:15` and `proving-service-provider.ts:17`, so `ohttp-ts` and `hpke` load even when OHTTP is off. The module graph must resolve on every platform regardless.

**Browser bundle.** `sdk/package.json:22-29` exports `./browser` pointing at `dist/browser/starknet-sdk.js` and `.min.js`, built by esbuild with `bundle: true`, `format: "esm"`, `platform: "browser"`, `target: "es2020"`, `external: []` (`sdk/scripts/build-browser.ts:23-38`). It inlines starknet.js and everything else, and defines `process.env.SDK_DEBUG` and friends as `undefined`. There is no `react-native` export condition.

**No WASM anywhere.** `find . -name '*.wasm'` returns nothing. `artifacts/` holds only `Primer.contract_class.json` and `Primer.compiled_contract_class.json`, used by Cairo deployment, not loaded by the SDK. The SDK is pure TypeScript.

**Size proxy**, since I did not build: SDK source outside `testing/` is 344 KB, of which 70 KB is two generated ABI files (`abi.ts` 49 KB, `anonymizer-abi.ts` 21 KB). `starknet@10.5.0` ships a 478 KB ESM bundle. `ohttp-ts` dist is 104 KB and `hpke` is 63 KB. A browser bundle in the 700 KB to 900 KB unminified range is the expectation, dominated by starknet.js.

---

## 6. Demo app wiring

The demo is a Vite React SPA, and it is the closest thing to a wallet reference.

**Wiring.** `createTransfers` builds the discovery provider, picks the real prover when `VITE_PROVING_SERVICE_URL` is set or a mock `execute_view` prover otherwise, and passes a closure returning the viewing key (`demo/src/starknet.ts:68-89`). OHTTP is configured three ways: off, gateway-direct with an optional pinned key config, or gateway plus relay when a separate backend URL is set (`demo/src/starknet.ts:35-50`). The RPC provider is created with `blockIdentifier: PRE_CONFIRMED` so nonces match the pre-confirmed wait states (`demo/src/starknet.ts:52-57`).

**Key handling.** Accounts are pasted as JSON with `address` plus either `privateKey` or `viewingKey`. On mainnet nothing touches `localStorage` and the share-URL feature is removed (`demo/README.md:105-112`, `demo/DEPLOY.md:26-29`). OHTTP is forced on for mainnet with an explicit rationale: without the relay layer a passive observer at the backend correlates the viewer's address with their encrypted notes (`demo/src/App.tsx:75-83`).

**UI states.** Three views: `actions`, `builder`, `defi` (`demo/src/App.tsx:303`). The action panel exposes Register, Mint (testnet admin only), Deposit, Withdraw and Transfer, each disabled when the account is view-only with a "View-only" tooltip (`demo/src/components/ActionPanel.tsx:59-66`, `:126-129`). Registration status comes from `discoverRequirement !== SetupRequirement.Register` (`demo/src/hooks/usePrivateState.ts:141`). A service health bar polls discovery, RPC, prover, gateway and feeder gateway every 30 seconds (`demo/src/hooks/useServiceHealth.ts:22-60`).

**Transaction pipeline** (`demo/src/hooks/useTransactions.ts:116-172`): optionally fetch a paymaster fee quote, add a dust withdrawal to the fee recipient, wait for the proving block, `createProofInvocation({ provingBlockId })`, `executeWithInvocation`, then submit either through the paymaster or through `account.execute(call, { tip: 0n, proofFacts, proof })`, then wait for the receipt and record its block number. Wait states accept `PRE_CONFIRMED`, `ACCEPTED_ON_L2` and `ACCEPTED_ON_L1` (`demo/src/starknet.ts:26-33`).

**Paymaster.** AVNU exposes purpose-built transaction types for this pool: `paymaster_buildTransaction` with `type: "apply_action"` or `"invoke_and_apply_action"`, and `paymaster_executeTransaction` taking the `apply_actions` call, the proof and the proof facts (`demo/src/paymaster.ts:69-135`). Fee mode is `sponsored_private`. This matters twice: it hides the submitting address, and it means the paymaster forwarder, not the user account, pays the pool's protocol fee.

**Protocol fee.** `apply_actions` pulls `fee_amount` STRK from the caller before applying anything (`packages/privacy/src/privacy.cairo:845-856`). Without a paymaster, the user account must approve STRK to the pool for that amount on top of any deposit allowance; the demo folds it into the deposit approve when depositing STRK, and otherwise issues a separate approve transaction (`demo/src/hooks/useTransactions.ts:44-84`, `:331-356`). The amount and collector are read once from `get_fee_amount()` and `get_fee_collector()` (`demo/src/config.ts:249-269`).

**Reads.** `usePrivateState` fires `discoverNotes`, `discoverChannels("all")`, `discoverRequirement` and per-token `balance_of` in parallel, all at `blockIdentifier: "pre_confirmed"`, then folds notes into per-token private balances (`demo/src/hooks/usePrivateState.ts:121-162`).

**Config keys**: `VITE_RPC_URL`, `VITE_INDEXER_URL`, `VITE_PROVING_SERVICE_URL`, `VITE_POOL_ADDRESS`, `VITE_POOL_CLASS_HASH`, `VITE_COMPLIANCE_PUBLIC_KEY`, `VITE_CHAIN_ID`, `VITE_TOKENS`, `VITE_PROOF_VALIDITY_BLOCKS`, `VITE_OHTTP_KEY_CONFIG`, plus optional Ekubo, Vesu and paymaster groups (`demo/README.md:50-77`, `demo/src/config.ts:211-239`). The pool address itself is environment-only, so it is not recoverable from the repo.

---

## 7. Failure modes and UX facts

**Error classes.** `ReorgError` for HTTP 409 `BLOCK_REORGED`; `ScreeningRejected` for a terminal sanctions verdict; `ScreeningUnavailable` for a transient screening failure (`sdk/src/internal/errors.ts:4-36`). `ProvingServiceError` carries a numeric JSON-RPC code, documented as 24 block-not-found, 55 account-validation-failed, 61 unsupported-version, 1000 invalid-input, -32005 busy, -32603 internal, 10000 rejected (`sdk/src/internal/proving-service.ts:32-58`). `ProvingServiceHttpError` carries the HTTP status. `sdk/src/utils/error-decoder.ts` decodes Cairo revert strings and selectors for display.

**Screening mapping is deliberately narrow.** `screeningErrorFromProvingError` maps only the exact reasons `address_blocked`, `screening_unavailable` and `screening_policy_unavailable`. Code 10000 is overloaded, so other reasons such as `multiple_screening_subjects`, `unknown_delegated_depositor`, `undeposited_open_notes` and `shadow_account_undetermined` are left unmapped on purpose, because surfacing them as `ScreeningRejected` would wrongly tell a user they are sanctioned (`sdk/src/internal/errors.ts:38-83`). Wallet copy must respect that distinction.

**Reorg.** The SDK self-heals once: on `ReorgError` during compile it clears the registry's notes, channels and cursor, then retries from scratch (`sdk/src/internal/compiler.ts:98-114`). A second reorg propagates. The trigger is the 409 from discovery, detected on both the plain and OHTTP transports (`sdk/src/internal/ohttp-client.ts:103,119`). The discovery service operates on soft finality at `ACCEPTED_ON_L2` and expects clients to reindex from scratch (`crates/discovery-service/README.md:18`).

**Proof rejection.** On-chain `apply_actions` validates the proof facts before doing anything: non-empty facts, `VIRTUAL_SNOS` program variant, `VIRTUAL_SNOS0` output version, `base_block_number < current_block`, `current_block <= base_block + proof_validity_blocks`, and a message hash matching the action span (`packages/privacy/src/privacy.cairo:808-843`). The corresponding errors are `EMPTY_PROOF_FACTS`, `PROOF_FACTS_DESERIALIZE_ERROR`, `INVALID_PROOF_FACTS`, `INVALID_PROGRAM_VARIANT`, `INVALID_OS_OUTPUT_VERSION`, `INVALID_BASE_BLOCK_NUMBER`, `PROOF_EXPIRED`, `INVALID_PROOF_MSG` (`packages/privacy/README.md:65-75`).

**Stale nonce.** The proving provider caches the pool nonce when configured with `nodeUrl`, and `invalidateProofNonceCache()` clears it before a retry (`sdk/src/internal/proving-service-provider.ts:101-116`, `sdk/src/interfaces.ts:508-512`). By default the nonce is hardcoded to 0 and no chain read happens (`sdk/src/internal/proof-invocation-factory.ts:33`).

**`pre_confirmed`.** Recommended for balances, history and any read-only view, on one precondition: the wallet must already handle reorgs on transparent balances. Never for proving (`sdk/README.md:94-113`). Paginated discovery at `pre_confirmed` may see the block advance mid-pagination, which is acceptable for a balance and not for a transaction.

**Optimistic registry.** Every `execute()` returns a registry reflecting the compiled actions. If the transaction succeeds, use it directly and skip a discovery round trip, then replace it with fresh discovery before the next build (`sdk/README.md:114-122`). The README's overall recommendation is to go stateless: full refresh on every execute, and graduate to cursors only past several thousand notes per account (`sdk/README.md:72-92`).

**History.** `fetchHistory` returns paginated `HistoryTransaction[]` with notes, deposits, withdrawals and open-note deposits, plus a synthetic registration transaction at the end (`sdk/src/internal/history.ts:53-68`). It requires notes and channels to be discovered first. Three documented gaps matter for UX: bundled multi-user deposits are filtered out by `user_address`; notes above the cursor or block bound are skipped silently; and withdrawals cannot be attributed to an initiator because `user_addr` is encrypted, so an unrelated withdrawal sharing a transaction with your notes will appear in your history (`sdk/README.md:616-624`). As of RC.8 a page may return zero transactions with `historyComplete: false`, or more than `maxTransactions`, so the wallet must paginate until `historyComplete` is true (`sdk/CHANGELOG.md:7-11`). `maxTransactions: 0` is rejected with 400.

**Warnings.** Exactly one code exists, `USER_LINKAGE`, raised when a single transaction opens more than one channel (`sdk/src/internal/compiler.ts:144-153`). Worth surfacing, since it is a privacy-leak signal.

---

## 8. Security notes affecting wallet design

`docs/SECURITY.md` is a 16-line vulnerability-disclosure policy with nothing design-relevant. `docs/audit/README.md` records one audit: OpenZeppelin, Privacy contracts V1, commit `c5e2fb5`, 2026-05-29, report at `docs/audit/Privacy V1.pdf` (not read; binary PDF).

The design-relevant security material is in the SDK and service READMEs and the Cairo source:

- Never prove against `pre_confirmed`; the prover requires finalized state (`sdk/README.md:106`).
- Submit ideally through a paymaster to avoid leaking the sender (`README.md:7`).
- OHTTP does not authenticate the gateway. The key config fetched from `/ohttp-keys` is trust-on-first-use. Always use HTTPS, and pin `publicKeyConfig` in production (`sdk/README.md:932-941`). The SDK warns at construction if the URL is plain HTTP with no pinned config.
- The relay hides client IP from the discovery service but still sees request and response sizes and timing (`sdk/README.md:899-903`).
- Registration escrows the viewing key on-chain, encrypted to the auditor public key (`packages/privacy/src/privacy.cairo:331-336`). Users should be told.
- Withdrawals also encrypt the initiator address to the auditor (`packages/privacy/src/privacy.cairo:518-521`).
- The pool is pausable, upgradeable via a replaceability component, and reentrancy-guarded; `apply_actions` and `deposit_to_open_note` both require unpaused (`packages/privacy/README.md:47-52`). A wallet should surface a paused pool rather than letting transactions revert.
- The proof-interceptor's worst failure mode is silent pass-through when `SCREENING_URL` is unset, and the prover's `blocking_check_fail_open` defaults to true, so an inconclusive screen still yields a proof unless the deployment overrides it (`proof-interceptor/README.md:120-124`). This is an operator concern, but it shapes how much the wallet should trust a successful deposit as "screened".
- The screening attestation is a separately deserialized calldata parameter, not part of the proof-committed action span, so it can in principle be refreshed without re-proving (`sdk/src/internal/screening-calldata.ts:1-9`). The SDK exposes no API for that refresh today.

---

## 9. Licensing and publish status

Apache 2.0 at the repo root (`LICENSE`, `README.md:5`, `README.md:103-105`). Note a discrepancy: `sdk/package.json:72` declares `"license": "ISC"`. Worth resolving with StarkWare before vendoring, since ISC and Apache 2.0 differ on patent grant and attribution.

`npm view @starkware-libs/starknet-privacy-sdk version` returns HTTP 404 on the public registry. `publishConfig.registry` is `https://npm.pkg.github.com` (`sdk/package.json:35-37`), and the README's install instructions require authenticating to GitHub Packages with a token, or installing straight from a git commit: `npm install "starkware-libs/starknet-privacy#<commit-sha>"` (`sdk/README.md:38-48`).

Implication for OneKey: a GitHub Packages token in CI is a non-starter for a public repo, and a git-URL dependency would pull the whole monorepo including Rust and Cairo. Vendoring the built `sdk/dist` or the `src/` tree is the realistic path.

For context, OneKey has no Starknet support today: there is no `strk` directory under `packages/core/src/chains/` and no `starknet` entry in any `package.json` in the worktree, so there is no existing starknet.js pin to reconcile.

Transitive versions worth noting: `ohttp-ts` latest on npm is 0.6.0 while the SDK pins 0.3.0; `hpke` latest is 1.1.7 while the lockfile resolves 1.0.6.

---

## Wallet integration implications, ranked by impact

1. **The viewing key reaches two operator-run services in plaintext, on every balance refresh and every transaction.** This is a product and legal decision before it is an engineering one. It must be disclosed, and it determines whether OneKey can run this at all with third-party infrastructure (`sdk/src/internal/indexer-discovery.ts:162`, `sdk/src/internal/proof-invocation-factory.ts:132-136`).

2. **Registration writes the viewing key on-chain, encrypted to the pool's auditor.** Not recoverable, not revocable, write-once (`packages/privacy/src/privacy.cairo:331-350`). The onboarding flow needs explicit consent copy.

3. **Deposits are hard-gated on an off-chain AML attestation with a 300-second lifetime.** No attestation means an on-chain revert with `SCREENING_REQUIRED` (`packages/privacy/src/privacy.cairo:793-801`, `packages/privacy/src/utils.cairo:97`). Build the deposit flow around a five-minute prove-to-submit budget, and map `ScreeningRejected` versus `ScreeningUnavailable` to different user-facing copy.

4. **The signing seam is already where we want it.** `createProofInvocation` needs the signer, `executeWithInvocation` needs the network, and nothing submits. Keep signing in the OneKey keyring, run the SDK in `bg`, and return `callAndProof` to the submission layer (`sdk/src/interfaces.ts:495-506`).

5. **React Native cannot run the OHTTP path as shipped, and OHTTP is exactly what makes this private on mobile.** The suite is hardcoded at `sdk/src/internal/ohttp-client.ts:159`. Plan on a patch swapping in `@panva/hpke-noble`, or our own `OhttpClient`. Budget this as real work, not a polyfill.

6. **Consecutive private transactions cost roughly 20 to 30 seconds of forced waiting.** The wallet must persist `lastTxBlockNumber` per account per pool, and apply the same wait after account deploy and after any funding transfer (`sdk/README.md:124-198`). Design the UI for it up front rather than retrofitting a spinner.

7. **The package is not on npm.** Vendoring `sdk/src` or `sdk/dist` is the practical route, and the Apache 2.0 versus ISC discrepancy should be settled with StarkWare first (`sdk/package.json:35-37`, `:72`).

8. **Split-runtime targets need the viewing key in `bg` and never in `main`.** Discovery, proving and signing all live in `bg`. Since discovery needs only the viewing key, a view-only mode falls out for free, which is a genuine product feature.

9. **`starknet-devnet` is a declared runtime dependency and `hpke` is an undeclared one.** Fix both before bundling: drop the first, add the second (`sdk/package.json:73-79`).

10. **Metro will try to resolve `require("async_hooks")` from `sdk/src/utils/logging.ts:30`.** Alias it to an empty module. Also polyfill `AbortSignal.timeout` and confirm `crypto.getRandomValues` coverage.

11. **Pool addresses and service endpoints are not in the repo and must be obtained from StarkWare.** They are the one hard blocker on a working integration, and no amount of code reading substitutes.

12. **Go stateless first.** Full refresh on every execute, no persisted registry, no cursor storage. The README is explicit that cursors only pay off past several thousand notes and that premature incrementalism causes cursor drift and stale-channel bugs (`sdk/README.md:72-92`).

13. **The paymaster path is first-class and worth targeting early.** AVNU has dedicated `apply_action` transaction types, and using it both hides the sender and removes the separate STRK fee approval the user would otherwise need (`demo/src/paymaster.ts:69-135`).

14. **History is anchored on notes, so it is incomplete by construction.** Withdrawals cannot be attributed to an initiator, and unrelated ones can appear in a user's feed (`sdk/README.md:616-624`). Do not present it as an authoritative ledger, and paginate until `historyComplete`.

15. **The SDK is pre-1.0 with breaking changes per release candidate**, including a wholesale Sub-account to Shadow-account rename in RC.5 (`sdk/CHANGELOG.md:97-118`). Pin an exact version, and keep the pin in lockstep with the deployed pool class, since ABI drift also silently disables deposit screening on the operator side (`proof-interceptor/README.md:123`).
