export function isBluetoothFirmwareUpdateTransport({
  isNative,
}: {
  isNative: boolean | undefined;
}) {
  return Boolean(isNative);
}
