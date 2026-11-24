import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import {
  hasPublicAccountSnapshotWriteGuard,
  isRejectedPublicAccountSnapshotWrite,
  matchesPublicAccountSnapshotWrite,
  rejectPublicAccountSnapshotWrite,
  rememberPublicAccountSnapshotWrite,
} from './publicAccountSnapshotWriteGuard';

import type { IDBCloudSyncItem } from '../../dbs/local/types';

function item(): IDBCloudSyncItem {
  return {
    id: 'synthetic-public-account-hash',
    dataType: EPrimeCloudSyncDataType.Account,
    rawKey: 'account >> cloud-public-account:v1:synthetic',
    rawData: undefined,
    data: 'test-ciphertext-v1',
    dataTime: 1,
    pwdHash: 'test-pwd-hash',
    isDeleted: false,
    localSceneUpdated: false,
    serverUploaded: false,
  };
}

describe('public account snapshot local write guard', () => {
  it('captures immutable previous fields, including a missing previous record', () => {
    const previous = item();
    const update = { ...item(), data: 'new-test-ciphertext', dataTime: 3 };
    expect(rememberPublicAccountSnapshotWrite(update, previous)).toBe(update);
    expect(hasPublicAccountSnapshotWriteGuard(update)).toBe(true);
    previous.data = 'test-ciphertext-future';
    expect(matchesPublicAccountSnapshotWrite(update, previous)).toBe(false);
    expect(matchesPublicAccountSnapshotWrite(update, item())).toBe(true);
    const create = rememberPublicAccountSnapshotWrite(item());
    expect(matchesPublicAccountSnapshotWrite(create)).toBe(true);
    expect(matchesPublicAccountSnapshotWrite(create, item())).toBe(false);
  });

  it.each([
    { data: 'test-ciphertext-future' },
    { dataTime: 2 },
    { pwdHash: 'different-test-source' },
    { isDeleted: true },
    { dataType: EPrimeCloudSyncDataType.Wallet },
  ])('rejects a different previous version: %j', (change) => {
    const update = rememberPublicAccountSnapshotWrite(item(), item());
    expect(
      matchesPublicAccountSnapshotWrite(update, { ...item(), ...change }),
    ).toBe(false);
  });

  it('ignores decryption cache and delivery state changes when ciphertext is unchanged', () => {
    const update = rememberPublicAccountSnapshotWrite(item(), item());
    expect(
      matchesPublicAccountSnapshotWrite(update, {
        ...item(),
        rawKey: 'cached-key',
        rawData: 'cached-public-payload',
        localSceneUpdated: true,
        serverUploaded: true,
      }),
    ).toBe(true);
  });

  it('checks the actual payload for offline items without ciphertext', () => {
    const previous = { ...item(), data: undefined, rawData: 'offline-v1' };
    const update = rememberPublicAccountSnapshotWrite(item(), previous);
    expect(
      matchesPublicAccountSnapshotWrite(update, {
        ...previous,
        rawData: 'offline-future',
      }),
    ).toBe(false);
  });

  it('does not add persistent or wire fields and rejection cannot be rearmed on the same object', () => {
    const update = item();
    const encoded = stringUtils.stableStringify(update);
    const keys = Reflect.ownKeys(update);
    rememberPublicAccountSnapshotWrite(update, item());
    rejectPublicAccountSnapshotWrite(update);
    rememberPublicAccountSnapshotWrite(update, item());
    expect(isRejectedPublicAccountSnapshotWrite(update)).toBe(true);
    expect(matchesPublicAccountSnapshotWrite(update, item())).toBe(false);
    expect(stringUtils.stableStringify(update)).toBe(encoded);
    expect(Reflect.ownKeys(update)).toEqual(keys);
    expect(hasPublicAccountSnapshotWriteGuard({ ...update })).toBe(false);
  });
});
