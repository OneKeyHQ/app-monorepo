import appCrypto from '@onekeyhq/shared/src/appCrypto';

export function getHardwareCloudSyncDeviceSerialNoHash(
  serialNo: string | null | undefined,
): string | undefined {
  const normalized = serialNo?.trim().toLowerCase();
  if (!normalized || /^0+$/.test(normalized)) return undefined;
  return Buffer.from(
    appCrypto.hash.sha256Sync(Buffer.from(normalized, 'utf8')),
  ).toString('hex');
}
