/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { ECloudBackupProviderType } from '@onekeyhq/shared/src/cloudBackup/cloudBackupTypes';

import type { JWTPayload } from 'jose';

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

export type IKeylessBackendShare = {
  encryptedMnemonic: string;
  backendShare: string;
  // pinSalt: string; // TODO
  juiceboxShareX: number; // x-coordinate of the juicebox share for recovery
};

export type IKeylessJuiceboxShare = {
  ownerId: string;
  pin: string;
  juiceboxShare: string;
  backendShareX: number; // x-coordinate of the backend share for recovery
};

export type ISupabaseJWTPayload = JWTPayload & {
  app_metadata: {
    /*
     Do not use this field as the final Provider. If a user uses the same Gmail address for both Apple and Google, this field will always default to the first platform used for login.
     For example:
     1. If the user first logs in using Google, the Provider will permanently remain as Google.
     2. Even if they subsequently log in using Apple, the field will not update to reflect Apple.
     This remains the case as long as the same Gmail address is associated with both the Apple and Google accounts.
    */
    provider: string;
  };
  user_metadata: {
    sub: string;
    iss: string;
  };
};
