# Pro2 Desktop interaction scenarios

These scripts attach to a running OneKey Desktop development client through
CDP. They exercise the real renderer and connected hardware instead of mocking
the SDK.

## Prerequisites

1. Connect and unlock the Pro2 device.
2. Start the client with `yarn app:desktop`.
3. Keep CDP port `9222` available.

## Inspect the current screen

```bash
node scenarios/pro2/inspect.mjs
```

## Diagnose the current Pro 2 connection

This read-only script records the stored USB/BLE connection IDs, active
transport, USB availability, and the serialized result of a silent device-state
query:

```bash
node scenarios/pro2/diagnose-device-connection.mjs
```

## Run the connected-device smoke scenario

```bash
node scenarios/pro2/device-management-smoke.mjs
node scenarios/pro2/label-validation-smoke.mjs
```

The scenario verifies that the Pro2 appears in device management, records its
initial SDK connection state, opens its device details, and renders the
wallpaper/custom-upload page without applying a new wallpaper. Set
`PRO2_SKIP_WALLPAPER=1` to stop after the device details page or
`PRO2_DEVICE_MATCH` to match a different device label. Set `PRO2_RELOAD=1` only
when an explicit renderer reload is required.

The runner keeps the current Electron renderer and closes modal state left by
earlier scenarios. Local React DevTools health checks and known development-only
Portal diagnostics are recorded as non-blocking errors; other renderer errors
fail the scenario.

Screenshots and future scenario artifacts are written to `.tmp/pro2-e2e/`.
The scripts attach to the existing client and never close it.
