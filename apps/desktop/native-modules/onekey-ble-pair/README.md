# Windows Bluetooth pairing helper

This App-owned Rust executable performs Windows WinRT Bluetooth pairing. The
desktop BLE SDK starts it through the host-provided `helperPath`, reads its JSON
events, and sends explicit user decisions over stdin. UI and translated prompts
remain in the App.

## Build and update

On Windows, install the Rust MSVC targets and Windows SDK, then run from the
monorepo root:

```sh
cargo build --manifest-path apps/desktop/native-modules/onekey-ble-pair/Cargo.toml --locked --release --target x86_64-pc-windows-msvc
cargo build --manifest-path apps/desktop/native-modules/onekey-ble-pair/Cargo.toml --locked --release --target aarch64-pc-windows-msvc
```

Copy each `target/<target>/release/onekey-ble-pair.exe` from this crate to the
matching `apps/desktop/public/static/bin/ble-pair/win-{x64,arm64}` directory. Keep
the source, locked dependencies, and matching binaries in the same change.
Validate both binary architectures from the monorepo root:

```sh
node apps/desktop/scripts/verify-windows-ble-pair.js
```

Windows and Store packaging already copy the target executable outside ASAR.
Preserve the SDK process protocol: `pair --address`, JSON stdout events, and
`confirm`/`cancel` stdin decisions. Numeric comparison requires the user's
confirmation; never record the comparison code in logs.

Normal `pair` runs do not create a diagnostic log or emit device descriptors.
Read-only diagnostic commands are explicit and may write device identifiers.
`link` and `pairing-result` events close the host prompt before cleanup. A host
`cancel` remains valid after `confirm` until WinRT pairing finishes; cancellation
of a new bond is cleaned up without deleting an `AlreadyPaired` bond.
