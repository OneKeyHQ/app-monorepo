# Hardware Cloud key: phase 1 acceptance

This implementation replaces the credential source, not the sync payload or wire
protocol. One Keyless wallet or one standard OneKey hardware wallet supplies the
global Cloud key. Existing Keyless credential persistence, cache, request signing,
request nonce, encryption, and sync services are shared. Existing Keyless seed
derivation is unchanged. Full hardware account snapshots and recovery without
device interaction belong to phase 2 and are not implemented here.

## Frozen derivation contract

- Version: `1`.
- Wallet: standard wallet, empty passphrase. An attached hidden-wallet PIN session
  is rejected. The identity is read live from the device; no App wallet record
  is involved.
- Path: `m/44'/0'/924823361'/1/835069775`, Bitcoin P2PKH. It keeps the BIP44
  Legacy shape so firmware path checks accept it under default safety checks;
  the account and address indexes are far beyond any account the App creates.
  The indexes are public in this source and are not secret.
- Operation: legacy `btcSignMessage`, not BIP322, Taproot, or transaction signing.
- Message: the exact ASCII bytes below, with the final placeholder replaced by
  the first 16 lowercase hex characters of SHA256 of the canonical full wallet
  XFP. The resulting message is 147 bytes and has no trailing newline.

```text
WARNING: Unlock ALL OneKey Cloud data. Sign ONLY in OneKey App, never in other apps or dApps.
OneKey Cloud Key v1
Standard wallet: <16 lowercase hex characters>
```

The version stays `1`: this path and message replaced, before any release, the
earlier `m/44'/0'/100'/0/0` with its 113-byte message, a short-lived
`m/7426'/0'/0'/0/0`, and `m/7426'/8237'/5103'/9461/2772`, which firmware rejects
("Forbidden key path"). A development profile activated with
an earlier contract derives a different key now; its encrypted records are
rejected by the `pwdHash` check, so use a fresh profile.

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

## Platform gate and source lifecycle

There is no development-build gate. Root generation runs in native builds, in
desktop builds using direct WebUSB or DesktopWebBle, in the web build using
WebUSB, and in the browser extension using WebUSB. Bridge on any platform fails closed. On web and
in the extension the credential has no OS secure storage and falls back to the
same ordinary storage and fixed local wrapper as Keyless there (IndexedDB on
web and in the extension). Device debug logging must be off, and
the sensitive background scope suppresses device event forwarding. The App does
not patch the hardware SDK: `hd-core` still keeps `btcSignMessage` payloads in
its in-memory log ring (`getLogs`) until the SDK adds it to
`LogPayloadBlockMethod`. Nothing in the App reads that ring today; keep it that
way until the SDK fix ships. Do not
remove these transport and logging gates to test a device. The model/firmware
compatibility matrix below is still a release blocker.

The hardware section renders on desktop, native, web and the extension. While a hardware source is
selected, the ordinary Cloud sync section is hidden. Only an explicit user action
deletes a key in use: turning sync off or switching back to Keyless. Leftover keys
are swept instead: a stored hardware key whose sync is off is deleted at startup,
daily, and when the Cloud sync page opens. A key in use is never removed
automatically, and Keyless auto-enable never moves a hardware space to Keyless.

An App version without hardware Cloud keys deletes the stored key and resets the
wallet ID on its first wallet read, but leaves sync on and the source selected.
It never uploads the hardware records, whose `pwdHash` differs. Back on a
supporting version, the section shows **Turn on sync with hardware** and the same
standard wallet can sign again without turning sync off first. If the older
version was used to turn Keyless sync on again, the local records now use the
Keyless key; re-signing is rejected by the `pwdHash` check and nothing is
changed, so the user stays on Keyless through an explicit choice.

The user does not add the hardware wallet to the App first. On the Cloud sync
page, **Turn on sync with hardware** opens onboarding's **Connect your device**
window as a dialog (`ConnectDeviceChannels` with `variant="dialog"`): the same
parts laid out as plain dialog content, without the cover video, the card
chrome or the slide-in that onboarding's embedded page keeps. Scanning, the
USB/Bluetooth tabs, Bluetooth permission checks and the web/extension WebUSB
chooser (**Start connection**) behave as in onboarding. The extension popup and side panel open the Cloud sync page in a
full tab first, because the chooser cannot open there. The window closes on the
picked device and hands only its connectId on; no wallet or device record is
created. The transport the scan forced is cleared after signing ends, or when
the window is closed without a device. The background then opens
the standard session, reads the standard wallet XFP live, and keeps only its
SHA-256 in `credentialId`. The selected source stores that hash, the derivation
version and the device name and model for display; the raw XFP and its xpub are
not stored. After activation the page shows the device name, model and the
16-character standard wallet tag the device showed in the message.

Use a separate acceptance profile without existing encrypted Cloud records. Turn
off the existing sync mode, then choose **Turn on sync with hardware** and pick
the device. Two identical message confirmations are expected. Activation uses
the existing credential store; right after the commit it runs one full sync, as turning on Keyless does (a failure keeps sync on for **Sync now** to retry); after successful activation ordinary sync and
restart hydration do not require the hardware to remain connected. **Turn off
sync** asks for confirmation and then deletes the stored hardware key; switching
back to Keyless deletes it too. The source stays selected, and **Turn on sync
with hardware** asks a picked device with the same standard wallet for two new
confirmations. When encrypted records exist, a device with another recovery
phrase is rejected after its identity is read and before it is asked to sign;
another device restored from the same recovery phrase is accepted. There is no
device-free resume, and
the ordinary Keyless toggle refuses to enable a selected hardware source whose
key was deleted. App password locking clears the existing memory cache and
cancels an unfinished hardware derivation. Existing platform persistence and
fallback behavior are unchanged.

Credential lookups are now read-only on a missing ID or corrupt payload, because
a stale read may finish after another source has saved its credential. Existing
explicit save, repair, and disable paths own replacement/removal; no second
storage backend or format was introduced.

Both sync modes must be off before changing the source. A switch in either
direction (Keyless to hardware, hardware to Keyless, or one hardware recovery
phrase to another) rebuilds the target space from local data: enabling writes
the records with the new key and the sync flow re-encrypts the rest from their
raw data (`fillingSyncItemsMissingDataFromRawData`), as OneKey ID migration
does. Data that is only on the old space and was never synced to this device is
not carried over, and nothing is deleted from either space. Only re-signing
while sync stays on (a lost key) must match the selected key and its records. A replacement physical device may restore the
same key when the canonical standard-wallet XFP and regenerated credential
match. A mismatch preserves the old credential and records. If activation fails
after credential persistence, sync remains disabled and can be retried with the
same standard wallet. Cancellation is acknowledged only before the credential
commit begins; after that boundary the atomic activation finishes or reports an
error.

The device prompt runs outside the Cloud key locks, so wallet reads and ordinary
sync do not wait for the user. Cancel, a newer activation, App lock and leaving
the page abort the device request and its hardware lease through the same path
as closing a device prompt. The hardware credential is not encrypted with the
App password. Only turning on sync with hardware and the Sync now button in
its section (`askPasswordOnlyIfHdXfpMissing`) ask for it only when
HD wallets still miss the hash or XFP that sync items are built from (filling
them decrypts the seed); otherwise no password is asked for or has to be set.
That check and any prompt run before the device prompt and the key lock, so
the commit has no interactive step. QR wallets get their XFP without a
password. Every other caller, Keyless and OneKey ID included and other
Keyless syncs with a hardware key, asks as before. The commit
then takes the locks
and re-checks the cancel generation, both sync modes, encrypted records and the
stored key. With the stored key deleted on turn off, the encrypted-record
`pwdHash` check is what rejects a different seed on re-activation.

The Cloud key lock only guards short sections that switch the key or write local
sync items with it; it is never held across a password prompt, the device or a
network sync. A server sync records the key it selected local items with and
re-checks that fingerprint before uploading and before every local write,
aborting if the key changed. Saving a new Keyless credential takes only the
credential repair mutex, which every hardware commit also holds. Keyless enable
prompts and repairs outside the key lock and re-checks the selected credential
before writing local items.

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
  packages/kit/src/views/Prime/pages/PrimeCloudSync/HardwareCloudSyncDevicePicker.test.tsx \
  packages/kit-bg/src/services/ServiceSend.hardwareCloudSync.test.ts \
  packages/kit-bg/src/services/ServiceDApp.deriveContextHash.test.ts \
  packages/kit-bg/src/services/ServiceKeylessCloudSync/btcSignMessageCallers.test.ts
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
2. Check firmware path validation on every model and firmware under test, with
   the device's default safety-check setting. Record whether public key,
   address and message signing at `m/44'/0'/924823361'/1/835069775`
   are accepted, rejected (for example "Forbidden key path"), or shown with a
   non-standard path warning. A rejection blocks that model; a warning must be
   reviewed as part of the confirmation flow. Never relax safety checks to pass.
   Results so far: OneKey Pro 2 firmware 1.0.3 over USB accepts this path for
   the public key, the address and the signing prompt. It rejected the earlier
   `m/7426'/8237'/5103'/9461/2772` for addresses with `Failure_DataError,
Forbidden key path`, which is why the path changed. Firmware `Failure_*`
   errors are shown as is instead of the generic unlock error.
3. Without adding the wallet to the App, choose **Turn on sync with hardware**
   on the Cloud sync page and pick the device. Confirm that the
   hardware displays every byte of the 147-byte ASCII warning through scrolling
   or paging, the expected Bitcoin address/path context, and an explicit confirm
   action. Hash-only or truncated displays fail acceptance.
4. Approve both identical requests. Repeat after disconnect, App restart, device
   reboot, and USB/BLE transport change. Confirm the existing key is accepted,
   without inspecting or logging its value. Hidden-wallet or attached-PIN state,
   device substitution, cancel, lock, and disconnect must fail or explicitly
   switch to the verified standard wallet; they must never reuse a hidden key.
5. Restore the same disposable mnemonic on a replacement supported device. Add
   its standard wallet and confirm identical Cloud data can be decrypted. Test
   all intended cross-model/build combinations. Any mismatch blocks that pair.
6. After activation, disconnect hardware and exercise existing upload/download,
   App lock/restart, and Keyless regression. Use **Sync now** in the hardware
   section. **Turn off sync** must delete the key; turning it on again must ask
   the same standard wallet for two new confirmations. Existing encrypted-space
   source changes must be rejected without modifying old records. Do not
   interpret phase 1 metadata sync as full hardware-account restoration without
   interaction.
7. Attempt the exact 147-byte reserved message through dApp/WalletConnect,
   including real RPC escaping and supported byte encodings. Every valid identity
   tag must be rejected before ordinary SDK signing/logging. Check the final
   canonical BTC `messageHex`, not an arbitrary metadata substring. Other text,
   literal JSON/hex/Base64 with different final bytes, large EIP712 data and
   ordinary Legacy accounts must remain usable. No root signature may appear in
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
`btcSignMessageCallers.test.ts` limits `.btcSignMessage(` callers in `packages/`
and `apps/` to the five BTC keyrings and the Cloud SDK adapter, so a new caller
must be reviewed against this guard. Keystone rejects a non-string message, so
the guarded bytes are the bytes handed to its signer.

The derivation path `m/44'/0'/924823361'/1/835069775` keeps the BIP44 shape the
firmware accepts, but its account and address indexes are far beyond the
accounts the App creates (the earlier `m/44'/0'/100'/0/0` was also the 101st
Legacy account). The external guard still matches message bytes, not
paths, and there is no path-only dApp filtering. No existing account, seed or
user data was migrated. Root generation uses the fixed path and a verified
standard wallet; firmware acceptance of this path is checked per model during
hardware acceptance.

Credential persistence intentionally inherits Keyless's secure-storage preference
and ordinary-storage fallback, fixed local encryption wrapper and warm-cache
access while sync stays on, without another hardware signature. Turning sync off
or switching back to Keyless deletes that key, so the device is required again.
This work neither upgrades the boundary to device-presence protection while sync
is on nor adds a new leak/storage backend. Requiring OS secure storage everywhere
or reauthorization on every unlock would be a separate product/platform
compatibility choice; it is not silently enabled.

Sync after activation needs no device: requests use the stored data key and
DPoP-bound tokens, and the background refreshes the access token with the stored
refresh token. A failed refresh keeps the stored token. The server rotates the
refresh token on every use and revokes the session when an older token comes
back, with one exception: the token the current one replaced still refreshes
while the current one is unused, because the reply that carried it was lost (App
killed, network dropped). Without this, a lost reply would make the user sign
with the device again. The e2ee-server mock implements the rule; the production
server must check and rotate in one atomic step. The device is needed again only
after a revoke (sync turned off here, a key reset on another device, an older
token reused), a refresh token that expired, or a lost local key.

The isolated regressions cover key deletion on turn off and on switching back to
Keyless, re-signing to turn sync on again, a different seed after deletion,
source changes, device-prompt cancellation and lock release, server sync aborting
on a key change, the web/extension gate, keys in use surviving page enter and
Keyless auto-enable, re-signing after an older App version dropped the key, real
large EIP712 payloads and exact final
BTC bytes at provider/vendor/SDK boundaries. UI tests exercise React handlers
with mocks; native rendering and real hardware remain part of the acceptance
checklist above.
