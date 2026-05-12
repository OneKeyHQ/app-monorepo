import nodeCrypto from 'node:crypto';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { stableStringify } from '@onekeyhq/shared/src/utils/stringUtils';

import * as cryptoUtils from '../../core/crypto-utils';
import { KeychainStorage } from '../keychain-storage';

import { deriveVaultKey } from './crypto';
import { MASTER_KEY_ACCOUNT } from './paths';

type IKeychainStorageLike = Pick<KeychainStorage, 'delete' | 'get' | 'set'>;

type IMasterKeyOptions = {
  keychainStorage?: IKeychainStorageLike;
  account?: string;
};

type ICreateMasterKeyOptions = IMasterKeyOptions & {
  now?: () => number;
  randomBytes?: (size: number) => Buffer;
};

type IMasterKeyPayload = {
  masterKeyBase64: string;
  schemaVersion: 1;
  createdAt: number;
};

function getKeychainStorage(
  keychainStorage?: IKeychainStorageLike,
): IKeychainStorageLike {
  return keychainStorage ?? new KeychainStorage();
}

function parseMasterKeyPayload(value: Buffer): IMasterKeyPayload {
  const decoded: unknown = JSON.parse(value.toString('utf8'));
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('masterKeyBase64' in decoded) ||
    !('schemaVersion' in decoded) ||
    !('createdAt' in decoded)
  ) {
    throw new OneKeyLocalError('MASTER_KEY_CORRUPT');
  }

  const payload = decoded as Partial<IMasterKeyPayload>;
  if (
    typeof payload.masterKeyBase64 !== 'string' ||
    payload.schemaVersion !== 1 ||
    typeof payload.createdAt !== 'number'
  ) {
    throw new OneKeyLocalError('MASTER_KEY_CORRUPT');
  }

  return {
    masterKeyBase64: payload.masterKeyBase64,
    schemaVersion: 1,
    createdAt: payload.createdAt,
  };
}

export async function createMasterKey(
  options: ICreateMasterKeyOptions = {},
): Promise<Buffer> {
  const keychainStorage = getKeychainStorage(options.keychainStorage);
  const account = options.account ?? MASTER_KEY_ACCOUNT;
  const randomBytes = options.randomBytes ?? nodeCrypto.randomBytes;
  const now = options.now ?? Date.now;
  const masterKey = randomBytes(32);
  const payload: IMasterKeyPayload = {
    masterKeyBase64: masterKey.toString('base64'),
    schemaVersion: 1,
    createdAt: now(),
  };

  await keychainStorage.set(
    account,
    Buffer.from(stableStringify(payload), 'utf8'),
  );

  return masterKey;
}

export async function readMasterKey(
  options: IMasterKeyOptions = {},
): Promise<Buffer | null> {
  const keychainStorage = getKeychainStorage(options.keychainStorage);
  const account = options.account ?? MASTER_KEY_ACCOUNT;
  const value = await keychainStorage.get(account);
  if (!value) {
    return null;
  }

  const payload = parseMasterKeyPayload(value);
  return Buffer.from(payload.masterKeyBase64, 'base64');
}

export async function deleteMasterKey(
  options: IMasterKeyOptions = {},
): Promise<void> {
  const keychainStorage = getKeychainStorage(options.keychainStorage);
  const account = options.account ?? MASTER_KEY_ACCOUNT;
  await keychainStorage.delete(account);
}

export function deriveVaultKeyFromMasterKey(
  masterKey: Buffer,
  secureWipe: (buffer: Buffer) => void = cryptoUtils.secureWipe,
): Buffer {
  try {
    return deriveVaultKey(masterKey);
  } finally {
    secureWipe(masterKey);
  }
}
