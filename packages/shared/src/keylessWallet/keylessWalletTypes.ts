import type { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';

export type IKeylessWalletShare = string; // base64 string

export type IKeylessWalletUserInfo = {
  cloudKeyProvider: ECloudBackupProviderType;
  cloudKeyUserId: string;
  cloudKeyUserEmail: string;

  onekeyIdEmail: string;
  onekeyIdUserId: string;
};

export type IShareKeyXCoordination = {
  deviceKeyX: number;
  cloudKeyX: number;
  authKeyX: number;
};

export type IDeviceKeyPackEncryptedData = {
  deviceKey: string;
  xCoordination: IShareKeyXCoordination;
  userInfo: IKeylessWalletUserInfo;
};
export type IDeviceKeyPack = {
  packSetId: string;
  cloudKeyProvider: ECloudBackupProviderType;

  authKeyPwd: string; // derived from authKeyPwdSlice + ... (plaintext)
  authKeyPwdHash: string;
  authKeyPwdSlice: string;

  cloudKeyPwd: string; // derived from cloudKeyPwdSlice + ... (plaintext)
  cloudKeyPwdHash: string;
  cloudKeyPwdSlice: string;

  // Encrypted JSON.stringify({ deviceKey })
  // Encrypted with deviceKeyPwd
  encrypted: string; // IDeviceKeyPackEncryptedData
  deviceKeyPwdHash: string;
};

export type IAuthKeyPackEncryptedData = {
  authKey: string;
  cloudKeyPwdSlice: string;
  deviceKeyPwdSlice: string;
  xCoordination: IShareKeyXCoordination;
  userInfo: IKeylessWalletUserInfo;
};
export type IAuthKeyPack = {
  packSetId: string;
  cloudKeyProvider: ECloudBackupProviderType;

  // Encrypted JSON.stringify({ authKey, cloudKeyPwdSlice, deviceKeyPwdSlice })
  // Encrypted with authKeyPwd
  encrypted: string; // IAuthKeyPackEncryptedData
  authKeyPwdHash: string;
};

export type ICloudKeyPackEncryptedData = {
  cloudKey: string;
  deviceKeyPwdSlice: string;
  xCoordination: IShareKeyXCoordination;
  userInfo: IKeylessWalletUserInfo;
};
export type ICloudKeyPack = {
  packSetId: string;

  authKeyPwdSlice: string; // plaintext

  // Encrypted JSON.stringify({ cloudKey, deviceKeyPwdSlice })
  // Encrypted with cloudKeyPwd
  encrypted: string; // ICloudKeyPackEncryptedData
  cloudKeyPwdHash: string;
};

export type IKeylessMnemonicInfo = {
  mnemonic: string;
  deviceKey: string;
  cloudKey: string;
  authKey: string;
  deviceKeyX: number;
  cloudKeyX: number;
  authKeyX: number;
  deviceKeyPwdSlice: string;
  cloudKeyPwdSlice: string;
  authKeyPwdSlice: string;
};

export type IKeylessWalletPacks = IKeylessMnemonicInfo & {
  // device, cloud, auth (base64 strings)
  deviceKeyPack: IDeviceKeyPack;
  authKeyPack: IAuthKeyPack;
  cloudKeyPack: ICloudKeyPack;
};

export type IKeylessWalletRestoredData = {
  authKeyPackData: IAuthKeyPackEncryptedData | undefined;
  deviceKeyPackData: IDeviceKeyPackEncryptedData | undefined;
  cloudKeyPackData: ICloudKeyPackEncryptedData | undefined;
  packs: IKeylessWalletPacks;
};
