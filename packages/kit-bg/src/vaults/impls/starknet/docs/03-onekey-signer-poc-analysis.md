# onekey-signer (adrienlacombe) — Starknet account from a OneKey Bitcoin key

**Repo root (absolute):** `/private/tmp/claude-501/-Volumes-DevVault-Dev-Workspaces-Orca-feat-support-starknet/caab4a6e-0d8d-4ff5-8e75-bc1be0e087fe/scratchpad/onekey-signer-main`

All `path:line` citations below are relative to that root. Read-only analysis; no `.env*` file was opened. Last commit visible in the clone: `1683f4a Surface RPC failures in note-visibility poll` (single squashed commit). License: MIT, "Copyright (c) 2026 Adrien Lacombe" (`LICENSE:1-3`).

---

## 1. Account model

**Contract.** `contracts/src/onekey_account.cairo:31` defines `OnekeyBitcoinAccount`, declared `#[starknet::contract(account)]` (line 30). Storage is a single felt, `pubkey_hash` (line 49). The constructor takes **only** `pubkey_hash: felt252` (line 74), rejects zero, and emits `OwnerAdded`. No x/y coordinates, no Bitcoin address, no rotation path.

`pubkey_hash = poseidon(x.low, x.high, y.low, y.high)` over the uncompressed secp256k1 public key (`contracts/src/bitcoin_signer.cairo:143`; TypeScript mirror `src/signer.ts:380-394`, web mirror `web/src/lib/signer.ts:138-151`).

**Signature format verified on-chain.** Not raw ECDSA over the transaction hash, not BIP-322, not Taproot/Schnorr. It is legacy Bitcoin message signing (BIP-137 shape) with a **custom 19-byte inner prefix**. `contracts/src/bitcoin_signer.cairo:58-132` builds

```
0x18 || "Bitcoin Signed Message:\n" || 0x33 || "STARKNET_ONEKEY_V1:" || hash_32B      (77 bytes)
```

double-SHA256s it (lines 124-132), then calls `recover_public_key` and compares the Poseidon hash of the recovered coordinates against stored `pubkey_hash` (lines 135-144). Low-s is enforced (lines 52-54, constant `SECP_256_K1_HALF` line 9). Poseidon replaces keccak because the Starknet virtual OS lacks keccak support (comment lines 39-40).

**Libraries / syscalls.** `starknet::secp256_trait::{recover_public_key, is_signature_entry_valid, Secp256PointTrait}`, `starknet::secp256k1::Secp256k1Point`, `core::sha256::compute_sha256_byte_array`, `core::poseidon::poseidon_hash_span` (`bitcoin_signer.cairo:1-6`). It is **not** OpenZeppelin `EthAccount`. The header says "based on the OpenZeppelin Cairo account pattern" (`onekey_account.cairo:5`) but the code is hand-rolled: `contracts/Scarb.toml:12-13` lists only `starknet = "2.15.0"` as a dependency (`cairo-version = "2.15.0"`, `edition = "2024_07"`, dev-dep `snforge_std 0.55.0`).

**Two signing domains, two signature lengths.**

- Transaction auth: hash is `poseidon(TX_SIGNATURE_DOMAIN_TAG, chain_id, tx_hash)` and the signature must be **6 felts** with `[5] == TX_SIGNATURE_DOMAIN_TAG` (`bitcoin_signer.cairo:18-20`, `onekey_account.cairo:179-195`).
- Generic off-chain: hash is `poseidon(OFFCHAIN_SIGNATURE_DOMAIN_TAG, message_hash)` and the signature is **5 felts** (`bitcoin_signer.cairo:22-25`, `onekey_account.cairo:170-176`).
- Felt layout `[r_low, r_high, s_low, s_high, y_parity(, tx_tag)]`, parsed at `onekey_account.cairo:197-235`; `y_parity` must be exactly 0 or 1 (lines 224-228).
- Tags: `TX_SIGNATURE_DOMAIN_TAG = 0x4f4e454b45595f54585f415554485f5631` ("ONEKEY_TX_AUTH_V1"), `OFFCHAIN_SIGNATURE_DOMAIN_TAG = 0x4f4e454b45595f4f4646434841494e5f5631` ("ONEKEY_OFFCHAIN_V1") (`bitcoin_signer.cairo:12,15`; TS `src/signer.ts:69-70`).

`README.md:209` states the split plainly: generic `is_valid_signature` uses 5-felt off-chain signatures, real transaction authorization uses the domain-separated 6-felt form with a marker suffix.

**SNIP-6 / SNIP-5.** `__validate__`, `__execute__`, `is_valid_signature` are embedded via `IAccount` (`onekey_account.cairo:17-22`, impl 83-110). `__validate_deploy__` (asserts the constructor `pubkey_hash` matches storage) and `__validate_declare__` at 115-126. All four protocol entry points reject non-zero callers (`__execute__` line 86, `_validate_tx` line 156). `supports_interface` returns true for ISRC6 `0x2ceccef7...cc1cd` and ISRC5 `0x3f918d17...2a055` (lines 137-139, constants 43-45). Transaction version 0 is rejected (lines 147-151). `__execute__` bans self-calls (line 91).

**SNIP-9 outside execution: absent.** No `execute_from_outside`, no `OutsideExecution` struct, no session keys anywhere in the repo (grep across all `.cairo`, `.ts`, `.tsx` found nothing). Gasless flows instead go through AVNU typed data validated by `is_valid_signature`.

**Class hash and address derivation.**

- Class hash `0x3fd1bc69954e31b8e0f8c934c530f13510716619f5d080b619563d9615e7eec` — `src/constants.ts:12-13`, duplicated at `web/src/config/constants.ts:1-2`.
- Address = `calculateContractAddressFromHash(salt = pubkeyHash, classHash, constructorCalldata = [pubkeyHash], deployerAddress = 0)` — `src/signer.ts:411-423`, `web/src/lib/signer.ts:156-159`. So salt and the sole constructor argument are both `pubkey_hash`.
- `scripts/compute-addresses.ts:1-14` is a 14-line utility that prints `pubkeyHash` and address for two well-known Anvil test keys (lines 4-5).
- Declared on Starknet Sepolia per `README.md:208` and the header comment in `test/e2e.ts:16-17` ("The contract class hash must be declared on Sepolia and set in src/constants.ts"). **Mainnet declaration: UNVERIFIED** — the string "mainnet" appears nowhere in the repo.

**Is this SNIP-36?** The name is a project label, not an implemented standard in this repo. "SNIP-36" appears only in prose and UI strings (`README.md:1`, `test/e2e.ts:2,871`, `web/src/App.tsx:212`, `web/src/components/layout/Header.tsx:16`). There is no `wallet_strk20InvokeTransaction`, no `strk20`/`STRK20` identifier, and no wallet-RPC surface anywhere. The account standard actually implemented is **SNIP-6 plus SNIP-5** (`onekey_account.cairo:44` comments SNIP-5 explicitly, `README.md:215`). The "SNIP-36" reference is to the privacy-pool protocol this demo targets, whose on-chain interface here is `compile_actions` / `apply_actions` on a pool contract.

**Cairo tests.** `contracts/tests/test_sig.cairo` (320 lines) checks SHA-256 against the "abc" vector (lines 10-26) and pins the 77-byte wrap's double-SHA256 to a JS-computed value (lines 33-60), i.e. cross-implementation parity between Cairo and TypeScript.

---

## 2. OneKey device interaction

**SDK and transport.** `web/src/lib/onekey.ts:5,13` uses `SDK.HardwareSDKLowLevel` from `@onekeyfe/hd-web-sdk`, initialized with `env: 'webusb'`, `debug: false`, `fetchConfig: true` (lines 145-149). `AGENTS.md:105` warns never to revert to `HardwareWebSdk`/`connectSrc`, because the low-level transport is what allows calling `navigator.usb.requestDevice` directly. WebUSB filter covers four OneKey vendor/product pairs: `0x1209/0x53c0`, `0x53c1`, `0x4f4a`, `0x4f4b` (lines 14-19). Connect flow: browser USB chooser (158-178) then `searchDevices`, falling back to `getFeatures` to recover `device_id` (197-224).

**Methods and derivation path.**

- `btcGetPublicKey(connectId, deviceId, { path, showOnOneKey: false, coin: 'btc' })` — `onekey.ts:265-269`.
- `btcSignMessage(connectId, deviceId, { path, messageHex, coin: 'btc' })` — `onekey.ts:296-300`.
- Path is `m/44'/0'/0'/0/{accountIndex}` — `web/src/config/constants.ts:24-26`; emulator copy `test/onekey-emulator.ts:123`. `README.md:184` notes the index selector changes public key, Starknet address, and privacy viewing key together.
- The node/emulator harness uses `@onekeyfe/hd-common-connect-sdk` with the same two calls (`test/onekey-emulator.ts:1,336-337,433-436`).

No `evmSignMessage`, no Starknet-specific firmware method. This is exactly how the PoC sidesteps the missing firmware Starknet app.

**What the device is asked to sign.** `web/src/lib/signer.ts:287` sets `messageHex = STARKNET_AUTH_PREFIX_HEX + hashBody`, where the prefix is `535441524b4e45545f4f4e454b45595f56313a` ("STARKNET_ONEKEY_V1:", line 46). The app hands the device 51 raw bytes and the **device performs the outer Bitcoin-signed-message wrap itself** (comment lines 39-45; `AGENTS.md:148`). In the pure-software signer the whole digest is built in-process instead (`src/signer.ts:239-245`).

**What the user sees: UNVERIFIED.** Nothing in the repo documents the device confirmation screen. Structurally the OneKey shows a Bitcoin "sign message" prompt whose payload is 19 ASCII characters followed by 32 bytes of binary hash, so the Starknet call being authorized is not visible. PIN and passphrase are forced to on-device entry by auto-answering the UI events with `@@ONEKEY_INPUT_PIN_IN_DEVICE` and `{ passphraseOnDevice: true, value: '' }` (`onekey.ts:112-132`; `README.md:185`, `AGENTS.md:108`).

**Signature conversion.**

- Device returns a 65-byte compact signature as hex **or** base64; `decodeSignatureBytes` handles both (`onekey.ts:73-82`) and the length is asserted to be exactly 65 (306-308).
- `recovery = (byte0 - 27 - 4) % 4` (line 311). This is correct for all three script types only because every script-type offset is a multiple of 4.
- `r = bytes[1..33]`, `s = bytes[33..65]` (313-318).
- Low-s normalization flips parity: `s = n - s; v ^= 1` (`web/src/lib/signer.ts:127-131`; node equivalent `src/signer.ts:174-179`).
- Split into u128 low/high felt pairs (`web/src/lib/signer.ts:48-51,291-294`).
- Transaction path appends the domain tag as a 6th felt (`web/src/lib/signer.ts:80-82,240-244`).
- `byte0 = 27 + recovery + 4 (compressed) + scriptTypeOffset`; offsets P2PKH 0, P2SH-segwit 4, native segwit 8 (`src/constants.ts:35-42`, `src/signer.ts:320`). Default is native segwit. `test/e2e.ts:134-181` round-trips all three types and asserts byte0 ranges 31-34, 35-38, 39-42.

**Package versions.**

| Package | Version | Where |
|---|---|---|
| `@onekeyfe/hd-common-connect-sdk` | `^1.1.25` | `package.json:21` |
| `@onekeyfe/hd-web-sdk` | `^1.1.23` | `web/package.json:15` |
| `starknet` | `github:starkware-libs/starknet.js#PRIVACY-0.14.2-RC.2` | `package.json:26`, `web/package.json:18` |

The starknet.js dependency is an unpublished git branch; it is what supplies `proofFacts` in transaction-hash computation and `proof_facts`/`proof` in `starknet_addInvokeTransaction`.

---

## 3. Privacy viewing key

Exact construction, `src/privacyKey.ts` (canonical module shared by node and web, deliberately dependency-free besides `@noble/hashes` — lines 1-9):

```
challenge  = utf8("STARKNET_ONEKEY_PRIVACY_V1:")          // 27 bytes,   line 12
          || be32(chainId) || be32(poolAddress)
          || be32(accountAddress) || be32(pubkeyHash)      // 4 x 32 = 128 bytes
                                                           // total 155 bytes, lines 74-82

sigBytes   = [v & 0xff] || be32(r) || be32(s)              // 65 bytes,   lines 84-90

privacyKey = ( SHA256( sigBytes || challenge || utf8("privacy-key") )
               mod (MAX_STARK_PRIVATE_KEY - 1) ) + 1       // lines 92-100
```

where `PRIVACY_KEY_DERIVATION_CONTEXT = 'privacy-key'` (line 13) and `MAX_STARK_PRIVATE_KEY = STARK_EC_ORDER / 2 - 1` (lines 17-19).

Callers: `src/signer.ts:532-546` (local private key path) and `web/src/lib/signer.ts:269-281` (device path), the latter with an in-memory cache keyed by chainId, poolAddress, accountAddress, pubkeyHash, accountIndex (lines 251-267). The web bundle imports the node module directly by relative path (`web/src/lib/signer.ts:29`).

**The private key never leaves the device.** The secret input is the device's secp256k1 **signature** over the challenge, not the key itself. Reproducibility therefore depends on the firmware's ECDSA being deterministic (RFC 6979). The repo never states that dependency — flagging it as an unstated assumption of the design, my observation rather than theirs.

**Design intent that is stated.** The challenge deliberately **excludes the account class hash** so that Ready-account class upgrades do not rotate the viewing key (`README.md:186`, `AGENTS.md:117`). Because the pool's registered public key is immutable, node and web must produce byte-identical challenges (`privacyKey.ts:1-9`); `README.md:198` notes accounts registered by an older build cannot be migrated. `AGENTS.md:117` forbids deriving the key from public values alone.

**Comparison with the SNIP draft** (HMAC-SHA256 keyed by the account-leaf private key, domain `STRK20_ACCOUNT_LEAF_V1`, 116-byte context): this repo **contradicts the draft on every axis**.

| Axis | SNIP draft | This repo |
|---|---|---|
| Primitive | HMAC-SHA256 | plain SHA-256 (`privacyKey.ts:96`) |
| Keying secret | account leaf private key | device ECDSA signature (`privacyKey.ts:84-90`) |
| Domain string | `STRK20_ACCOUNT_LEAF_V1` | `STARKNET_ONEKEY_PRIVACY_V1:` (line 12) |
| Context size | 116 bytes | 155-byte challenge (lines 74-82) |

Whether it predates the draft is **UNVERIFIED**: no `STRK20` string, no draft citation, and only one squashed commit is visible. The substitution is plainly motivated — a hardware device will not run HMAC keyed by its own private key, so a signature is used as the reproducible secret instead.

---

## 4. Privacy-pool flow

**No privacy SDK package.** Everything is hand-rolled against `provider.callContract` and raw JSON-RPC. The only special dependency is the starknet.js `PRIVACY-0.14.2-RC.2` branch.

**Sequence** (`web/src/components/PrivacyActions.tsx`, mirrored in `test/e2e.ts`):

1. **Register viewing key.** Read pool `get_public_key` for the account; if zero, derive the privacy key from the device, then client actions `[address, privacyKey, '1', '0', randomFelt()]` (line 410) → pool `compile_actions` pinned to `proveBlock` (411-416) → `proveAndExecute` (421). E2E equivalent `test/e2e.ts:330-350`; Wallet B registration `test/e2e.ts:609-628`. Both assert the on-chain key equals `deriveStarkPublicKey(privacyKey)` (`test/e2e.ts:356-367`, `privacyPool.ts:192-196`).
2. **Deposit.** `approve` STRK to the pool via `account.execute` (454-470) → wait for finality → compute channel key, next channel index, next note index, all pinned to `proveBlock` (255-271) → build actions (272-519) → `compileVariants` → `proveAndExecute` (533-536).
3. **Transfer (E2E only).** A → B private transfer builds the channel key from A's privacy key and B's on-chain viewing key (`test/e2e.ts:640`) and creates an encrypted note for B.
4. **Withdraw.** `selectNotesForAmount` (`privacyPool.ts:441-467`) → one `UseNote` action per selected note plus a change note → withdraw action (588-650).

**Action opcodes** (first felt of each action array, from `PrivacyActions.tsx:272-519,597-603`):

| Code | Action |
|---|---|
| `1` | OpenChannel `[1, address, channelIndex, randomFelt, randomFelt]` |
| `2` | OpenSubchannel `[2, address, publicViewingKey, channelKey, 0, token, randomFelt]` |
| `3` | CreateEncNote `[3, address, publicViewingKey, token, amount, noteIndex, random120]` |
| `5` | Deposit `[5, token, amount]` |
| `6` | UseNote `[6, channelKey, token, noteIndex]` |
| `7` | Withdraw `[7, recipient, token, amount, randomFelt]` |

Because the exact required prefix set is not knowable client-side, `compileVariants` tries several orderings against `compile_actions` until one compiles (lines 370-379; deposit variants 521-531, withdraw variants 609-647). `AGENTS.md:116` notes `compile_actions` reverts are action-construction failures, not transport failures.

**How the proof invocation is signed — two distinct device signatures.** `proveAndExecute` (`PrivacyActions.tsx:684-830`; node twin `test/e2e-helpers.ts:472-700`):

1. Build a synthetic INVOKE whose **sender is the pool address**, calldata `['0x1', pool, selector('compile_actions'), len, ...clientActions]` (691-696), nonce = pool nonce **at `proveBlock`** (helpers 490-495), zero-price resource bounds with `l2_gas max 0x20000000` (710-715).
2. Sign that hash with `signer.signHash` — the **5-felt OFFCHAIN** form, because the pool verifies it through the user account's `is_valid_signature` (line 718; helpers 530-535).
3. POST `starknet_proveTransaction` to the proving service with `block_id: { block_number: proveBlock }` (725-744), receive `proof_facts` and `proof` (753).
4. Build the real user INVOKE calling pool `apply_actions` with the server actions (765), live resource bounds with `l2_gas max 0x8000000` (772, helpers constant `PROOF_APPLY_L2_GAS_MAX = 0x8000000n` at line 37).
5. Recompute the transaction hash **including** `proofFacts` (788).
6. Sign that with `signer.signTransactionHash` — the **6-felt TX-domain** form (791).
7. Submit raw `starknet_addInvokeTransaction` carrying `proof_facts` and `proof` (798-826).

`AGENTS.md:132-135` warns that swapping the two signing entry points breaks account validation.

**AVNU paymaster.** Used for **account deployment only**; the proof-carrying transaction is paid by the account itself.

- Deploy: `paymaster_executeTransaction` with `transaction: { type: 'deploy', deployment: { address, class_hash, salt, calldata: [pubkeyHash], version: 1 } }` and `parameters: { version: '0x1', fee_mode: { mode: 'sponsored' } }` — `web/src/hooks/useOneKey.ts:154-175`, `test/e2e-helpers.ts:124-165`.
- An unused sponsored **invoke** path exists in the helpers: `paymaster_buildTransaction` returning typed data (168-207) then `paymaster_executeTransaction` with `typed_data` + signature (210-252), both `fee_mode: sponsored`.
- API key header is `x-paymaster-api-key` (`e2e-helpers.ts:113-122`, `useOneKey.ts:152`).
- Direct self-paid deploy is preferred when the account already holds STRK (`useOneKey.ts:124-147`, bounds `l1_gas 0x200`, `l2_gas 0x2000000`, `l1_data_gas 0x200` at doubled prices).

**Block-wait handling — it is not a 10-block wait.** `PrivacyActions.tsx:60-63` sets `PROVER_BLOCK_LAG = 20`, `PROVER_FINALITY_MARGIN = 25`, `PROVER_POLL_INTERVAL_MS = 3000`, `PROVER_MAX_POLLS = 60`.

- `proveBlock = max(latest - 20, 0)` (lines 108-113).
- Every read feeding a proof must be pinned to `proveBlock`: `compile_actions`, `get_outgoing_channel_info`, `get_note`, and the pool nonce (`AGENTS.md:120`, helpers 486-495).
- Deposits wait until the tip advances 25 blocks past the approve transaction (`AGENTS.md:122`; E2E loop `test/e2e.ts:407-414` with `approveBlockNum + 25`).
- Withdrawals wait until every selected note is visible at `proveBlock` via `get_note`.
- Setting the viewing key additionally waits until the account class hash is visible at `proveBlock`, otherwise the prover rejects because `is_valid_signature` targets an address undeployed at that historical block (`AGENTS.md:121`).
- These loops surface the `Waiting for the prover to catch up...` status (`README.md:187`).

**Discovery service.** POST `{DISCOVERY_SERVICE_URL}/v1/sync/incoming_state` and `/v1/sync/outgoing_state`, paginated by cursor until complete (`web/src/lib/privacyPool.ts:310-431`). Request body: `contract_address`, `recipient_address` or `sender_address`, `viewing_key`, `cursor`, optional `block_ref` (lines 325-336, 375-385). The field sent as `viewing_key` is the **derived private** privacy key (`PrivacyActions.tsx:274,299`), so the discovery operator can decrypt that account's note stream. Private balance comes from discovery notes, not from an on-chain balance slot (`README.md:190`, `AGENTS.md:101`).

**Hardcoded contract constants** (`src/constants.ts`, mirrored `web/src/config/constants.ts:1-8`):

| Item | Value |
|---|---|
| Account class hash | `0x3fd1bc69954e31b8e0f8c934c530f13510716619f5d080b619563d9615e7eec` (`src/constants.ts:12-13`) |
| Privacy pool (Sepolia) | `0x254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91` (`src/constants.ts:16-17`) |
| STRK token | `0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d` (`src/constants.ts:20-21`) |

Pool hash-domain tags: `CHANNEL_KEY_TAG:V1`, `OUTGOING_CHANNEL_ID_TAG:V1`, `NOTE_ID_TAG:V1` (`privacyPool.ts:204-238`). Channel key = `poseidon(tag, senderAddr, senderPrivacyKey, recipientAddr, recipientPublicKey)` (198-212). Public viewing key = stark-curve public key x of the privacy key (192-196). Index discovery brute-forces up to 1000 slots via `get_outgoing_channel_info` / `get_note` (240-286).

---

## 5. Hardcoded service URLs outside `.env`

Discovery, proving, paymaster, and Starknet RPC URLs are **all environment-only** (`src/constants.ts:24-27`, `web/src/config/constants.ts:10-14`). What is hardcoded in tracked non-`.env` files:

- **`contracts/snfoundry.toml:3`** — `url = "http://34.170.198.113:9545/rpc/v0_10"`. A bare-IP, plaintext-HTTP RPC endpoint bound to the `sncast.deployer` profile. This is the only hardcoded remote node in the repo.
- `web/src/config/constants.ts:22` — `https://sepolia.voyager.online` (explorer).
- `test/onekey-emulator.ts:42-43` — `http://localhost:21333` (OneKey bridge), `http://localhost:6088` (noVNC). Same values at `web/src/config/constants.ts:21`, `web/package.json:8`, `AGENTS.md:78-80`, `README.md:132-135`, `scripts/setup-onekey-simulator.sh:22-23`.
- `scripts/setup-onekey-simulator.sh:6` — `https://github.com/Johnwanzi/onekey-docker.git` (simulator image source, cloned into `.external/onekey-docker`).
- **Private keys in source** (test-only, but real keys): `scripts/compute-addresses.ts:4-5` uses the two standard Anvil/Hardhat keys; `test/e2e.ts:60-67` defines legacy sponsor keys plus fresh default Wallet A/B keys.

No proving-service or discovery-service hostname is committed anywhere.

---

## 6. Fit for app-monorepo

### What supporting OneKey hardware Starknet accounts this way would require

1. **A second account class, hence a second address family.** Hardware accounts derive from `0x3fd1bc69...e7eec`, not our software OpenZeppelin class `0x540d7f5e…`. The same seed yields two different Starknet addresses depending on whether the key is software-Stark or hardware-secp256k1, with no migration path between them (`pubkey_hash` is immutable). The class is declared on Sepolia only as far as this repo evidences; mainnet is UNVERIFIED.
2. **A different derivation path.** The account key is the Bitcoin BIP44 leaf `m/44'/0'/0'/0/i` (`web/src/config/constants.ts:24-26`), not a Starknet path. One secp256k1 key then serves both Bitcoin spending and Starknet authorization. Cross-domain *replay* is closed by the 19-byte prefix (`bitcoin_signer.cairo:96-117`), but cross-chain key reuse remains a policy decision for us.
3. **A KeyringHardware built on existing BTC message signing.** No firmware work: `btcGetPublicKey` plus `btcSignMessage` already exist, which is precisely how the blocker is sidestepped. Our side must add Poseidon public-key hashing, both domain hashes, low-s normalization with parity flip, and the 5-felt vs 6-felt split. Getting the split wrong fails validation with no useful error (`AGENTS.md:132-135`). Per our repo rules, `@onekeyfe/hd-core` must be reached through `await CoreSDKLoader()` and all device traffic must stay in background.
4. **A deploy path for the counterfactual address.** Either prefund the address with STRK (`useOneKey.ts:124-147`) or use an AVNU sponsored deploy with our own paymaster API key (`useOneKey.ts:150-181`).
5. **Privacy viewing key as a per-account device signature.** One extra device confirmation per account, cached in background rather than the in-memory map the PoC uses (`web/src/lib/signer.ts:251-267`). The derived key is then transmitted to the discovery service.
6. **The starknet.js privacy fork.** `proof_facts` support lives on the unpublished `PRIVACY-0.14.2-RC.2` branch; our monorepo pins upstream starknet.js. The pool path also bypasses `Account.execute` entirely in favor of raw `starknet_addInvokeTransaction`.

### Main risks

- **Blind signing is the headline risk.** Every Starknet transaction reaches the user as a Bitcoin "sign message" prompt over an opaque 51-byte payload (`web/src/lib/signer.ts:283-294`). The device cannot display recipient, amount, or contract. For a hardware-wallet vendor this is a product-level objection, not a detail. Exactly what renders on screen is UNVERIFIED.
- **No audit.** The string "audit" appears nowhere in the repo. The only tests are three Cairo unit tests plus Sepolia E2E scripts.
- **No recovery, no rotation.** `pubkey_hash` is set once and is immutable; no guardian, no timelock, no social recovery. Losing the device or seed permanently bricks the account (`README.md:213`, `AGENTS.md:126`).
- **Third-party authorship.** MIT, Adrien Lacombe (`LICENSE:1-3`), one commit, not OneKey-authored. Adopting it means OneKey-branded addresses depend on a contract we neither wrote nor reviewed.
- **Validation cost is unmeasured.** Each `__validate__` performs a double SHA-256 over 77 bytes plus a secp256k1 public-key recovery inside Cairo. No gas figure exists in the repo (UNVERIFIED). The only signals are hand-chosen bounds: `l2_gas 0x2000000` for deploy, `0x8000000` for the proof-apply transaction, `0x20000000` for the zero-price prove request (`PrivacyActions.tsx:465,712,772`; `e2e-helpers.ts:37`).
- **Feature gaps.** No SNIP-9 outside execution means no session keys and no standard gasless relaying. `__execute__` also rejects calls whose target is the account itself (`onekey_account.cairo:91`), ruling out any multicall that touches account state.
- **Operational fragility in the pool path.** A 20-block pin, a 25-block finality margin, brute-forced channel/note indices, and guess-and-retry `compile_actions` variants add up to a lot of orchestration to own. Discovery lag after accepted transactions is a known debugging trap (`AGENTS.md:119`).
- **Viewing-key exposure.** The derived private viewing key is sent to the discovery service on every sync (`privacyPool.ts:325-336`), so that operator sees the account's full note history.
