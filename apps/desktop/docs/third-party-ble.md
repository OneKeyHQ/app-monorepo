# Third-party desktop BLE ownership

The Hardware SDK package `@onekeyfe/hwk-desktop-noble-ble` owns the Windows OS
pairing lifecycle, vendor-specific timing, cancellation, connection retry, and
stale-bond classification. Its package README is the integration contract for
other hosts. The Rust helper source and x64/ARM64 prebuilds are maintained there.

App responsibilities are limited to:

- Authorizing IPC senders in `app/app.ts` and forwarding structured SDK errors.
- Providing the packaged helper path and translated numeric-comparison dialog
  through `app/process/windowsBlePairing.ts`.
- User recovery instructions/navigation in the onboarding UI. These are not
  transport retries or automatic device selection.

Do not add pairing timers, WinRT decision slots, GATT retries, device address
rewrites, or vendor scan filtering to the App module wrapper. Both the developer
test page and normal onboarding use the same SDK implementation.

## SDK release transition

The App currently pins `1.2.11-alpha.1`. The SDK's `1.2.11-alpha.2` source has the
pairing module, but npm publication is a separate release action. Until that
release is available, the patch
`patches/@onekeyfe+hwk-desktop-noble-ble+1.2.11-alpha.1.patch` contains the SDK's
built CJS/ESM entrypoints and TypeScript declarations. It must be generated from
SDK source builds, never maintained as a separate pairing implementation. The
existing adapter-core route-retention patch also remains until the upgrade.

The Windows executable copies under `public/static/bin/ble-pair/win-{x64,arm64}`
remain host packaging resources during this transition. Their bytes match the
SDK's `prebuilds/win32-{x64,arm64}`. Update the SDK-owned Rust source and build
there before refreshing these App resources; do not restore a second Rust crate
in this repository.

After the SDK release:

1. Upgrade the aligned SDK dependencies and regenerate the lockfile.
2. Remove the two superseded SDK patches.
3. Stage the helper from the installed SDK's `prebuilds/win32-${arch}` into the
   existing `bin/ble-pair` resource path for both Windows and Store builds. Once
   both packaged builds and development resolve the SDK assets, remove the
   transitional static copies.
4. Run the pairing, scan handoff, route-retention, and onboarding recovery tests,
   then verify the Windows installer contains the correct architecture helper.

The SDK does not auto-accept comparison codes or remove OS bonds. The App must
close its dialog when the supplied `AbortSignal` aborts. Only the user may
confirm numeric comparison; pairing codes never belong in logs.
