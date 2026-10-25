# Hardware Cloud key: phase 1 acceptance

This implementation replaces the credential source, not the sync payload or wire
protocol. One Keyless wallet or one standard OneKey hardware wallet supplies the
global Cloud key. Existing Keyless credential persistence, cache, request signing,
request nonce, encryption, and sync services are shared. Existing Keyless seed
derivation is unchanged. Full hardware account snapshots and recovery without
device interaction belong to phase 2; its implementation and boundaries are
documented in [PUBLIC_ACCOUNT_SYNC.md](../ServicePrimeCloudSync/PUBLIC_ACCOUNT_SYNC.md).

## Frozen derivation contract

- Version: `1`.
- Wallet: standard wallet, empty passphrase. An attached hidden-wallet PIN session
  is rejected. Local and live standard-wallet identity must match.
- Path: `m/44'/0'/100'/0/0`, Bitcoin P2PKH.
- Operation: legacy `btcSignMessage`, not BIP322, Taproot, or transaction signing.
- Message: the exact ASCII bytes below, with the final placeholder replaced by
  the first 16 lowercase hex characters of SHA256 of the canonical full wallet
  XFP. The resulting message is 113 bytes and has no trailing newline.

```text
WARNING: Unlock ALL OneKey Cloud data. Never sign in dApps.
OneKey Cloud Key v1
Standard wallet: <16 lowercase hex characters>
```

The XFP is public context, not secret entropy. Compact signatures must represent
a compressed P2PKH key; normalization enforces low-S and adjusts the recovery
bit. The result is verified against the expected address and signed a second
time to detect an unstable device during this operation. The normalized secret
signature is passed as seed material to the existing `deriveKeylessCredential`.
The full signature is never returned to the UI or external provider and is not
an authentication signature. Ordinary Cloud requests use the derived signing
key and existing request nonce. Server replay enforcement is outside this App
repository and is not newly claimed or changed.

Changing message bytes, the path, normalization, identity canonicalization, or
derivation requires an explicit recovery/migration design. Repeating twice does
not prove consistency across device models, firmware versions, or future boots.

## Development gate and source lifecycle

No model/firmware pair is certified yet. Root generation is available only in
development native builds or development desktop builds using direct WebUSB or
DesktopWebBle. Desktop bridge, web, and extension generation fail closed. Device
debug logging must be off. The hd-core patch removes `btcSignMessage` response
payloads from its ordinary log ring; the sensitive background scope also
suppresses device event forwarding. Do not remove these gates to test a device.

On the Cloud sync page, the development entry lists standard hardware wallets.
Use a separate acceptance profile without existing encrypted Cloud records. Turn
off the existing sync mode, then choose **Use <wallet name>**. Two identical
message confirmations are expected. Activation uses the existing credential
store; after successful activation ordinary sync and restart hydration do not
require the hardware to remain connected. After **Turn off sync**, **Resume sync**
restores that same saved key without deriving a new signature or contacting the
device. Missing credentials leave sync off and show an explicit hardware recovery
hint. The request is bound to the selected source and cancel generation; an old
page cannot activate or disable a different source. Resume remains development
only and does not introduce a new storage or App-password scheme. App password locking clears the
existing memory cache and cancels an unfinished hardware derivation. Existing
platform persistence and fallback behavior are unchanged.

Credential lookups are now read-only on a missing ID or corrupt payload, because
a stale read may finish after another source has saved its credential. Existing
explicit save, repair, and disable paths own replacement/removal; no second
storage backend or format was introduced.

Both sync modes must be off before changing the source. A change of Cloud space
with encrypted local records is rejected. There is no automatic migration,
re-encryption, or cloud deletion. A replacement physical device may restore the
same key when the canonical standard-wallet XFP and regenerated credential
match. A mismatch preserves the old credential and records. If activation fails
after credential persistence, sync remains disabled and can be retried with the
same standard wallet. Cancellation is acknowledged only before the credential
commit begins; after that boundary the atomic activation finishes or reports an
error.

## Isolated mock verification

The adapter in `hardwareCloudSyncCredential.ts` is dependency injected. Its Jest
test double supplies public non-production vectors; production has no mock
fallback, mock switch, or bundled test secret. `hardwareCloudSyncSdk.test.ts`
separately mocks the SDK, session, transport, and live identity. Lifecycle tests
mock only hardware derivation and persistence to exercise the shared services.

Run from the repository root:

```sh
yarn jest --runInBand --runTestsByPath \
  packages/kit-bg/src/services/ServiceKeylessCloudSync/hardwareCloudSyncCredential.test.ts \
  packages/kit-bg/src/services/ServiceKeylessCloudSync/hardwareCloudSyncSdk.test.ts \
  packages/kit-bg/src/services/ServiceKeylessCloudSync/ServiceKeylessCloudSync.hardware.test.ts \
  packages/kit-bg/src/services/ServiceKeylessCloudSync/ServiceKeylessCloudSync.test.ts \
  packages/kit-bg/src/services/ServicePrimeCloudSync/keylessCloudSyncCompatibility.test.ts \
  packages/kit-bg/src/services/ServicePrimeCloudSync/ServicePrimeCloudSync.syncNowKeyless.test.ts \
  packages/kit-bg/src/services/ServiceAccount/ServiceAccount.keylessRemovalPhase.test.ts \
  packages/kit-bg/src/services/ServiceKeylessWallet/utils/keylessSyncCredentialStorage.test.ts \
  packages/shared/src/utils/hardwareCloudSyncGuards.test.ts \
  packages/kit-bg/src/apis/BackgroundApiBase.hardwareCloudSync.test.ts \
  packages/kit-bg/src/providers/ProviderApiBtc.hardwareCloudSync.test.ts \
  packages/kit-bg/src/vaults/impls/btc/KeyringHardwareBtcBase.hardwareCloudSync.test.ts \
  packages/kit-bg/src/vaults/impls/btc/KeyringHardwareTrezor.test.ts \
  packages/kit-bg/src/vaults/impls/btc/KeyringHardwareKeystone.test.ts \
  packages/kit/src/views/Prime/pages/PrimeCloudSync/HardwareCloudSyncKeySection.test.tsx \
  packages/kit-bg/src/services/ServiceSend.hardwareCloudSync.test.ts \
  packages/kit-bg/src/services/ServiceDApp.deriveContextHash.test.ts
node --test development/scripts/hardware-cloud-sdk-redaction.node-test.js
yarn agent:check --profile commit
```

Coverage includes standard/hidden/attached-PIN sessions, cancellation, disconnect,
identity changes, transport handle resolution, unstable signatures, repeat
derivation, existing crypto compatibility and nonce construction, stale cache,
source selection races, encrypted-record preservation, and encoded external
requests. This is focused regression coverage, not a complete security audit.

## Local hardware acceptance before certification

Use disposable test wallets and an isolated profile. Never export or record the
root signature, generated credentials, seed, or mnemonic in test evidence.

1. Record App commit, OS, model, firmware version, Bitcoin-only/multicoin build,
   and direct transport. Do not upgrade firmware for this test.
2. Add the standard wallet. From Cloud sync choose it as key. Confirm that the
   hardware displays every byte of the 113-byte ASCII warning through scrolling
   or paging, the expected Bitcoin address/path context, and an explicit confirm
   action. Hash-only or truncated displays fail acceptance.
3. Approve both identical requests. Repeat after disconnect, App restart, device
   reboot, and USB/BLE transport change. Confirm the existing key is accepted,
   without inspecting or logging its value. Hidden-wallet or attached-PIN state,
   device substitution, cancel, lock, and disconnect must fail or explicitly
   switch to the verified standard wallet; they must never reuse a hidden key.
4. Restore the same disposable mnemonic on a replacement supported device. Add
   its standard wallet and confirm identical Cloud data can be decrypted. Test
   all intended cross-model/build combinations. Any mismatch blocks that pair.
5. After activation, disconnect hardware and exercise existing upload/download,
   App lock/restart, disable/re-enable, and Keyless regression. Use **Sync now**
   in the development section. Existing encrypted-space source changes must be
   rejected without modifying old records. Do not interpret phase 1 metadata
   sync as full hardware-account restoration without interaction.
6. Attempt the exact 113-byte reserved message through dApp/WalletConnect,
   including real RPC escaping and supported byte encodings. Every valid identity
   tag must be rejected before ordinary SDK signing/logging. Check the final
   canonical BTC `messageHex`, not an arbitrary metadata substring. Other text,
   literal JSON/hex/Base64 with different final bytes, large EIP712 data and normal
   Legacy account index 100 must remain usable. No root signature may appear in
   dApp results, history, SDK logs or analytics. A different malicious wallet App
   remains outside this App's protection: the device warning is still required.

Native device builds, physical display behavior, secure-element determinism,
cross-device recovery, BTC-only compatibility, and end-to-end production-server
behavior cannot be established by the cloud mock. They remain explicit release
blockers until the intended compatibility matrix is completed.

## Signature protection and inherited persistence boundary

The external guard now compares the complete final Bitcoin message bytes with
the frozen prefix plus any valid 16-character lowercase hex identity tag. It
does not guess-decode unrelated JSON, recursively scan provider metadata, reject
large inputs, or reserve the entire BIP44 account. Actual provider encoding is
resolved before the final SDK boundary. Internal Cloud generation uses its own
non-RPC adapter after standard-session/identity checks; no external boolean or
global derivation window can bypass the ordinary message guard. EVM typed data
uses another protocol domain and is not a legacy Bitcoin root-message request.
No externally reachable arbitrary raw-hash legacy Bitcoin signer was found in
this targeted review; this is not proof about every future SDK/API.

The derivation path remains `m/44'/0'/100'/0/0`; index 100 is also the ordinary
101st Legacy account. That compatibility is restored by permitting other message
bytes on this path and removing path-only dApp filtering. No derivation contract,
existing account, seed or user data was migrated. Root generation still uses the
fixed path and a verified standard wallet.

Credential persistence intentionally inherits Keyless's secure-storage preference
and ordinary-storage fallback, fixed local encryption wrapper and warm-cache
access without requiring another hardware signature. This work neither upgrades
that boundary to device-presence protection nor adds a new leak/storage backend.
Requiring OS secure storage everywhere or reauthorization on every unlock would
be a separate product/platform compatibility choice; it is not silently enabled.

The new isolated regressions cover saved-key resume while disconnected, missing
credentials, source changes, lock/cancel, the production gate, real large EIP712
payloads and exact final BTC bytes at provider/vendor/SDK boundaries. UI tests
exercise React handlers with mocks; native rendering and real hardware remain
part of the acceptance checklist above.

The follow-up phase-1 run passed 17 Jest suites / 223 tests and all 3 SDK
redaction Node tests. The unified pre-commit gate passed lint, format, storage,
background RPC contract, test-integrity and full TypeScript checks. Independent
review found an early saved-resume commit/cancellation window; the final code
keeps resume cancellable, guards cache hydration, and rolls back only a newly
enabled matching source. A stale duplicate resume cannot disable a source that
was already enabled. These are client mock/control-flow results.

| Follow-up review dimension | Score | Scope |
| --- | --- | --- |
| Security | 8/10 | Exact final bytes, internal adapter boundary, no secret UI export |
| Code quality | 8/10 | Cancel/source/hydration regression and explicit resume UI |
| Architecture | 8/10 | Existing persistence and source locks retained |
| Completeness | 7/10 | Native rendering/device/server certification remains external |
| Weighted total | 7.9/10 | Client fixes reviewed; no production hardware certification implied |
