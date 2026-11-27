import { EPrimeCloudSyncDataType } from '@onekeyhq/shared/src/consts/primeConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { RealmSchemaCloudSyncItem } from '../../dbs/local/realm/schemas/RealmSchemaCloudSyncItem';

import {
  forEachHardwareCloudSyncResetPage,
  preparePoolRekey,
} from './hardwareCloudSyncResetDownload';

import type { IServerSyncRecord } from './hardwareCloudSyncSession';

// Test the production schema getter and writable record shape without Realm's
// platform-specific driver.
jest.mock('../../dbs/local/realm/base/RealmObjectBase', () => ({
  RealmObjectBase: jest.fn(),
}));

test.each([
  'absent',
  'null data and rawData',
  'new timestamp',
  'new cipher',
  'new rawData',
] as const)(
  'rekey compares the live Realm row against its read projection (%s)',
  async (change) => {
    const live: unknown = Reflect.construct(RealmSchemaCloudSyncItem, []);
    if (!(live instanceof RealmSchemaCloudSyncItem))
      throw new OneKeyLocalError('Missing Realm fixture');
    const nullPayload =
      change === 'null data and rawData' || change === 'new rawData';
    Object.assign(live, {
      id: 'realm-item',
      rawKey: 'realm-source',
      rawData: nullPayload ? null : '',
      dataType: EPrimeCloudSyncDataType.Wallet,
      data: nullPayload ? null : 'old-box',
      dataTime: null,
      isDeleted: false,
      pwdHash: 'old-hash',
      localSceneUpdated: true,
      serverUploaded: false,
      pendingPublicAccountDeletionAt: null,
      pendingPublicAccountDeletionHash: null,
    });
    const original = live.record;
    expect(original.dataTime).toBeUndefined();
    if (nullPayload) {
      expect(original.data).toBeUndefined();
      expect(original.rawData).toBeUndefined();
    }
    const conflict = new OneKeyLocalError('Conflicting Realm version');
    const { updater } = preparePoolRekey(
      [original],
      [{ ...original, data: 'new-box', pwdHash: 'next-hash' }],
      original.pwdHash,
      () => true,
      () => conflict,
    );
    if (change === 'new timestamp') Object.assign(live, { dataTime: 1 });
    if (change === 'new cipher') Object.assign(live, { data: 'other-box' });
    if (change === 'new rawData') Object.assign(live, { rawData: 'later-raw' });
    if (change === 'absent' || change === 'null data and rawData') {
      expect(await updater(live)).toBe(live);
      expect(live).toMatchObject({
        data: 'new-box',
        dataTime: null,
        pwdHash: 'next-hash',
      });
      return;
    }
    const untouched = { ...live.record };
    expect(() => updater(live)).toThrow(conflict);
    expect(live.record).toEqual(untouched);
  },
);

function records(count: number): IServerSyncRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    key: `key-${i.toString().padStart(6, '0')}`,
    dataType: 'BrowserBookmark',
    data: '',
    isDeleted: true,
  }));
}

function run(
  download: (page?: { skip: number; limit: number }) => Promise<unknown>,
) {
  const output: IServerSyncRecord[] = [];
  const onPage = jest.fn(async (page: IServerSyncRecord[]) => {
    output.push(...page);
  });
  const assertCurrent = jest.fn();
  return { output, onPage, assertCurrent, download };
}

describe('hardware reset complete download', () => {
  test.each([0, 1, 499, 500, 501, 1000, 1001, 2500])(
    'reads all %s records in one no-limit request and processes bounded batches',
    async (count) => {
      const source = records(count);
      const download = jest.fn(async () => source);
      const params = run(download);
      await expect(forEachHardwareCloudSyncResetPage(params)).resolves.toEqual({
        recordCount: count,
        pageCount: 1,
        paginated: false,
      });
      expect(params.output).toEqual(source);
      expect(download).toHaveBeenCalledTimes(1);
      expect(download).toHaveBeenCalledWith();
      expect(
        params.onPage.mock.calls.every(([page]) => page.length <= 500),
      ).toBe(true);
    },
  );

  test('never trusts ordered offset pages that silently omit a record', async () => {
    const source = records(1001);
    const download = jest.fn(async (page?: { skip: number; limit: number }) => {
      if (!page) return source;
      // Each page is ordered and unique, but a changing read order loses key 500.
      return source.slice(
        page.skip === 0 ? 0 : page.skip + 1,
        page.skip + page.limit,
      );
    });
    const params = run(download);
    await forEachHardwareCloudSyncResetPage(params);
    expect(params.output).toEqual(source);
    expect(download.mock.calls).toEqual([[]]);
  });

  test('accepts server collation without relying on cross-request ordering', async () => {
    const source = [
      { key: 'z', dataType: 'A' },
      { key: 'A', dataType: 'B' },
      { key: 'A', dataType: 'A' },
    ];
    const params = run(async () => source);
    await forEachHardwareCloudSyncResetPage(params);
    expect(params.output).toEqual(source);
  });

  test.each([
    undefined,
    null,
    {},
    [null],
    [{ key: 'key' }],
    [{ key: 3, dataType: 'A' }],
    [{ key: 'key', dataType: 'A', data: 7 }],
    [{ key: 'key', dataType: 'A', dataTimestamp: Number.NaN }],
    [{ key: 'key', dataType: 'A', isDeleted: 'true' }],
  ])('rejects malformed response %p before processing', async (value) => {
    const params = run(async () => value);
    await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toThrow();
    expect(params.onPage).not.toHaveBeenCalled();
  });

  test('validates duplicates beyond the first processing batch before emitting any data', async () => {
    const source = records(501);
    source.push(source[0]);
    const params = run(async () => source);
    await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toThrow(
      'Duplicate',
    );
    expect(params.onPage).not.toHaveBeenCalled();
  });

  test('preserves request errors without fallback', async () => {
    const error = Object.assign(new Error('Session changed'), { code: 90_704 });
    const download = jest.fn(async () => {
      throw error;
    });
    const params = run(download);
    await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toBe(error);
    expect(download).toHaveBeenCalledTimes(1);
    expect(params.onPage).not.toHaveBeenCalled();
  });
  test('stops before processing a page if selection changes during its request', async () => {
    let current = true;
    const params = run(async () => {
      current = false;
      return records(500);
    });
    params.assertCurrent.mockImplementation(() => {
      if (!current) throw new OneKeyLocalError('Cancelled');
    });
    await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toThrow(
      'Cancelled',
    );
    expect(params.onPage).not.toHaveBeenCalled();
  });

  test('stops before another request if selection changes during processing', async () => {
    const download = jest.fn(async () => records(500));
    const params = run(download);
    let current = true;
    params.assertCurrent.mockImplementation(() => {
      if (!current) throw new OneKeyLocalError('Cancelled');
    });
    params.onPage.mockImplementation(async () => {
      current = false;
    });
    await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toThrow(
      'Cancelled',
    );
    expect(download).toHaveBeenCalledTimes(1);
  });
});
