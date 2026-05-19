export enum EAppCryptoSharedEncryptScene {
  cloudBackupV1Credential = 'cloud-backup-v1-credential',
  cloudBackupV1PrivateData = 'cloud-backup-v1-private-data',
  cloudBackupV2PrivateData = 'cloud-backup-v2-private-data',
  cloudBackupV2PasswordVerify = 'cloud-backup-v2-password-verify',
  keylessBackendSharePayload = 'keyless-backend-share-payload',
  keylessCloudSyncCredentialStorage = 'keyless-cloud-sync-credential-storage',
  keylessCloudSyncItem = 'keyless-cloud-sync-item',
  keylessMnemonic = 'keyless-mnemonic',
  keylessWalletAuthKeyPack = 'keyless-wallet-auth-key-pack',
  keylessWalletCloudKeyPack = 'keyless-wallet-cloud-key-pack',
  keylessWalletDeviceKeyPack = 'keyless-wallet-device-key-pack',
  primeCloudSyncItem = 'prime-cloud-sync-item',
  primeMasterPasswordLocalCache = 'prime-master-password-local-cache',
  primeMasterPasswordServerPayload = 'prime-master-password-server-payload',
  primeTransferCredentials = 'prime-transfer-credentials',
  primeTransferPayload = 'prime-transfer-payload',
  primeTransferPairingVerification = 'prime-transfer-pairing-verification',
}

export type IAppCryptoSharedEncryptFormat = 'legacy' | 'v2';

export function resolveSharedEncryptFormat({
  format,
  scene,
}: {
  format?: IAppCryptoSharedEncryptFormat;
  scene?: EAppCryptoSharedEncryptScene;
}): IAppCryptoSharedEncryptFormat {
  void scene;
  return format ?? 'legacy';
}
