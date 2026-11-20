import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';

import { LocalDbBase } from './LocalDbBase';

import type { IDBCloudSyncItem } from './types';

function record(overrides: Partial<IDBCloudSyncItem>): IDBCloudSyncItem {
  return {
    id: 'public-test-wallet',
    rawKey: 'public-test-raw-key',
    dataType: EPrimeCloudSyncDataType.Wallet,
    rawData: 'public-test-local-name',
    data: 'public-test-old-ciphertext',
    dataTime: 200,
    pwdHash: 'hw-dek-old',
    isDeleted: false,
    localSceneUpdated: true,
    serverUploaded: false,
    ...overrides,
  };
}

describe('Cloud sync business versions across encryption key changes', () => {
  test.each([
    {
      scenario: 'A edits before B',
      serverTime: 100,
      localTime: 200,
      winner: 'B',
    },
    { scenario: 'A only rotates', serverTime: 50, localTime: 200, winner: 'B' },
    {
      scenario: 'B edits before A',
      serverTime: 200,
      localTime: 100,
      winner: 'A',
    },
  ])(
    '$scenario keeps $winner after B reconnects',
    ({ serverTime, localTime, winner }) => {
      const local = record({ dataTime: localTime });
      const server = record({
        rawData: 'public-test-server-name',
        data: 'public-test-new-ciphertext',
        pwdHash: 'hw-dek-current',
        dataTime: serverTime,
        serverUploaded: true,
        localSceneUpdated: false,
      });

      LocalDbBase.prototype._updateCloudSyncPoolItemFn({
        item: local,
        updateItem: server,
      });

      expect(local.rawData).toBe(
        winner === 'B' ? 'public-test-local-name' : 'public-test-server-name',
      );
      expect(local.dataTime).toBe(Math.max(localTime, serverTime));
      expect(local.serverUploaded).toBe(winner === 'A');
    },
  );

  test('an older server deletion cannot erase a newer local edit after rotation', () => {
    const local = record({});
    LocalDbBase.prototype._updateCloudSyncPoolItemFn({
      item: local,
      updateItem: record({
        pwdHash: 'hw-dek-current',
        dataTime: 100,
        isDeleted: true,
        serverUploaded: true,
      }),
    });
    expect(local.isDeleted).toBe(false);
    expect(local.dataTime).toBe(200);
  });

  test('explicit local initialization can change encryption without inventing a modification time', () => {
    const local = record({});
    LocalDbBase.prototype._updateCloudSyncPoolItemFn({
      item: local,
      updateItem: record({ pwdHash: 'hw-dek-current', dataTime: undefined }),
    });
    expect(local.pwdHash).toBe('hw-dek-current');
    expect(local.dataTime).toBe(200);
  });
});
