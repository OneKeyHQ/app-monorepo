# Local Zcash artifacts and CI restoration

## Current delivery boundary

The runtime, keys and storage benchmark must come from one complete build.
The App still resolves the two existing portals into the sibling `app-modules`
checkout. The runtime package contains the storage benchmark subdirectory.
An installed developer workspace therefore differs from a clean CI checkout.

`app-modules/chain-runtimes/zcash/scripts/build-wasm.sh --offline` builds all
three modules and emits `zcash-wasm-manifest.json`. This records the source
commit, whether source changes are uncommitted, the Cargo lock checksum, and
the exact output inventory with SHA-256 hashes. Local dirty builds remain
explicitly marked. The producer CI verifies a clean revision before upload.

`development/scripts/restore-zcash-runtime.py` accepts an already downloaded
artifact, an exact source revision and a pinned manifest checksum. It verifies
the entire inventory, requires all three packages, rejects dirty provenance
and symlinks, and refuses to replace an existing local runtime. It restores
the original portal layout before Yarn installation. The composite action
`.github/actions/restore-zcash-runtime/action.yml` exposes this operation to CI.

**CI integration is not complete yet.** The repaired source has not been
published as an immutable producer artifact. No workflow run ID, artifact ID
or checksum has been invented, and no consumer workflow downloads an older
artifact in place of these repairs. Once a clean producer artifact exists,
the reviewed consumer pin must record its source commit, workflow run,
artifact identity and manifest checksum; every workflow that installs App
dependencies must download and restore it before `yarn install`. The current
workflows do not share one installation entry point. Artifact retention must
also cover the supported lifetime of the consumer revision.

## Local hardware SDK build

The hardware target is Pro2, Protocol V2, during an authenticated method call.
The same public Zcash methods are exposed through WebUSB, Electron BLE and
React Native BLE. Build the source checkout in dependency order:

1. `shared`, `hd-transport`, `core`.
2. `hd-transport-http`, `hd-transport-electron`, then
   `hd-transport-web-device`; build the low-level, USB, emulator and React
   Native transports as well.
3. `hd-ble-sdk`, `hd-common-connect-sdk`, and the full `hd-web-sdk` build,
   including its iframe and declarations.

Run each package's existing `yarn build` with already installed dependencies.
The explicit local consumer does not load local environment files:

```sh
python3 development/scripts/sync-local-hardware-sdk.py \
  --sdk-root ../hardware-js-sdk \
  --expected-version 1.2.2-alpha.109
```

It validates all 13 packages before mutation, rejects changes to third-party
dependency declarations, retains nested installed dependencies, backs up the
previous packages, verifies copied bytes, and writes a checksum receipt under
`node_modules/.cache`. This is a local development override; reinstalling App
dependencies restores the lockfile versions. It is not a new published SDK
version or a clean-CI dependency pin.

The desktop asset copy step reads the installed SDK's complete `build`
directory. Web and extension iframe hosting must also use this same SDK
build; a local package update alone does not update the remote iframe host.

## Stateless hardware signing

Transparent signing loads the keys module to construct a PCZT from the
account xpub and temporary device fingerprint. The approved external address
is attached to every external output, and Ironwood output metadata uses the
builder's randomized action mapping. Input and change derivations allow the
device to verify ownership and display change correctly.

The device signs the unproved PCZT. The keys module merges and verifies every
transparent signature against the approved request before finalization. The
runtime computation module then proves and extracts the transaction, without
opening WalletDb or starting scanning. All carrier method lists include both
new stateless methods. App main/background are single-runtime on desktop/web;
mobile/extension have separate heaps, and the computation Worker is separate
in every case. These stateless calls acquire no wallet-storage ownership.

The installed-WASM verification script exercises transparent and UA targets
with fixed amounts and Max. It uses synthetic software signatures; it does
not replace a real-device confirmation, transport or iframe acceptance test.
