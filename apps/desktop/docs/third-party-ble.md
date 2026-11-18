# Third-party desktop BLE ownership

The App owns the native Windows pairing helper. Its Rust crate lives in
`apps/desktop/native-modules/onekey-ble-pair`; its x64/ARM64 executables live in
`apps/desktop/public/static/bin/ble-pair/win-{x64,arm64}`. Native Noble fixes and
the Electron native rebuild also remain in this repository.

The Hardware SDK package `@onekeyfe/hwk-desktop-noble-ble` coordinates the helper
process, pairing deadlines, cancellation, connection retry, and structured
errors. The App supplies the helper path and translated comparison dialog through
`app/process/windowsBlePairing.ts`. The SDK does not publish the Rust crate or
native executables.

## Native builds and packaging

Follow the [Rust helper build instructions](../native-modules/onekey-ble-pair/README.md)
when changing native pairing behavior. Update the source and matching App
executables together, preserving the helper process protocol expected by the SDK.

Development resolves `bin/ble-pair/win-${process.arch}/onekey-ble-pair.exe` from
the App static resources. Windows and Store builds copy the target architecture
to `bin/ble-pair/onekey-ble-pair.exe` outside ASAR. These resources continue to be
owned by the App after SDK upgrades.

The App also owns IPC sender authorization in `app/app.ts` and onboarding recovery
instructions/navigation. Keep transport retry timers and pairing decisions in
the SDK coordinator rather than duplicating that logic in the App wrapper.

## SDK release transition

The App currently pins `1.2.11-alpha.1`. The SDK's `1.2.11-alpha.2` source has the
pairing coordinator, but npm publication is a separate release action. Until that
release is available, `patches/@onekeyfe+hwk-desktop-noble-ble+1.2.11-alpha.1.patch`
contains its built CJS/ESM entrypoints and declarations. Generate this patch from
SDK source builds, never as a separate pairing implementation.

After the SDK release, upgrade the aligned dependencies and remove the
superseded SDK patches. Keep the App Rust crate, native executables, and Windows
packaging resources here. Validate normal onboarding and Windows pairing,
cancellation, timeout recovery, and reconnect on real hardware.

The SDK does not auto-accept comparison codes or remove OS bonds. The App must
close its dialog when the supplied `AbortSignal` aborts. Only the user may
confirm numeric comparison; pairing codes never belong in logs.
