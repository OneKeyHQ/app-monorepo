// Outer timeout for one SDK ensureConnected attempt; hd-transport-electron
// still owns the Noble targeted-scan and physical-connection timeouts.
export const BLE_ONBOARDING_ENSURE_CONNECTED_TIMEOUT_MS = 30_000;

export const DESKTOP_BLE_FIRMWARE_CONNECTION_TIMEOUT_MS = 30_000;

// Bounded probe for silently binding a caller-held live BLE connectId.
// A live session answers within a few seconds (two round trips with
// protocol detection); a stale endpoint must fail fast so the pairing
// dialog fallback appears promptly instead of after the 60s call timeout.
export const DESKTOP_BLE_SILENT_BIND_CONNECTION_TIMEOUT_MS = 10_000;
