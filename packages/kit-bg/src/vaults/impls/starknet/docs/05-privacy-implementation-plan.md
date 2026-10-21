# STRK20 privacy on the Starknet Phase 1 vault — implementation plan

Date 2026-09-18. Worktree `/Volumes/DevVault/Dev/Workspaces/Orca/feat-support-starknet`,
branch `feat-support-starknet` on `x` @ d0fd2046e3. Every `path:line` below is this
worktree unless marked `[zcash-ref]` (= `origin/feat/zcash-integration`, reference only,
never imported).

Given, not re-opened: no OneKey-hosted prover/discovery; endpoints from remote config;
per-account opt-in behind an informed-consent dialog then a register tx; viewing key only
in `bg`; signer stays in the keyring; stateless discovery; paymaster later.

Platform framing per CLAUDE.md: the feature is **bg-only**. On iOS/Android/ext, `main` and
`bg` are separate JS heaps, so the viewing key, the SDK instance and the note registry
exist once, in `bg`; `main` sees only non-secret DTOs. On desktop/web it is one runtime, so
"never return a viewing key from a `@backgroundMethod()`" is a code rule, not a guarantee.

---

## 0. Hard gates before any of this ships

**G1 — endpoints. HALF RESOLVED (2026-10-15), mainnet only.** StarkNet now hosts mainnet
discovery at `https://discovery.nodes.starknet.org` with a pinned OHTTP key config (both in
`docs/02`, prefilled in `STRK20_PRIVACY_FALLBACK_CONFIG` with `enabled: false`, and verified
live on 2026-10-15 with an OHTTP round trip through the vendored SDK). Mainnet
proving is Starkscan's REST prover; the adapter now exists in the vendored SDK
(`StarkscanProvingService`), so the only remaining blocker is the API key in remote config. There is
no Sepolia infrastructure and OneKey will not run any, so Sepolia privacy stays off for good.
Pool addresses and auditor/screener keys are live-verified (same table, rows 1-7).

**G2 — RPC spec version. RESOLVED, one-line change.** `proof` on
`starknet_addInvokeTransaction` needs RPC 0.10.1+
(`@starknet-io/types-js/dist/types/api/components.d.ts:706-707`), while Phase 1 defaults point
at `/rpc/v0_9` (`sdkStarknet/consts.ts:31-36`) where Sepolia genuinely serves `0.9.0`. Probed
today: `api.cartridge.gg/x/starknet/sepolia/rpc/v0_10` returns `0.10.2`, and mainnet returns
`0.10.2` on every path. Move both defaults to `/rpc/v0_10` and re-verify the field-parity claim
in the comment at `consts.ts:18-30`.

**G3 — starknet.js. NOT a blocker.** `starknet@10.8.0` (`node_modules/starknet/package.json:3`)
carries `proofFacts`/`proof` at every layer we touch: `Invocation` (`dist/index.d.ts:763-767`),
`V3TransactionDetails` and `UniversalDetails` (`:787-790`, `:2414-2416`), and both
`calculateInvokeTransactionHash` forms — the args-object `CalcV3InvokeTxHashArgs.proofFacts?`
(`:6985`) and the positional overload (`:7302`). RPC-side, `INVOKE_TXN_V3.proof_facts?` and
`BROADCASTED_INVOKE_TXN = INVOKE_TXN_V3 & { proof? }` (`components.d.ts:801-818`, `:706-707`).
It also ships `WalletAccountV6` with the dApp-facing SNIP-36 surface (`dist/index.d.ts:6303-6389`),
which fixes the eventual provider contract though we do not implement it now.

**G4 — pool version skew.** Mainnet pool runs `get_version() = 2.0`, Sepolia `2.1`, and
the vendored SDK's tests assert `2.1` (`docs/02-strk20-deployment-facts.md`, row 4 and
Notes §1). Ship Sepolia first; treat mainnet as unverified until StarkWare confirms.

---

## 1. Background service

### 1.1 Recommendation: a service; the vault keeps two small seams

Build `packages/kit-bg/src/services/ServiceStarknetPrivacy.ts`, not a `Vault` extension.
The work is cross-cutting in ways `VaultBase` has no vocabulary for: `servicePassword`
prompting (`ServicePassword/index.ts:1266-1277`), a simpleDb entity, a backend config fetch
through `ServiceBase.getClient` (`ServiceBase.ts:53-57`), and a long-lived secret cache
cleared on lock. Vaults are per-`(networkId, accountId)` instances built on demand
(`ServiceSend.ts:145`) — the wrong lifetime for a cached viewing key. The vault keeps
everything chain-shaped it already owns: `getClient()` (`Vault.ts:166-170`),
`buildUnsignedTx`, which already accepts a pre-built encodedTx (`:454-472`),
`updateUnsignedTx` fee round-trip (`:474-513`), `buildDecodedTx` (`:515-566`),
`broadcastTransaction` (`:986-991`), `_broadcast` (`:1013-1050`), `estimateFee` (`:871-919`)
and `fetchTokenList` (`:685-723`).

Two vault seams change:

- **S1** `buildDecodedTx` derives transfers purely from ERC-20 `transfer` calls
  (`Vault.ts:529`, `_buildTransfersFromCalls` at `:567-598`), so a `compile_actions` call
  decodes to nothing. Add a branch keyed on `encodedTx.privacy` (§2.3) that renders the
  action from the intent we already hold, not from calldata parsing.
- **S2** `_broadcast` must forward `proof` on the invoke leg (`Vault.ts:1031`), and
  `ClientStarknet.addInvokeTransaction` must accept it (`ClientStarknet.ts:260-267`).

The service owns: opt-in lifecycle and consent record; viewing-key derivation plus its
bg-memory cache; one `PrivateTransfersInterface` per `(networkId, accountId)`; remote
config with a bundled fallback; stateless discovery reads; private-balance aggregation per
token; the 10-block gate; history fetch; building the `IEncodedTxStarknet` that carries
`callAndProof`; error mapping. It never signs and never broadcasts.

### 1.2 Method list

All `@backgroundMethod()` (`ServiceLightning.ts:3-7` for the import path), registered as
a lazy getter in `BackgroundApi.ts` following `serviceLightning` verbatim
(`BackgroundApi.ts:672-680`).

```ts
type K = { networkId: string; accountId: string };          // IStrk20AccountKey

getPrivacyConfig(p: { networkId: string }): Promise<IStrk20PrivacyNetworkConfig | undefined>;
isPrivacyAvailable(p: { networkId: string }): Promise<boolean>;
getAccountPrivacyState(p: K): Promise<IStrk20AccountPrivacyState>;
recordConsent(p: K & { consentAcceptedAt: number }): Promise<void>;
buildRegisterTx(p: K): Promise<IUnsignedTxPro>;
optOut(p: K): Promise<void>;                 // local only; the on-chain escrow is irrevocable
clearViewingKeyCache(): Promise<void>;       // called from ServicePassword.clearCachedPassword
// reads — stateless; the viewing key is never part of a return value
refreshPrivateBalances(p: K & { tokenAddresses?: string[] }):
  Promise<{ byToken: Record<string, string>; noteCount: number; blockNumber: number }>;
getRecipientRequirement(p: K & { recipient: string; tokenAddress: string }):
  Promise<SetupRequirement>;
fetchPrivateHistory(p: K & { cursor?: IStrk20HistoryCursor }):
  Promise<{ txs: IAccountHistoryTx[]; hasMore: boolean; cursor?: IStrk20HistoryCursor }>;
getSequencingState(p: K): Promise<IStrk20SequencingState>;
noteAccountTouchedByTx(p: K & { blockNumber: number }): Promise<void>;
buildPrivateTransferTx(p: K & { kind: 'deposit' | 'withdraw' | 'transfer';
  tokenAddress: string; amount: string; recipient?: string }):
  Promise<{ unsignedTx: IUnsignedTxPro; warnings: IStrk20Warning[] }>;
```

`buildPrivateTransferTx` is the long one: gate (§3) → ensure viewing key → SDK builder →
`createProofInvocation` → `executeWithInvocation(provingBlockId)` → wrap into
`IEncodedTxStarknet` → `vault.buildUnsignedTx({ encodedTx })`. It returns `warnings` so the
confirm screen can surface `USER_LINKAGE` (`sdkStarknet/privacy/interfaces.ts:351-358`).

### 1.3 Getting the viewing key without the private key leaving `coreApi`

The core method already exists and is currently dead code.
`CoreChainSoftware.deriveStrk20ViewingKey` (`core/src/chains/starknet/CoreChainSoftware.ts:220-239`)
takes `ICoreApiSignBasePayload & { chainId, accountAddress, poolAddress, keyIndex? }`, resolves
the Stark key through the *same* `getStarkPrivateKeyFromPayload` that `signTransaction` uses
(`:45-54`, called at `:123` and `:210`), and delegates to the pure KDF at
`packages/core/src/chains/starknet/sdkStarknet/viewingKey.ts:215-239`
(profile `account-leaf-v1`, `viewingKey.ts:19`, 116-byte context `:25`, public key
`:203`). Nothing in kit-bg calls it yet.

Add the missing keyring rung, mirroring `baseGetPrivateKeys` (`KeyringSoftwareBase.ts:466-486`)
ingredient for ingredient: guard on `this.coreApi`, `this.vault.getAccount()`,
`this.baseGetCredentialsInfo({ password })`, `this.getCoreApiNetworkInfo()`, then call
`coreApi.deriveStrk20ViewingKey({ networkInfo, password, credentials, account, chainId,
accountAddress, poolAddress, keyIndex })`. `baseGetCredentialsInfo`
(`KeyringSoftwareBase.ts:45-74`) hands over only `{ hd?, imported? }` encrypted-hex blobs;
decryption stays inside `packages/core`.

Then one override each in `KeyringHd` and `KeyringImported`, beside the existing four
(`KeyringHd.ts:20-46`). `KeyringWatching` (16 lines) gets none — watching accounts cannot
register, so §4 must hide the opt-in for them. `coreApi` on the keyring is
`CoreChainApiBase`-shaped, so the Starknet-only method needs a one-line narrowed cast at the
Starknet override rather than being hoisted onto the shared base.

**Password.** `servicePassword.promptPasswordVerifyByAccount({ accountId, reason })`
(`ServicePassword/index.ts:1266-1277`, delegating to `promptPasswordVerifyByWallet` at
`:1212-1263`). Only derivation prompts. `refreshPrivateBalances` must use the cache and
throw a typed "locked" error when it is empty, so a background refresh never pops a dialog.

**Cache.** House style is a private field plus an unref'd `setTimeout`, not `memoizee`:
`cachedPassword` + `cachedPasswordTTL` (2h) + timer at `ServicePassword/index.ts:128-135`,
and the closer analogue — a *derived* secret on a short fixed TTL — is the PRF master key
cache at `:137-143`, `:293-320`. Mirror it with a
`Map<'${networkId}_${accountId}_${poolAddress}', { key, publicKeyX }>` plus one timer.

**The lock hook is not an event.** No `appEventBus.on(EAppEventBusNames.LockApp)` listener
exists in kit-bg; `ServicePassword.clearCachedPassword()` is a hard-coded fan-out to sibling
caches (`ServicePassword/index.ts:280-290`, called from `lockApp()` at `:1424`, before the
UI-facing emit at `:1446`). Add `void this.backgroundApi.serviceStarknetPrivacy.clearViewingKeyCache();`
there. Anything else silently outlives lock. Clear on account removal too.

### 1.4 Remote config

| Precedent | What it gives us | Evidence |
|---|---|---|
| `ServiceSetting._fetchInscriptionProtectionControl` | boolean kill switch from `/utility/v1/setting?key=…` via `getClient(EServiceEndpointEnum.Utility)`, `memoizee({ promise: true, maxAge: 5min })`, strict parser that throws on malformed values, result in a jotai persist atom | `ServiceSetting.ts:527-559`, `:104`, `:106-114`; `states/jotai/atoms/settings.ts:133-156` |
| `ServiceIpTable` | signed config blob from a dedicated CDN URL, verified against a pinned signer, rejected on bad signature or version regression while the last good config is kept, envelope stored verbatim | `appConfig.ts:74`; `ipTableDefaults.ts:7`; `ipTableUtils.ts:147-208`; `ServiceIpTable.ts:325-395`, `:489-560`; `SimpleDbEntityIpTable.ts:68-90` |
| `receiveArrivalConfig` | standalone per-feature entity, 1h stale-while-revalidate, with a header comment saying why it must not ride on the network payload | `SimpleDbEntityReceiveArrivalConfig.ts:6-25`; `ServiceNetwork.ts:1857-1908` |

That last warning is load-bearing. `ServiceNetwork.getAllNetworksWithCache` adds
presets first and `addNetworks` only inserts ids not already present
(`ServiceNetwork.ts:144-175`), so **`IServerNetwork.extensions` cannot carry privacy
endpoints** for `starknet--mainnet` / `starknet--sepolia`: those ids are preset
(`presetNetworks.ts:2348-2382`, registered at `:2669-2670`) and neither entry even has an
`extensions` block today. Do not put endpoints there.

**Recommendation.** One standalone config in `SimpleDbEntityStarknetPrivacyConfig`, shaped
like the IP-table envelope, 1h stale-while-revalidate, keyed by `networkId`:
`{ enabled, poolAddress, discoveryUrl, provingUrl, ohttp?: { gatewayUrl, relayUrl?,
publicKeyConfig? }, auditorPublicKey, minRpcSpecVersion }`. The protocol fee is
read from the pool on chain (`get_fee_amount`), never from config: it changed from 6 to 2.5 STRK
between 2026-09 and 2026-10-21.

Bundle a disabled fallback beside the Phase 1 consts. `sdkStarknet/consts.ts` already
establishes the exact shape — a feature boolean (`STARKNET_BACKEND_PROXY_ENABLED`, `:10`)
plus a per-`networkId` URL map with a "temporary until the backend takes over" comment
(`:31-36`). Add `STRK20_PRIVACY_FALLBACK_CONFIG` with the live-verified pool addresses from
doc 02, endpoints empty and `enabled: false`, so a missing remote config can never silently
enable the feature. `isPrivacyAvailable` requires: remote `enabled`, non-empty discovery and
proving URLs, `getSpecVersion()` (`ClientStarknet.ts:107-116`) ≥ `minRpcSpecVersion`, a
non-watching account, and a deployed account (`ClientStarknet.ts:162-177`). Pin
`publicKeyConfig` in production — otherwise the SDK fetches `/ohttp-keys`
trust-on-first-use (doc 01 §8), precisely what the IP-table precedent pins against.

### 1.5 SimpleDb entity

`SimpleDbEntityBase<T>` needs `entityName` and `enableCache` and gives mutex-guarded
`getRawData()` / `setRawData(builder)` (`SimpleDbEntityBase.ts:24-33`, `:96`). The
per-account map precedent is `SimpleDbEntityAccountValue.ts:29-96` (composite-keyed record
plus a `_migrationVersion` idiom); the minimal one is `SimpleDbEntityLightning.ts`.
Registration is one lazy getter in `SimpleDb.ts` copying `get lightning()` at `:290-299`.
**No `LOCAL_DB_VERSION` bump** — CLAUDE.md scopes that constant to Realm/IndexedDB schema
and no SimpleDb entity references it.

Store one record per `${networkId}_${accountId}_${poolAddress}`, all of it public, matching
the SNIP's Persistence section (`docs/04-snip-viewing-key-derivation-draft.md:213-239`):
`profileId: 'account-leaf-v1'`, `version: 1`, `chainId`, `accountAddress`, `poolAddress`,
`keyIndex`, `accountKeyScheme`, `accountKeyFingerprint` (hash of the account **public** key
only, SNIP `:230-232`), `accountDerivationPath`, `registeredPublicKey` read back from
`get_public_key`, plus our own `optInStatus: 'none' | 'consented' | 'registerPending' |
'registered' | 'mismatch'`, `consentAcceptedAt`, `registerTxid`, `lastTxBlockNumber` (§3)
and `lastRefreshAt`. `poolAddress` belongs in the key because the viewing key is bound to
the pool, so a pool migration must not reuse a record.

`mismatch` implements the SNIP's recovery rule (doc 04 `:243-254`): if `get_public_key` is
set and differs from our derived `publicKeyX`, never register a replacement and never treat
zero as authoritative — surface it and stop.

---

## 2. Signer bridge and submission

### 2.1 The SDK calls exactly one signer method

Grepping the vendored SDK for signer use returns one site,
`user.signer.signTransaction(calls, details)` in
`packages/kit-bg/src/vaults/impls/starknet/sdkStarknet/privacy/internal/proof-invocation-factory.ts:148-161`.
`CreatePrivateTransfersParams.account` is `PrivateTransfersUser = { address, signer }`
(`src/factory.ts:35-55`, `src/interfaces.ts:47-50`); a full starknet.js `Account` is accepted
but not required, and `factory.ts:36-43` explicitly invites a custom `signer`.

**Correct a likely assumption:** the invocation's sender is the **pool**, not the account.
`proof-invocation-factory.ts:157` passes `walletAddress: poolAddressHex` and `:170` sets
`sender_address: poolAddressHex`, with calldata being the `__execute__` wrapping of one
`compile_actions(user_address, viewing_key, actions)` call (`:132-139`, `:100-105`). The
signature must still come from the account key, which the pool validates on-chain via SRC5 /
SNIP-6 `is_valid_signature` (doc 01 §2). Any shim asserting "sender == my address" breaks.

### 2.2 The shim

Core already has both halves and they must not be duplicated:
`sdkStarknet.calculateInvokeTxHash` (`core/src/chains/starknet/sdkStarknet/index.ts:167-199`,
which wraps `hash.calculateInvokeTransactionHash` and builds `__execute__` calldata via
`buildExecuteCalldata` at `:180`) and `sdkStarknet.signHash` (`CoreChainSoftware.ts:147`,
`:187`, `:217`). Add one core method beside `signMessage`:
`signStrk20ProofInvocation(payload: ICoreApiSignBasePayload & { invocation })` which resolves
the key with `getStarkPrivateKeyFromPayload`, calls `sdkStarknet.calculateInvokeTxHash` with
`senderAddress = invocation.poolAddress` (yes, the pool), `version: '0x3'`, the
`compile_actions` call, and the chainId/nonce/resourceBounds/tip the SDK's `details` supply,
then returns `sdkStarknet.signHash(txHash, starkPrivateKey)`.

A dedicated method, not `signTransaction` with a synthetic encodedTx: `signTransaction`
returns a full `IStarknetRawTx` (`core/src/chains/starknet/types.ts:78-83`) whose `invoke`
would be a broadcastable-looking object with the pool as sender, and fabricating that to
discard all but `signature` invites someone downstream to broadcast it.

The keyring rung mirrors `baseSignTransaction`'s ingredients, and the service wraps it:
`signer.signTransaction(calls, details)` → `keyring.signStrk20ProofInvocation({ password,
calls, details, poolAddress })`. The other `SignerInterface` members (`getPubKey`,
`signMessage`, `signDeclareTransaction`, `signDeployAccountTransaction`) are unreachable
given the single grep hit above. Per `feedback_no_dead_code_deletion`, implement them as
explicit throws with a comment naming that call site, rather than omitting them.

### 2.3 `callAndProof` → our send pipeline

`execute()` never submits: `ExecuteResult = { callAndProof, registry, warnings }`
(`src/interfaces.ts:362-368`), `CallAndProof = { call, proof }` (`:106-109`), `Proof = { data,
output, proofFacts, additionalData? }` (`:90-101`), and the split we want already exists as
`createProofInvocation` (`:495-498`) then `executeWithInvocation` (`:503-506`).

Extend `IEncodedTxStarknet` (`core/src/chains/starknet/types.ts:32-45`) with one nullable
block rather than bare optional fields, so the ordinary path is provably unchanged:
`privacy?: { poolAddress, kind: 'register' | 'deposit' | 'withdraw' | 'transfer',
proofFacts: string[], proof: string, tokenAddress?, amount?, recipient?, provingBlockId,
builtAt, warnings? }`. Then:

1. `sdkStarknet.calculateInvokeTxHash` gains `proofFacts?: string[]` and forwards it to
   `hash.calculateInvokeTransactionHash` (`sdkStarknet/index.ts:167-199`; starknet.js
   accepts it per G3). **This is mandatory** — proof facts are committed into the invoke
   hash, so omitting them yields a signature the sequencer rejects.
2. `IStarknetSignedInvoke` gains `proof_facts?: string[]` (`core/types.ts:47-60`);
   `CoreChainSoftware.signTransaction` passes `encodedTx.privacy?.proofFacts` into the
   hash and onto the invoke (`CoreChainSoftware.ts:125-159`).
3. `IStarknetRawTx` gains `proof?: string` (`core/types.ts:78-83`). The proof is *not*
   hashed, so it rides beside the invoke rather than inside it.
4. `ClientStarknet.addInvokeTransaction` takes `(tx, proof?)` and sends
   `[{ ...tx, proof }]`, matching `BROADCASTED_INVOKE_TXN` (`ClientStarknet.ts:260-267`).
5. `Vault._broadcast` forwards `rawTx.proof` (`Vault.ts:1031`).

The UI seam is the existing "someone else built the tx" route. `SendConfirmFromSwap`
receives `unsignedTxs` in route params and navigates into SendConfirm
(`packages/kit/src/views/Send/pages/SendConfirmFromSwap/SendConfirmFromSwap.tsx:39`,
`:112`, `:122-183`). A privacy send follows the same shape, so fee estimation
(`Vault.estimateFee:871-919`) and `updateUnsignedTx`'s resource-bounds round trip
(`:474-513`) work unchanged.

**Fee ordering trap.** `apply_actions` pulls `fee_amount` STRK from the caller before
doing anything (doc 01 §6; 6 STRK mainnet / 2 STRK Sepolia per doc 02), so without a
paymaster the account needs an STRK approve to the pool *on top of* any deposit
allowance. The demo folds it into the deposit approve when depositing STRK and otherwise
issues a separate approve (doc 01 §6). Since `Vault.buildEncodedTx` rejects batches today
(`Vault.ts:257-259`), the first version must either extend the privacy path to multi-call
encoded txs or run approve as a separate transaction — and a separate approve is a
transparent tx the proof will read, which re-arms the 10-block wait (§3). Recommend
multi-call in the privacy path: `encodedTx.calls = [approve, applyActions]`.

**Screening window.** A deposit's attestation is valid 300s with 60s skew tolerance
(doc 01 §1, §7). Stamp `provingBlockId` and a wall clock at build time and refuse to
submit a stale build rather than letting it revert with `SCREENING_REQUIRED`.

---

## 3. Sequencing state machine

Rules, from doc 01 §4: prove against finalized state, never `pre_confirmed`; the sequencer
accepts a proof only when its base block is at least 10 blocks older than submission; after every accepted
private tx persist `lastTxBlockNumber = receipt.block_number` and block the next one until
`latest - last >= 10`; the same wait applies after any transparent tx the proof will read
(account deploy before register, ERC-20 top-up before deposit); prove at `latest - 9` and
pass it as `provingBlockId`; pin a block hash, not a tag, for paginated discovery.

Home is `ServiceStarknetPrivacy`; state lives in the simpleDb record, not memory, because on
split-runtime targets `bg` can be torn down between transactions. `getSequencingState` returns
`{ status: 'ready' | 'waiting' | 'unavailable', latestBlock, lastTxBlockNumber?,
blocksRemaining, estimatedSecondsRemaining, provingBlockId? }` with
`blocksRemaining = max(0, 10 - (latest - last))` and `provingBlockId = latest - 9` set only when
ready. `latestBlock` is `ClientStarknet.getBlockNumber()` (`ClientStarknet.ts:144-148`), a
finalized number deliberately distinct from the pre-confirmed tag used for nonces and balances
(`getPreConfirmedBlockTag`, `:117-139`): reads may use pre-confirmed (doc 01 §7), proving may not.

Three writers of `lastTxBlockNumber`:

1. A confirmed private tx. Phase 1 resolves pending txs in `Vault.fetchAccountHistoryDetail`
   (`Vault.ts:920-985`), which reads the receipt and maps `finality_status`;
   `IStarknetReceipt.block_number` is already in the type (`sdkStarknet/types.ts:49-58`).
2. Account deploy. `buildEncodedTx` attaches a counterfactual `deployAccount`
   (`Vault.ts:287-298`) and `_broadcast` sends it first (`:1023-1028`).
3. Any ERC-20 transfer in. Detectable for our own sends, **not** for inbound ones: with
   `serverHistoryUnsupported: true` (`settings.ts:53`) no indexer notices them. So after
   receiving funds from outside, a deposit can fail with `INVALID_BASE_BLOCK_NUMBER`. Without
   an indexer the only mitigation is reactive — on a base-block proving failure, stamp
   `lastTxBlockNumber = latest` and re-arm. A known rough edge, not a solved case.

The wait is never modal (the one Zcash blueprint principle worth borrowing verbatim
[zcash-ref] §2). Show a disabled action with a countdown on the privacy block, plus a
confirm-screen banner (§4.5).

---

## 4. UI

### 4.1 A descriptive settings block, not chain-name branching

`IVaultSettings` on this branch has no privacy/pool vocabulary — `localWallet` is
Zcash-branch-only (`[zcash-ref] vaults/types.ts:231-267`, `ILocalWalletPoolDescriptor` at
`[zcash-ref] vaults/localWallet/types.ts:88-98`). The transferable idea is that UI reads a
data descriptor and never checks a chain name. Borrow the idea, not the type: add
`privacyPool?: { activation: 'account-opt-in'; balanceShape: 'pooled'; poolsPerToken: true;
requiresRegistration: true; sequencingCooldownBlocks: 10 }` beside `serverHistoryUnsupported`
(`vaults/types.ts:230-231`).

Deliberately omitted because they encode local scanning: `accountSetup.requiresBirthday`,
`scanRegionHints`, `tipLagWarningBlocks`, `blockTimeSeconds`, `historySource`,
`maxEnabledAccounts`, and `addressForms` (Starknet has one address, §4.4). If the Zcash
branch ever lands the two descriptors converge by adding fields, not by importing each other.

### 4.2 Opt-in entry point and consent dialog

Primary host: `AccountEditActionListV2.tsx`, which already gates entries by account/network
condition (`showCopyButton` at `:77-91`, `exportKeysVisible` at `:133-212`, `renderItems` at
`:214-336`). A conditional "Private transfers" item slots between `AccountMoveToTopButton`
(`:298-304`) and the remove block (`:305-317`), gated on `vaultSettings.privacyPool &&
!isWatching && isPrivacyAvailable`. If a manage-many-accounts page is wanted later, the
accordion-with-per-account-`Switch` at `ManageAccountActivity.tsx:296-303` is the shape. Not
first version. Status lives on token details (§4.3), not Home.

Consent dialog pattern: `showLiquidationRiskDialog.tsx:16-88` — local `acknowledged` state
(`:16`), body copy plus `Checkbox` (`:32-53`), `Dialog.Footer` with
`confirmButtonProps={{ disabled: isConfirmDisabled }}` (`:55-62`), wrapped in
`Dialog.show({ showFooter: false, renderContent })` resolving a `Promise<boolean>` (`:67-87`).
`RiskNoticeDialog.tsx:50-59`, `:72`, `:104-107` is the variant that chains an async persist.

Copy must state all four, because the first two are irreversible:

1. The viewing key is sent in plaintext to the protocol operator's discovery and proving
   services on **every** sync and every transaction (doc 01 §2 — `viewing_key` is a JSON
   field on `/v1/sync/*`, and `compile_actions`' second argument is `user_private_key`).
   OHTTP hides it from the network, not from the operator.
2. Registration writes the viewing key on-chain encrypted to the pool's auditor, write-once
   and irrevocable (doc 01 §1, §8). Show the auditor key for that network (doc 02 table).
3. Withdrawals additionally encrypt the initiator address to the auditor (doc 01 §8).
4. A protocol fee in STRK applies per private transaction (6 mainnet / 2 Sepolia).

Flow: dialog → `recordConsent` (`'consented'`) → `buildRegisterTx` → normal SendConfirm → on
submit `'registerPending'`, on receipt `'registered'` plus `lastTxBlockNumber`. Consent is
stored before the tx on purpose: a failed register must not restart the consent flow.

### 4.3 Balance display — per-token split on token details, not a pseudo row

`ServiceToken.fetchAccountTokens` routes every row through `vault.fetchTokenList`
(`ServiceToken.ts:221`, `:412`); custom tokens are merged into the *request* (`:376-379`) and
metadata overlaid after (`:438-441`). There is no client-side row injection —
`homeDefaultTokenMap` only suppresses zero-balance hiding
(`states/jotai/contexts/tokenList/cellsPure/pure.ts:229-266`,
`components/TokenListView/index.tsx:490-514`). So a pseudo-token row would mean a new
injection mechanism in the shared token pipeline for one chain. Don't. The Zcash branch landed
in the same place: no Home file there references its pool vocabulary at all [zcash-ref].

- **Home**: unchanged, showing Phase 1's public balances.
- **TokenDetails**: insert the privacy block between `TokenDetailsBalanceHero`
  (`TokenDetailsHeader.tsx:614-622`) and the actions comment (`:624`), inside the same `Stack`
  (`:611-685`) — Public / Private / Total for that token, opt-in CTA when disabled, countdown
  when waiting. `TokenDetailsDeFiBlock` at `:685` is the below-actions precedent.
- Private amounts come from `refreshPrivateBalances` summing `Note.amount` per token out of
  `discoverNotes` (`src/interfaces.ts:459-466`, `Note` at `:77-85`).

Rejected: a second Home tab (no such structure exists) and a pseudo-token row.

### 4.4 Send and receive

**Private send.** The recipient must be registered: `discoverRequirement(recipient, token)`
returns `SetupRequirement`, `Register = 0` through `Ready = 3` (`src/interfaces.ts:56-65`,
`:450-453`). Map `Register` to a blocking form error ("this address has not enabled private
transfers") and `SetupChannel`/`SetupToken` to a non-blocking note that the first transfer
carries extra setup actions, which `build({ autoSetup: true })` adds (`:330`, `:652-658`).
No pool picker — pools split by token, so there is nothing to choose. Surface `USER_LINKAGE`
(`:351-358`, raised when one tx opens more than one channel) on the confirm screen.

**Private receive.** One Starknet address, no second address form, so this is copy only:
whether an incoming transfer lands public or private is the sender's choice. The Zcash
segmented control (`[zcash-ref] ReceiveToken.tsx:150-161`, `:876-889`) is the right
vocabulary source and the wrong control here. Do not add a toggle that changes nothing.

### 4.5 History

`fetchHistory` sits on the concrete indexer class, not the discovery interface
(`src/internal/indexer-discovery.ts:391-402`), takes notes and channel cursors, and needs both
discovered first. Paginate until `historyComplete`: per doc 01 §7 an RC.8 page may return zero
rows with `historyComplete: false`, or more than `maxTransactions`, and `maxTransactions: 0`
is a 400.

Merge point: `ServiceHistory.fetchAccountHistory` (`ServiceHistory.ts:1372`) unions pending and
confirmed rows at `:1780-1788`, then runs post-merge decorators (`attachPrivateSendDisplayStatus`
at `:1798`, whose body at `:883-926` early-returns unless a relevant row exists). Privacy rows
are an additional *source*, not a decoration, so union them into `result` before `:1780` behind
the same kind of cheap guard. The `serverHistoryUnsupported` early return in
`fetchAccountOnChainHistory` (`:2569-2582`) stays as is — there is still no OneKey indexer, and
these rows come from the protocol's.

Honesty constraints from doc 01 §7 to encode in copy: the list is note-anchored and incomplete
by construction, withdrawals cannot be attributed to an initiator because `user_addr` is
encrypted (so an unrelated withdrawal sharing a transaction with your notes appears in your
feed), and bundled multi-user deposits are filtered out. Do not present it as authoritative.

---

## 5. Error mapping

`ETranslationsMock` is the interim home (`shared/src/locale/enum/translationsMock.ts:39-41`
already holds the two Phase 1 Starknet keys); Lokalise keys land with the Phase 1 strings
already queued in doc 00's open items.

| SDK signal | Source | User copy (intent) | Retryable |
|---|---|---|---|
| `ScreeningRejected` | `src/internal/errors.ts` / `screeningErrorFromProvingError` | Compliance screening declined this deposit. Not retryable; no "try again". | no |
| `ScreeningUnavailable` | same | Screening is temporarily unavailable. Try again shortly. | yes |
| `ReorgError` (HTTP 409) | discovery | The network reorganized; refreshing private balances. SDK self-heals once, then it propagates (doc 01 §7). | auto once |
| `ProvingServiceError` 24 (block not found) | `src/internal/proving-service.ts` | Proving service is behind the chain. Retry. | yes |
| `ProvingServiceError` 55 (account validation failed) | same | Signature rejected — usually a stale pool nonce; call `invalidateProofNonceCache()` (`src/interfaces.ts:508-512`) and retry once. | once |
| `ProvingServiceError` 61 (unsupported version) | same | App/pool version mismatch. Update required, do not retry. | no |
| `ProvingServiceError` 1000 (invalid input) | same | Internal error; report. | no |
| `ProvingServiceError` -32005 (busy) | same | Already retried 3× at 1/2/4s inside the SDK; then "service busy". | yes |
| `ProvingServiceError` 10000 (rejected) | same | **Generic** — overloaded code carrying `multiple_screening_subjects`, `unknown_delegated_depositor`, `undeposited_open_notes`, `shadow_account_undetermined`. Never render as a sanctions verdict. | no |
| `PROOF_EXPIRED` / `INVALID_BASE_BLOCK_NUMBER` (on-chain) | `packages/privacy` revert strings, doc 01 §7 | Proof went stale; rebuild. Re-arm the §3 wait. | yes, after rebuild |
| `SCREENING_REQUIRED` (on-chain) | doc 01 §1 | Submitted outside the 300s attestation window; rebuild. | yes, after rebuild |
| pool `is_paused()` | doc 02 table | Private transfers are paused by the protocol. Check before building rather than letting it revert. | no |
| `optInStatus: 'mismatch'` | §1.5 | Registered key does not match this device's derivation. Do not register again; contact support. | no |

Upstream's `screeningErrorFromProvingError` deliberately maps only `address_blocked`,
`screening_unavailable` and `screening_policy_unavailable`, precisely so other reasons are
never shown as "you are sanctioned" (doc 01 §7). Mirror that restraint.

---

## 6. Task breakdown

Interface contract, agreed before either implementer starts: the `@backgroundMethod()` list
in §1.2, the `IStrk20*` types in §1.5 and §2.3, and the `IVaultSettings.privacyPool`
descriptor in §4.1. UI never imports the vendored privacy SDK (kit-bg `sdkStarknet/privacy`); enums it needs
(`SetupRequirement`, warning codes) are re-declared in `packages/shared/types/`, because kit
may not depend on a bg-only package.

**A — background.** (A1) keyring rung `baseDeriveStrk20ViewingKey` in `KeyringSoftwareBase`
plus Starknet `KeyringHd`/`KeyringImported` overrides, unit-tested against the two SNIP
vectors at `docs/04-snip-viewing-key-derivation-draft.md:302-335` (test file already exists
at `core/src/chains/starknet/sdkStarknet/viewingKey.test.ts`). (A2) core
`signStrk20ProofInvocation` and `proofFacts` threaded through `calculateInvokeTxHash` →
`IStarknetSignedInvoke.proof_facts` → `IStarknetRawTx.proof`, with a golden-hash test proving
the hash changes when `proofFacts` is present. (A3) both simpleDb entities plus the
`SimpleDb.ts` getters and the disabled fallback in `sdkStarknet/consts.ts`. (A4) service
skeleton: `BackgroundApi.ts` getter, config resolution, `isPrivacyAvailable`, viewing-key
cache and the `clearCachedPassword` fan-out line. (A5) discovery reads, stateless
(`autoDiscover: 'refresh'`, no persisted registry — doc 01 §7 recommends exactly this).
(A6) sequencing state and its three writers (§3). (A7) `buildRegisterTx` then
`buildPrivateTransferTx` including the STRK approve co-call. (A8) broadcast path
(`addInvokeTransaction(tx, proof)`, `_broadcast`, `buildDecodedTx` privacy branch). (A9)
`fetchPrivateHistory` plus the `ServiceHistory` union before `:1780`. (A10) one
`mapStrk20Error()` returning `{ translationKey, retryable }`.

**B — UI.** (B1) the `privacyPool` descriptor and the Starknet `settings.ts` entry. (B2)
`ETranslationsMock` keys for §4 and §5. (B3) consent dialog on the
`showLiquidationRiskDialog` pattern. (B4) opt-in item in `AccountEditActionListV2`. (B5)
privacy block on TokenDetails between `:622` and `:624`: public/private/total, opt-in CTA,
countdown, `mismatch` state. (B6) private send form: requirement check, warnings, the
"recipient not registered" blocking error. (B7) confirm-screen banners via a
`getNetworkIdsMap().starknet` branch in `renderChainSpecialAlert` (`TxConfirmAlert.tsx:338-397`,
composed at `:412-420`) for the sequencing wait, `USER_LINKAGE`, the protocol fee and the
screening window. (B8) receive-page copy, no toggle. (B9) history rows plus the
"not authoritative" footnote.

Order: A1-A4 and B1-B3 in parallel; A5 unblocks B5; A7 unblocks B6-B7.

---

## 7. Risks

1. **G1 blocks all end-to-end verification.** Ship behind `enabled: false` and do not claim
   a working integration until StarkWare grants endpoint access.
2. **Mainnet pool 2.0 against an SDK asserting 2.1** (doc 02 Notes §1). Sepolia first is the
   only defensible sequence.
3. **React Native OHTTP is unverified.** Upstream hardcodes an HPKE suite needing
   `crypto.subtle` (doc 01 §5). The vendored package is already addressing it —
   `src/platform/` holds `hpkeSuite.native.ts`, `hpkeSuiteRegistry.ts`,
   `decompressResponseText.native.ts`, `timeoutSignal.ts`, and `@panva/hpke-noble` is
   declared (`package.json:12-19`) — but treat it as unproven until measured on device.
   2026-10-19: the pure-JS suite interoperates with the hosted gateway from Node, and the
   gateway sent no compressed inner response (doc 02), so the native decompression gap is
   not hit today. Running it under Hermes on a device is still open.
   Without OHTTP the operator sees the client IP beside the viewing key, which is a
   materially weaker privacy claim and should gate the mobile rollout.
4. **Inbound transparent transfers are invisible** (`serverHistoryUnsupported: true`), so the
   10-block rule can be violated unknowingly (§3). Reactive recovery only.
5. **The SDK is pre-1.0 with breaking changes per release candidate**, including a wholesale
   rename in RC.5 (doc 01 §9). Pin the vendored copy and track its drift in the package.
6. **Approve-then-apply can half-apply** (approve lands, `apply_actions` fails), the same
   hazard Phase 1 already handles for deploy-then-invoke at `Vault.ts:1037-1049`. Reuse that
   error shape rather than inventing a second one.
7. **Consent is irreversible but the UI has an off switch.** `optOut` stops local syncing
   only; the on-chain escrow stands. Both the toggle label and the consent copy must say so,
   or users will reasonably believe they revoked something.
8. **Licence.** The repo root is Apache 2.0, upstream's SDK `package.json` declared ISC
   (doc 01 §9), and the vendored copy declares Apache-2.0
   (see `sdkStarknet/privacy/VENDOR.md`, license discrepancy). Settle with StarkWare before anything
   ships publicly.
