// Outer timeout for one SDK ensureConnected attempt; hd-transport-electron
// still owns the Noble targeted-scan and physical-connection timeouts.
export const BLE_ONBOARDING_ENSURE_CONNECTED_TIMEOUT_MS = 30_000;

export const DESKTOP_BLE_FIRMWARE_CONNECTION_TIMEOUT_MS = 30_000;

// Bounded probe for silently binding a caller-held live BLE connectId: a
// live session answers within a few seconds, so a stale endpoint must fail fast for the pairing dialog fallback to appear before the 60s call timeout.
export const DESKTOP_BLE_SILENT_BIND_CONNECTION_TIMEOUT_MS = 10_000;
