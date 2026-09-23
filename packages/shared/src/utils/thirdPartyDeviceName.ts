/**
 * The vendor SDK names its own device; the app only picks the first field that
 * carries a name and falls back to the brand when none does.
 */
export function getThirdPartyDeviceDisplayName({
  brand,
  modelName,
  model,
  name,
}: {
  brand: string;
  modelName?: string;
  model?: string;
  name?: string;
}): string {
  // A transport address is not a name (e.g. a 32-char Trezor BLE connectId
  // must not reach the device list), and 'unknown' is a placeholder for "not knowable yet", not something to show.
  const isUsableName = (value?: string) =>
    Boolean(value) &&
    !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value ?? '') &&
    !/\b[0-9a-f]{32,}\b/i.test(value ?? '') &&
    value?.toLowerCase() !== 'unknown';

  return [name, modelName, model].find(isUsableName) || brand;
}
