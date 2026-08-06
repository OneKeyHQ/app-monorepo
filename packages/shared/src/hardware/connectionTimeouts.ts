// SDK ensureConnected 的单轮外层超时；Noble 定向扫描和物理连接超时
// 仍由 hd-transport-electron 分别控制。
export const BLE_ONBOARDING_ENSURE_CONNECTED_TIMEOUT_MS = 30_000;

export const DESKTOP_BLE_FIRMWARE_CONNECTION_TIMEOUT_MS = 30_000;
