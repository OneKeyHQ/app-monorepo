import {
  decryptAsync,
  encryptAsync,
  entropyToMnemonic,
  generateMnemonic,
  mnemonicToEntropy,
  sha256,
} from '@onekeyhq/core/src/secret';

import appCrypto from '../appCrypto';
import { OneKeyLocalError } from '../errors';
import bufferUtils from '../utils/bufferUtils';
import stringUtils from '../utils/stringUtils';

import shamirUtils from './shamirUtils';

import type {
  IAuthKeyPack,
  IAuthKeyPackEncryptedData,
  ICloudKeyPack,
  ICloudKeyPackEncryptedData,
  IDeviceKeyPack,
  IDeviceKeyPackEncryptedData,
  IKeylessMnemonicInfo,
  IKeylessWalletPacks,
  IKeylessWalletRestoredData,
  IKeylessWalletUserInfo,
} from './keylessWalletTypes';

// TODO packs use base64 instead of hex for less storage space

// Password derivation functions
type IKeyType = 'deviceKey' | 'cloudKey' | 'authKey';

const SHARE_KEY_PWD_FIXED_UUID: Record<IKeyType, string> = {
  deviceKey: '99C79104-F920-407B-9C2B-F4CDBC427F91',
  cloudKey: '67341352-B635-45C6-BE7A-A35E0CDBFC0D',
  authKey: '1C766505-8009-4058-B09D-C8515A3F096F',
};

async function deriveKeyPwd(params: {
  pwdSlice: string;
  keyType: IKeyType;
  extraSalt?: string;
}): Promise<string> {
  const { pwdSlice, keyType, extraSalt } = params;
  const salt = (extraSalt ?? '') + SHARE_KEY_PWD_FIXED_UUID[keyType];
  // pwdSlice is base64 string, decode it to bytes
  const pwdSliceBytes = bufferUtils.base64ToBytes(pwdSlice);
  const derivedKeyBytes = await appCrypto.pbkdf2.pbkdf2({
    password: pwdSliceBytes,
    salt: bufferUtils.utf8ToBytes(salt),
    iterations: 1000,
    keyLength: 32,
  });
  // Return base64 string instead of hex
  return bufferUtils.bytesToBase64(derivedKeyBytes);
}

function deriveDeviceKeyPwd(deviceKeyPwdSlice: string): Promise<string> {
  return deriveKeyPwd({ pwdSlice: deviceKeyPwdSlice, keyType: 'deviceKey' });
}

function deriveCloudKeyPwd(
  cloudKeyPwdSlice: string,
  onekeyIdUserId: string,
): Promise<string> {
  return deriveKeyPwd({
    pwdSlice: cloudKeyPwdSlice,
    keyType: 'cloudKey',
    extraSalt: onekeyIdUserId,
  });
}

function deriveAuthKeyPwd(
  authKeyPwdSlice: string,
  // TODO remove this param, 假如 cloudKeyUserId 会导致切换 Cloud 存储后，其余的旧 deviceKey 都失效
  // _cloudKeyUserId: string,
): Promise<string> {
  return deriveKeyPwd({
    pwdSlice: authKeyPwdSlice,
    keyType: 'authKey',
    // extraSalt: cloudKeyUserId,
  });
}

async function hashPassword(pwd: string): Promise<string> {
  // pwd is base64 string, decode it to bytes
  const pwdBytes = bufferUtils.base64ToBytes(pwd);
  const hashBytes = await sha256(pwdBytes);
  // Return base64 string instead of hex
  return bufferUtils.bytesToBase64(hashBytes);
}

/**
 * Extract the x-coordinate from a share.
 * Share format (shamir-secret-sharing library): [y-values (N bytes), x-coordinate (1 byte)]
 */
function getShareXCoordinate(shareBase64: string): number {
  const shareBytes = bufferUtils.base64ToBytes(shareBase64);
  return shareBytes[shareBytes.length - 1];
}

async function restoreMnemonicFromShareKey(params: {
  deviceKey?: string;
  cloudKey?: string;
  authKey?: string;
}): Promise<{
  shares: string[];
  mnemonic: string;
}> {
  const { deviceKey, cloudKey, authKey } = params;
  const shares = [deviceKey, cloudKey, authKey].filter(Boolean);
  if (shares.length < 2) {
    throw new OneKeyLocalError('Keyless wallet shares are not enough');
  }
  const entropyBytes = await shamirUtils.combine(
    shares.map((s) => new Uint8Array(bufferUtils.base64ToBytes(s))),
  );
  const mnemonic = entropyToMnemonic(bufferUtils.toBuffer(entropyBytes));
  return {
    mnemonic,
    shares,
  };
}

async function decryptPackData<T>(params: {
  encrypted: string;
  password: string;
}): Promise<T> {
  const { encrypted, password } = params;
  // encrypted is base64 string, decode it to buffer
  const encryptedBuffer = bufferUtils.base64ToBytes(encrypted);
  const decryptedBuffer = await decryptAsync({
    password,
    data: encryptedBuffer,
    allowRawPassword: true,
  });
  const decryptedStr = bufferUtils.bytesToUtf8(decryptedBuffer);
  return JSON.parse(decryptedStr) as T;
}

async function generateKeylessMnemonic(): Promise<IKeylessMnemonicInfo> {
  // 1. Generate Random Mnemonic (24 words)
  const mnemonic = generateMnemonic(256);
  const entropyHex = mnemonicToEntropy(mnemonic);
  const entropyBytes = bufferUtils.toBuffer(entropyHex); // Use bufferUtils for consistency

  // 2. Split into 3 shares (2-of-3)
  // Shamir-secret-sharing split returns Promise<Uint8Array[]>
  const sharesBytes = await shamirUtils.split(
    // entropyBytes is already a Buffer (Uint8Array), no need to convert
    // Ensure entropyBytes is a Uint8Array to prevent 'secret must be a Uint8Array' error
    new Uint8Array(entropyBytes),
    3,
    2,
  );
  const shares: string[] = sharesBytes.map((s: Uint8Array) =>
    bufferUtils.bytesToBase64(s),
  );
  const [deviceKey, cloudKey, authKey] = shares;

  // Extract X coordinates from shares
  const deviceKeyX: number = getShareXCoordinate(deviceKey);
  const cloudKeyX: number = getShareXCoordinate(cloudKey);
  const authKeyX: number = getShareXCoordinate(authKey);

  // 3. Generate Password Slices (Random)
  // Generate 32 bytes random data and encode as base64 strings
  const deviceKeyPwdSlice = bufferUtils.bytesToBase64(
    crypto.getRandomValues(new Uint8Array(32)),
  );
  const cloudKeyPwdSlice = bufferUtils.bytesToBase64(
    crypto.getRandomValues(new Uint8Array(32)),
  );
  const authKeyPwdSlice = bufferUtils.bytesToBase64(
    crypto.getRandomValues(new Uint8Array(32)),
  );

  return {
    mnemonic,
    deviceKey,
    cloudKey,
    authKey,
    deviceKeyX,
    cloudKeyX,
    authKeyX,
    deviceKeyPwdSlice,
    cloudKeyPwdSlice,
    authKeyPwdSlice,
  };
}

function generateKeylessWalletPackSetId(): string {
  return stringUtils.generateUUID({ removeDashes: true });
}

async function generateKeylessWalletPacks(params: {
  userInfo: IKeylessWalletUserInfo;
  mnemonicInfo: IKeylessMnemonicInfo;
  packSetId: string;
}): Promise<IKeylessWalletPacks> {
  const { userInfo, mnemonicInfo, packSetId } = params;
  // Validate the packSetId with regex: must match UUID (v4) without dashes (32 lowercase hex characters)
  if (!/^[0-9a-f]{32}$/.test(packSetId)) {
    throw new OneKeyLocalError(
      'Invalid packSetId: must be a 32-character lowercase hex string (UUID with dashes removed)',
    );
  }
  const { onekeyIdEmail, onekeyIdUserId, cloudKeyProvider, cloudKeyUserId } =
    userInfo;

  if (!onekeyIdEmail) {
    throw new OneKeyLocalError(
      'CreateKeylessWallet ERROR: onekeyIdEmail is required',
    );
  }
  if (!onekeyIdUserId) {
    throw new OneKeyLocalError(
      'CreateKeylessWallet ERROR: onekeyIdUserId is required',
    );
  }
  if (!cloudKeyProvider) {
    throw new OneKeyLocalError(
      'CreateKeylessWallet ERROR: cloudKeyProvider is required',
    );
  }
  if (!cloudKeyUserId) {
    throw new OneKeyLocalError(
      'CreateKeylessWallet ERROR: cloudKeyUserId is required',
    );
  }
  if (!mnemonicInfo) {
    throw new OneKeyLocalError(
      'CreateKeylessWallet ERROR: mnemonicInfo is required',
    );
  }

  const {
    mnemonic,
    deviceKey,
    cloudKey,
    authKey,
    deviceKeyX,
    cloudKeyX,
    authKeyX,
    deviceKeyPwdSlice,
    cloudKeyPwdSlice,
    authKeyPwdSlice,
  } = mnemonicInfo;

  // 4. Derive Passwords
  const deviceKeyPwd = await deriveDeviceKeyPwd(deviceKeyPwdSlice);
  const cloudKeyPwd = await deriveCloudKeyPwd(cloudKeyPwdSlice, onekeyIdUserId);
  const authKeyPwd = await deriveAuthKeyPwd(authKeyPwdSlice);

  // 5. Hash Passwords (for storage/verification, spec has *Hash fields)
  const deviceKeyPwdHash = await hashPassword(deviceKeyPwd);
  const cloudKeyPwdHash = await hashPassword(cloudKeyPwd);
  const authKeyPwdHash = await hashPassword(authKeyPwd);

  // 6. Create Packs
  // DeviceKeyPack
  // encrypted: { deviceKey }
  const deviceKeyPackEncryptedData: IDeviceKeyPackEncryptedData = {
    deviceKey,
    userInfo,
    xCoordination: {
      deviceKeyX,
      cloudKeyX,
      authKeyX,
    },
  };
  // Encrypt and return as base64 string
  const deviceKeyPackEncryptedBuffer = await encryptAsync({
    allowRawPassword: true,
    password: deviceKeyPwd,
    data: bufferUtils.utf8ToBytes(
      stringUtils.stableStringify(deviceKeyPackEncryptedData),
    ),
  });
  const deviceKeyPackEncryptedString = bufferUtils.bytesToBase64(
    deviceKeyPackEncryptedBuffer,
  );

  const deviceKeyPack: IDeviceKeyPack = {
    packSetId,
    cloudKeyProvider,

    authKeyPwd, // plaintext
    authKeyPwdHash,
    authKeyPwdSlice,

    cloudKeyPwd, // plaintext
    cloudKeyPwdHash,
    cloudKeyPwdSlice,

    deviceKeyPwdHash,
    encrypted: deviceKeyPackEncryptedString,
  };

  // AuthKeyPack
  // encrypted: { authKey, cloudKeyPwdSlice, deviceKeyPwdSlice }
  const authKeyPackEncryptedData: IAuthKeyPackEncryptedData = {
    authKey,
    cloudKeyPwdSlice,
    deviceKeyPwdSlice,

    userInfo,
    xCoordination: { deviceKeyX, cloudKeyX, authKeyX },
  };
  // Encrypt and return as base64 string
  const authKeyPackEncryptedBuffer = await encryptAsync({
    allowRawPassword: true,
    password: authKeyPwd,
    data: bufferUtils.utf8ToBytes(
      stringUtils.stableStringify(authKeyPackEncryptedData),
    ),
  });
  const authKeyPackEncryptedString = bufferUtils.bytesToBase64(
    authKeyPackEncryptedBuffer,
  );

  const authKeyPack: IAuthKeyPack = {
    packSetId,
    cloudKeyProvider,

    authKeyPwdHash,
    encrypted: authKeyPackEncryptedString,
  };

  // CloudKeyPack
  // encrypted: { cloudKey, deviceKeyPwdSlice }
  const cloudKeyPackEncryptedData: ICloudKeyPackEncryptedData = {
    cloudKey,
    deviceKeyPwdSlice,

    userInfo,
    xCoordination: { deviceKeyX, cloudKeyX, authKeyX },
  };
  // Encrypt and return as base64 string
  const cloudKeyPackEncryptedBuffer = await encryptAsync({
    allowRawPassword: true,
    password: cloudKeyPwd,
    data: bufferUtils.utf8ToBytes(
      stringUtils.stableStringify(cloudKeyPackEncryptedData),
    ),
  });
  const cloudKeyPackEncryptedString = bufferUtils.bytesToBase64(
    cloudKeyPackEncryptedBuffer,
  );

  const cloudKeyPack: ICloudKeyPack = {
    packSetId,

    authKeyPwdSlice, // plaintext

    cloudKeyPwdHash,
    encrypted: cloudKeyPackEncryptedString,
  };

  return {
    mnemonic,
    deviceKey,
    cloudKey,
    authKey,
    deviceKeyX,
    cloudKeyX,
    authKeyX,
    deviceKeyPwdSlice,
    cloudKeyPwdSlice,
    authKeyPwdSlice,
    deviceKeyPack,
    authKeyPack,
    cloudKeyPack,
  };
}

/**
 * Restore from DeviceKeyPack + AuthKeyPack
 * - Use authKeyPwd from DeviceKeyPack to decrypt AuthKeyPack
 * - Get deviceKeyPwdSlice from AuthKeyPack to decrypt DeviceKeyPack
 * - Combine deviceKey + authKey via Shamir to get mnemonic
 * - Recover original cloudKey using GF(256) arithmetic
 * - Return recreated packs with original keys
 */
async function restoreFromDeviceAndAuth(params: {
  deviceKeyPack: IDeviceKeyPack;
  authKeyPack: IAuthKeyPack;
}): Promise<IKeylessWalletRestoredData> {
  const { deviceKeyPack, authKeyPack } = params;
  const { authKeyPwdSlice } = deviceKeyPack;
  // Step 1: Use authKeyPwd from DeviceKeyPack to decrypt AuthKeyPack
  const authKeyPwd = deviceKeyPack.authKeyPwd;
  if (!authKeyPwd) {
    throw new OneKeyLocalError(
      'DeviceKeyPack does not contain authKeyPwd for decryption',
    );
  }

  const authKeyPackData = await decryptPackData<IAuthKeyPackEncryptedData>({
    encrypted: authKeyPack.encrypted,
    password: authKeyPwd,
  });
  const authKey = authKeyPackData.authKey;
  const userInfo = authKeyPackData.userInfo;
  const authKeyX = authKeyPackData.xCoordination.authKeyX;
  const cloudKeyX = authKeyPackData.xCoordination.cloudKeyX;
  const deviceKeyX = authKeyPackData.xCoordination.deviceKeyX;

  // Step 2: Use deviceKeyPwdSlice from AuthKeyPack to derive deviceKeyPwd
  const deviceKeyPwd = await deriveDeviceKeyPwd(
    authKeyPackData.deviceKeyPwdSlice,
  );

  // Step 3: Decrypt DeviceKeyPack to get deviceKey
  const deviceKeyPackData = await decryptPackData<IDeviceKeyPackEncryptedData>({
    encrypted: deviceKeyPack.encrypted,
    password: deviceKeyPwd,
  });
  const deviceKey = deviceKeyPackData.deviceKey;

  // Step 4: Combine deviceKey + authKey via Shamir to get mnemonic
  const { mnemonic } = await restoreMnemonicFromShareKey({
    deviceKey,
    authKey,
  });

  const cloudKey = shamirUtils.recoverMissingShare({
    entropyHex: mnemonicToEntropy(mnemonic),
    shareBase64: deviceKey,
    missingX: cloudKeyX,
  });

  // Step 6: Get password slices from AuthKeyPack
  const { cloudKeyPwdSlice, deviceKeyPwdSlice } = authKeyPackData;

  // Use the new shares for consistency
  const packs = await generateKeylessWalletPacks({
    userInfo,
    packSetId: deviceKeyPack.packSetId,
    mnemonicInfo: {
      mnemonic,
      deviceKey,
      cloudKey,
      authKey,
      deviceKeyX,
      cloudKeyX,
      authKeyX,
      deviceKeyPwdSlice,
      cloudKeyPwdSlice,
      authKeyPwdSlice,
    },
  });

  const cloudKeyPackData = await decryptPackData<ICloudKeyPackEncryptedData>({
    encrypted: packs.cloudKeyPack.encrypted,
    password: packs.deviceKeyPack.cloudKeyPwd,
  });

  return {
    authKeyPackData,
    deviceKeyPackData,
    cloudKeyPackData,
    packs,
  };
}

/**
 * Restore from DeviceKeyPack + CloudKeyPack
 */
async function restoreFromDeviceAndCloud(params: {
  deviceKeyPack: IDeviceKeyPack;
  cloudKeyPack: ICloudKeyPack;
}): Promise<IKeylessWalletRestoredData> {
  const { deviceKeyPack, cloudKeyPack } = params;
  // Step 1: Use cloudKeyPwd from DeviceKeyPack to decrypt CloudKeyPack
  const cloudKeyPwd = deviceKeyPack.cloudKeyPwd;
  if (!cloudKeyPwd) {
    throw new OneKeyLocalError(
      'DeviceKeyPack does not contain cloudKeyPwd for decryption',
    );
  }

  const cloudKeyPackData = await decryptPackData<ICloudKeyPackEncryptedData>({
    encrypted: cloudKeyPack.encrypted,
    password: cloudKeyPwd,
  });
  const cloudKey = cloudKeyPackData.cloudKey;
  const userInfo = cloudKeyPackData.userInfo;

  // Step 2: Use deviceKeyPwdSlice from CloudKeyPack to derive deviceKeyPwd
  const deviceKeyPwd = await deriveDeviceKeyPwd(
    cloudKeyPackData.deviceKeyPwdSlice,
  );

  // Step 3: Decrypt DeviceKeyPack to get deviceKey
  const deviceKeyPackData = await decryptPackData<IDeviceKeyPackEncryptedData>({
    encrypted: deviceKeyPack.encrypted,
    password: deviceKeyPwd,
  });
  const deviceKey = deviceKeyPackData.deviceKey;

  // Step 4: Combine deviceKey + cloudKey via Shamir to get mnemonic
  const { mnemonic } = await restoreMnemonicFromShareKey({
    deviceKey,
    cloudKey,
  });

  // Step 5: Recover authKey using recoverMissingShare
  const { deviceKeyX, cloudKeyX, authKeyX } = cloudKeyPackData.xCoordination;
  const authKey = shamirUtils.recoverMissingShare({
    entropyHex: mnemonicToEntropy(mnemonic),
    shareBase64: deviceKey,
    missingX: authKeyX,
  });

  // Step 6: Extract password slices
  const { deviceKeyPwdSlice } = cloudKeyPackData;
  const { cloudKeyPwdSlice, authKeyPwdSlice } = deviceKeyPack;

  const packs = await generateKeylessWalletPacks({
    userInfo,
    packSetId: deviceKeyPack.packSetId,
    mnemonicInfo: {
      mnemonic,
      deviceKey,
      cloudKey,
      authKey,
      deviceKeyX,
      cloudKeyX,
      authKeyX,
      deviceKeyPwdSlice,
      cloudKeyPwdSlice,
      authKeyPwdSlice,
    },
  });

  const authKeyPackData = await decryptPackData<IAuthKeyPackEncryptedData>({
    encrypted: packs.authKeyPack.encrypted,
    password: packs.deviceKeyPack.authKeyPwd,
  });

  return {
    cloudKeyPackData,
    deviceKeyPackData,
    authKeyPackData,
    packs,
  };
}

/**
 * Restore from AuthKeyPack + CloudKeyPack
 */
async function restoreFromAuthAndCloud(params: {
  authKeyPack: IAuthKeyPack;
  cloudKeyPack: ICloudKeyPack;
}): Promise<IKeylessWalletRestoredData> {
  // Step 1: Get cloudKeyUserId to derive authKeyPwd
  const { authKeyPack, cloudKeyPack } = params;

  // Step 2: Use authKeyPwdSlice from CloudKeyPack to derive authKeyPwd
  const authKeyPwdSlice = cloudKeyPack.authKeyPwdSlice;
  if (!authKeyPwdSlice) {
    throw new OneKeyLocalError('CloudKeyPack does not contain authKeyPwdSlice');
  }
  const authKeyPwd = await deriveAuthKeyPwd(authKeyPwdSlice);

  // Step 3: Decrypt AuthKeyPack to get authKey
  const authKeyPackData = await decryptPackData<IAuthKeyPackEncryptedData>({
    encrypted: authKeyPack.encrypted,
    password: authKeyPwd,
  });
  const authKey = authKeyPackData.authKey;
  const userInfo = authKeyPackData.userInfo;
  const onekeyIdUserId = userInfo.onekeyIdUserId;

  // Step 4: Use cloudKeyPwdSlice from AuthKeyPack to derive cloudKeyPwd
  const cloudKeyPwd = await deriveCloudKeyPwd(
    authKeyPackData.cloudKeyPwdSlice,
    onekeyIdUserId,
  );

  // Step 5: Decrypt CloudKeyPack to get cloudKey
  const cloudKeyPackData = await decryptPackData<ICloudKeyPackEncryptedData>({
    encrypted: cloudKeyPack.encrypted,
    password: cloudKeyPwd,
  });
  const cloudKey = cloudKeyPackData.cloudKey;

  // Step 6: Combine authKey + cloudKey via Shamir to get mnemonic
  const { mnemonic } = await restoreMnemonicFromShareKey({
    authKey,
    cloudKey,
  });

  // Step 7: Recover deviceKey using recoverMissingShare
  const { deviceKeyX, cloudKeyX, authKeyX } = authKeyPackData.xCoordination;
  const deviceKey = shamirUtils.recoverMissingShare({
    entropyHex: mnemonicToEntropy(mnemonic),
    shareBase64: authKey,
    missingX: deviceKeyX,
  });

  // Step 8: Extract password slices from AuthKeyPack
  const { deviceKeyPwdSlice, cloudKeyPwdSlice } = authKeyPackData;

  const packs = await generateKeylessWalletPacks({
    userInfo,
    packSetId: authKeyPack.packSetId,
    mnemonicInfo: {
      mnemonic,
      deviceKey,
      cloudKey,
      authKey,
      deviceKeyX,
      cloudKeyX,
      authKeyX,
      deviceKeyPwdSlice,
      cloudKeyPwdSlice,
      authKeyPwdSlice,
    },
  });

  const deviceKeyPwd = await deriveDeviceKeyPwd(
    cloudKeyPackData.deviceKeyPwdSlice,
  );
  const deviceKeyPackData = await decryptPackData<IDeviceKeyPackEncryptedData>({
    encrypted: packs.deviceKeyPack.encrypted,
    password: deviceKeyPwd,
  });

  return {
    authKeyPackData,
    cloudKeyPackData,
    deviceKeyPackData,
    packs,
  };
}

export default {
  getShareXCoordinate,
  generateKeylessWalletPackSetId,
  generateKeylessWalletPacks,
  restoreFromDeviceAndAuth,
  restoreFromDeviceAndCloud,
  restoreFromAuthAndCloud,
  generateKeylessMnemonic,
  restoreMnemonicFromShareKey,
};
