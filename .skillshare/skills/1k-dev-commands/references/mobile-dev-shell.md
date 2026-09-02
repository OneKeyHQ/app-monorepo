# Mobile Development Shell

Use the repository's DevSession launcher as the default path for normal React
Native development. It restores or builds the native shell and vendor bundle,
starts Metro, installs the app, and injects a worktree-private session.

## Authorization boundary

Only launch or install the app when the user asks to run, start, or verify it.
For read-only analysis, inspect the scripts or run reports without starting a
simulator, installing an artifact, or triggering CI.

## Launch

Require a booted iOS Simulator or a connected Android emulator/device, then run
one long-lived command from the repository root:

```bash
yarn workspace @onekeyhq/mobile dev-shell --platform ios
yarn workspace @onekeyhq/mobile dev-shell --platform android
```

The root aliases `yarn app:ios` and `yarn app:android` invoke these DevSession
launchers; they are not direct native build commands.

If more than one target is available, do not guess. Resolve the requested UDID
or serial and rerun with `--device <serial-or-UDID>`. The launcher accepts one
available target without an explicit device argument.

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

The iOS resource is an iOS Simulator app artifact, not a device/App Store IPA.
The Android resource is an APK.

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
