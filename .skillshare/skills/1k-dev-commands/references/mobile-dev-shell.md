# Mobile Development Shell

Use the repository's DevSession launcher as the default path for normal React
Native development. It restores or builds the native shell and vendor bundle,
starts Metro, installs the app, and injects a worktree-private session.

## Authorization boundary

Only launch or install the app when the user asks to run, start, or verify it.
For read-only analysis, inspect the scripts or run reports without starting a
simulator, installing an artifact, or triggering CI.

## Launch

Require an available iOS Simulator or a connected Android emulator/device, then
run one long-lived command from the repository root:

```bash
yarn workspace @onekeyhq/mobile dev-shell --platform ios
yarn workspace @onekeyhq/mobile dev-shell --platform android
```

The root aliases `yarn app:ios` and `yarn app:android` invoke these DevSession
launchers; they are not direct native build commands.

For iOS, the launcher reuses the sole booted simulator, or selects the sole
available simulator when none are booted. Otherwise, an interactive terminal
shows a numbered list with device names, runtime versions, states, and UDIDs.
The selected simulator is booted if needed and awaited before app installation.
An explicit `--device <UDID>` can also select a shutdown simulator.

In non-interactive sessions with multiple candidates, do not guess. Resolve the
requested UDID or serial and rerun with `--device <serial-or-UDID>`. The error
lists available devices. Android still requires a connected emulator/device and
an explicit serial when multiple targets are connected.

`--metro-url <origin>` overrides only the device-visible route written into the
private session. Use it for a LAN address or reverse proxy that routes to the
Metro process started by this launcher. It does not attach to an independently
started Metro process; the launcher-owned process receives the session ID used
to reject requests from other worktrees and device sessions.

The target must support the published shell architecture: `arm64` for an iOS
Simulator or `arm64-v8a` for Android. The launcher rejects unsupported targets
before restoring, building, or installing a shell.

Keep the default `--shell auto --vendor auto` behavior. It restores trusted
remote resources when compatible and performs the supported local fallback when
needed. Use `--shell local`, `--shell remote`, `--vendor local`, or a vendor tag
only when the user explicitly requests that mode or when diagnosing the launcher.
Do not reproduce the download, attestation, cache, extraction, installation, or
fallback logic with ad hoc commands.

Native shell selection requires an exact input key that includes native source
contents and build/signing inputs as well as the ABI contract. The launcher does
not fall back to an older shell merely because its exported native interface is
compatible. If the matching remote artifact is unavailable, `--shell auto` builds
locally and caches that result. JavaScript-only edits do not change this native
input key.

The iOS resource is an iOS Simulator app artifact, not a device/App Store IPA.
The Android resource is an APK.

Before installing an iOS shell, the launcher checks for Xcode's embedded
simulator entitlements. With `--shell auto`, an older shell missing them triggers
a local native rebuild. Simulator permissions must be embedded during the build;
adding restricted iOS entitlements to an ad-hoc signature is not sufficient.
The installer verifies the extracted app and its vendor frameworks and repairs
only invalid signatures. A repaired archive is cached separately, keyed to the
original archive digest and build/signing rules; subsequent launches verify and
reuse it. The verified remote archive stays unchanged. CI uses the
same signing and verification routine after injecting the final Info.plist and
before packaging the archive; missing entitlements or invalid signatures fail the
build before publication.

With the default `--shell auto`, a successful local rebuild is saved as a complete
archive under `apps/mobile/out-dir-bundle/dev-shell/local-cache`. The next launch
checks its native shell key, build/signing inputs, size, and SHA-256 before trying
remote resources. A valid hit skips CocoaPods, Xcode/Gradle, and packaging. Missing,
modified, or obsolete archives follow the normal restore/build path. Explicit
`--shell local` still requests a build; native build intermediates remain reusable.

WebEmbed checks `web-build` against its canonical build or verified restore receipt
before downloading. Matching source inputs and output-tree digests skip both the
download and build, including after a previous 404 fallback. Changed inputs or
missing/modified output trigger restore, then the automatic local build if needed.

WebEmbed saves its dependency scan under `out-dir-bundle/web-embed-input-cache.json`.
New launcher processes validate source contents, package/lock metadata, symlinks,
and the resolver's existing/missing path dependencies before reusing the input
key. Unchanged inputs skip source parsing and module resolution. Changed inputs,
new higher-priority resolution candidates, or a corrupt scan cache trigger a full
scan; `yarn clean` removes this cache too.

`yarn clean` removes mobile `out-dir-bundle` (local shells, repaired signatures,
vendor output, and sessions), WebEmbed output and receipts, and `ios/outputs` in
addition to dependencies and Pods. It also clears every version of the shared
OneKey shell/vendor caches at the default and configured locations, including
`XDG_CACHE_HOME` and `ONEKEY_METRO_PREBUNDLE_CACHE_DIR`. These shared caches may
serve other worktrees. The next launch after dependency installation must restore
or build fresh artifacts.

## Completion and reporting

Do not treat process startup or artifact existence as success. Wait for
`[ONEKEY_RUN_SUMMARY]` with `status=running`, and retain the long-lived Metro
process while the app is being used or verified.

Read the path printed by `[ONEKEY_RUN_REPORT]` when diagnosing or reporting the
run. Report every `[ONEKEY_USER_NOTICE]` and every receipt with
`userNoticeRequired: true`, including compatible-resource or local-build
fallbacks. Include the selected platform/device and the resolved shell and
vendor sources in the result.

For visual or interaction verification, continue with `/1k-ui-verify` after the
development shell is running. Verify actual app readiness, navigation state,
content, and relevant logs rather than only checking that the process exists.

## Boundaries

- Use direct `yarn workspace @onekeyhq/mobile ios` or
  `yarn workspace @onekeyhq/mobile android` only for an explicitly requested
  native rebuild or to diagnose the DevSession launcher itself.
- Do not trigger the mobile dev-shell publishing workflows merely to launch RN.
- Publishing trusted remote shell resources requires an explicit request and is
  restricted by the workflows to `refs/heads/x`.
- Treat `apps/mobile/scripts/native-dev-shell.js` and
  `apps/mobile/scripts/mobile-dev-shell-resource.js` as the execution source of
  truth; update this reference only when their user-facing contract changes.
