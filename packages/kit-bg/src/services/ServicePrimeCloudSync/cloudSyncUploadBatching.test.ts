import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import type {
  ICloudSyncServerItem,
  ICloudSyncUploadPostData,
} from '@onekeyhq/shared/types/prime/primeCloudSyncTypes';

import {
  CLOUD_SYNC_UPLOAD_MAX_BYTES,
  CLOUD_SYNC_UPLOAD_MAX_ITEMS,
  splitCloudSyncUploadPostData,
} from './cloudSyncUploadBatching';

function item(
  key: string,
  data = 'encrypted-public-snapshot',
): ICloudSyncServerItem {
  return {
    key,
    data,
    dataType: EPrimeCloudSyncDataType.Account,
    dataTimestamp: 1,
    pwdHash: 'keyless-pwd-hash',
    isDeleted: false,
  };
}

function postData(localData: ICloudSyncServerItem[]): ICloudSyncUploadPostData {
  return { localData, nonce: 0, pwdHash: 'keyless-pwd-hash' };
}

function bytes(value: ICloudSyncUploadPostData): number {
  return Buffer.byteLength(stringUtils.stableStringify(value), 'utf8');
}

describe('Cloud upload client batching budgets', () => {
  test('splits at the record budget and preserves every record and envelope', () => {
    const request = postData(
      Array.from({ length: CLOUD_SYNC_UPLOAD_MAX_ITEMS * 2 + 1 }, (_, index) =>
        item(String(index)),
      ),
    );
    const batches = splitCloudSyncUploadPostData({ postData: request });
    expect(batches.map((batch) => batch.localData.length)).toEqual([50, 50, 1]);
    expect(batches.flatMap((batch) => batch.localData)).toEqual(
      request.localData,
    );
    for (const batch of batches) {
      expect(batch.pwdHash).toBe(request.pwdHash);
      expect(batch.nonce).toBe(request.nonce);
      expect(bytes(batch)).toBeLessThanOrEqual(CLOUD_SYNC_UPLOAD_MAX_BYTES);
    }
    expect(request.localData).toHaveLength(101);
  });

  test('counts actual UTF8, JSON escapes, separators, and envelope bytes', () => {
    const first = item('first', '中文🙂"\\\n'.repeat(12));
    const second = item('second', 'second');
    const request = { ...postData([first, second]), lock: null };
    const maxBytes = bytes({ ...request, localData: [first] });
    const batches = splitCloudSyncUploadPostData({
      postData: request,
      maxBytes,
    });
    expect(batches).toHaveLength(2);
    expect(bytes(batches[0])).toBe(maxBytes);
    expect(batches.every((batch) => bytes(batch) <= maxBytes)).toBe(true);
  });

  test('accepts an exact body boundary and splits one byte below it', () => {
    const request = postData([item('a'), item('b')]);
    expect(
      splitCloudSyncUploadPostData({
        postData: request,
        maxBytes: bytes(request),
      }),
    ).toHaveLength(1);
    expect(
      splitCloudSyncUploadPostData({
        postData: request,
        maxBytes: bytes(request) - 1,
      }),
    ).toHaveLength(2);
  });

  test('rejects any oversized record before returning earlier valid batches', () => {
    const request = postData([
      item('small'),
      item('large', 'x'.repeat(CLOUD_SYNC_UPLOAD_MAX_BYTES)),
    ]);
    expect(() => splitCloudSyncUploadPostData({ postData: request })).toThrow(
      'Cloud upload item exceeds client budget',
    );
  });

  test('rejects an oversized envelope even without records', () => {
    expect(() =>
      splitCloudSyncUploadPostData({ postData: postData([]), maxBytes: 1 }),
    ).toThrow('Cloud upload envelope exceeds client budget');
  });

  test('returns no batches for an empty request', () => {
    expect(splitCloudSyncUploadPostData({ postData: postData([]) })).toEqual(
      [],
    );
  });

  test.each([
    { maxItems: 0 },
    { maxItems: 1.5 },
    { maxBytes: 0 },
    { maxBytes: Number.POSITIVE_INFINITY },
  ])('rejects invalid budgets %j', (budget) => {
    expect(() =>
      splitCloudSyncUploadPostData({
        postData: postData([item('a')]),
        ...budget,
      }),
    ).toThrow('Invalid Cloud upload batch budget');
  });
});
