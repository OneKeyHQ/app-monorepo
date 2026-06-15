/**
 * Redaction for Trezor THP SDK debug-log payloads. The injected SDK logger
 * receives raw `data` that can contain THP handshake packets (`packetHex`),
 * pairing credentials and host/device keys. Any sink that persists or forwards
 * these (desktop file log, extension offscreen → background sdkLog) MUST run the
 * payload through `sanitizeTrezorThpModuleLogData` first — single source of
 * truth so the desktop and extension redaction sets never drift apart.
 */

const TREZOR_THP_MODULE_REDACTED_KEYS = new Set([
  'credential',
  'credentials',
  'trezor_static_public_key',
  'host_static_key',
  'privateKey',
  'publicKey',
  'hostKey',
  'trezorKey',
  'encryptedPayload',
  'packetHex',
  'pin',
  'passphrase',
  'stack',
  'sendNonce',
  'recvNonce',
]);

const TREZOR_THP_MODULE_REDACTED_DATA_KEY_VALUES = new Set([
  'credential',
  'credentials',
  'trezor_static_public_key',
  'host_static_key',
  'pin',
  'passphrase',
]);

const sanitizeTrezorThpModuleLogValue = (
  key: string,
  value: unknown,
): unknown => {
  if (TREZOR_THP_MODULE_REDACTED_KEYS.has(key)) return '[redacted]';
  if (Array.isArray(value)) {
    // `dataKeys` / `messageKeys` are arrays of field NAMES (not values), but a
    // sensitive name still hints at presence — drop those entries.
    if (key === 'dataKeys' || key === 'messageKeys') {
      return value.filter(
        (item) =>
          typeof item !== 'string' ||
          !TREZOR_THP_MODULE_REDACTED_DATA_KEY_VALUES.has(item),
      );
    }
    return value.map((item) => sanitizeTrezorThpModuleLogValue(key, item));
  }
  if (value && typeof value === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(
      value as Record<string, unknown>,
    )) {
      sanitized[childKey] = sanitizeTrezorThpModuleLogValue(
        childKey,
        childValue,
      );
    }
    return sanitized;
  }
  return value;
};

export const sanitizeTrezorThpModuleLogData = (
  data?: Record<string, unknown>,
): Record<string, unknown> | undefined => {
  if (!data) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    sanitized[key] = sanitizeTrezorThpModuleLogValue(key, value);
  }
  return sanitized;
};
