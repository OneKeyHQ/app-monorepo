import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { forEachHardwareCloudSyncResetPage } from './hardwareCloudSyncResetDownload';

import type { IServerSyncRecord } from './hardwareCloudSyncSession';

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
  const onRestart = jest.fn(() => {
    output.length = 0;
  });
  const assertCurrent = jest.fn();
  return { output, onPage, onRestart, assertCurrent, download };
}

describe('hardware reset download pages', () => {
  test.each([0, 1, 499, 500, 501, 1000, 1001, 2500])(
    'downloads all %s records including tombstones, through an empty terminal page',
    async (count) => {
      const source = records(count);
      const download = jest.fn(async (page?: { skip: number; limit: number }) =>
        source.slice(
          page?.skip ?? 0,
          page ? page.skip + page.limit : undefined,
        ),
      );
      const params = run(download);
      await expect(forEachHardwareCloudSyncResetPage(params)).resolves.toEqual({
        recordCount: count,
        pageCount: Math.ceil(count / 500) + 1,
        paginated: true,
      });
      expect(params.output).toEqual(source);
      expect(params.output.every((item) => item.isDeleted)).toBe(true);
      expect(download).toHaveBeenLastCalledWith({ skip: count, limit: 500 });
      expect(params.onRestart).not.toHaveBeenCalled();
    },
  );

  test('continues short pages using the actual received length', async () => {
    const source = records(11);
    const download = jest.fn(async (page?: { skip: number }) =>
      source.slice(page?.skip ?? 0, (page?.skip ?? 0) + 3),
    );
    const params = run(download);
    await forEachHardwareCloudSyncResetPage(params);
    expect(params.output).toEqual(source);
    expect(download.mock.calls.map(([page]) => page?.skip)).toEqual([
      0, 3, 6, 9, 11,
    ]);
  });

  test('allows a repeated key with distinct ordered data types', async () => {
    const source = ['A', 'B'].map((dataType) => ({ key: 'key', dataType }));
    const params = run(async (page) =>
      source.slice(page?.skip ?? 0, (page?.skip ?? 0) + 1),
    );
    await forEachHardwareCloudSyncResetPage(params);
    expect(params.output).toEqual(source);
  });

  test.each(['duplicate in page', 'duplicate across pages', 'ignored skip'])(
    '%s aborts rather than returning a partial result',
    async (mode) => {
      const source = records(2);
      const download = jest.fn(async () =>
        mode === 'duplicate in page' ? [source[0], source[0]] : [source[0]],
      );
      const params = run(download);
      await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toThrow(
        'Duplicate Cloud sync download record',
      );
      expect(params.onRestart).not.toHaveBeenCalled();
      expect(download).toHaveBeenCalledTimes(
        mode === 'duplicate in page' ? 1 : 2,
      );
    },
  );

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
  ])('rejects malformed page %p before processing it', async (value) => {
    const params = run(async () => value);
    await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toThrow();
    expect(params.onPage).not.toHaveBeenCalled();
    expect(params.onRestart).not.toHaveBeenCalled();
  });

  test('preserves second-page failures without retry or fallback', async () => {
    const error = Object.assign(new Error('Session changed'), { code: 90_704 });
    const download = jest
      .fn()
      .mockResolvedValueOnce(records(500))
      .mockRejectedValueOnce(error);
    const params = run(download);
    await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toBe(error);
    expect(download).toHaveBeenCalledTimes(2);
    expect(params.onRestart).not.toHaveBeenCalled();
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

  test.each(['binary order', 'data type order', 'ignored limit'])(
    '%s restarts from a complete response without retaining partial output',
    async (mode) => {
      let source: IServerSyncRecord[];
      if (mode === 'ignored limit') {
        source = records(501);
      } else if (mode === 'data type order') {
        source = [
          { key: 'same', dataType: 'lowercase' },
          { key: 'same', dataType: 'Uppercase' },
        ];
      } else {
        source = [
          { key: 'lowercase', dataType: 'A' },
          { key: 'Uppercase', dataType: 'A' },
        ];
      }
      const download = jest.fn(
        async (page?: { skip: number; limit: number }) => {
          if (!page || mode === 'ignored limit') return source;
          return source.slice(page.skip, page.skip + 1);
        },
      );
      const params = run(download);
      const result = await forEachHardwareCloudSyncResetPage(params);
      expect(result.paginated).toBe(false);
      expect(params.output).toEqual(source);
      expect(params.onRestart).toHaveBeenCalledTimes(1);
      expect(download).toHaveBeenLastCalledWith();
    },
  );

  test('validates the entire compatibility response before using it', async () => {
    const item = records(1)[0];
    const download = jest
      .fn()
      .mockResolvedValueOnce(records(501))
      .mockResolvedValueOnce([item, item]);
    const params = run(download);
    await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toThrow(
      'Duplicate',
    );
    expect(params.output).toEqual([]);
    expect(params.onPage).not.toHaveBeenCalled();
  });

  test('bounds an endpoint that never returns an empty page', async () => {
    const download = jest.fn(async (page?: { skip: number }) => [
      {
        key: (page?.skip ?? 0).toString().padStart(6, '0'),
        dataType: 'A',
      },
    ]);
    const params = run(download);
    await expect(forEachHardwareCloudSyncResetPage(params)).rejects.toThrow(
      'page limit',
    );
    expect(download).toHaveBeenCalledTimes(10_000);
    expect(params.onRestart).not.toHaveBeenCalled();
  });
});
