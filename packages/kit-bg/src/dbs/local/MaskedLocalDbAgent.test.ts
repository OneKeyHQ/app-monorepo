import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { ELocalDBStoreNames } from './localDBStoreNames';
import { maskedLocalDbAgent } from './MaskedLocalDbAgent';
import { EIndexedDBBucketNames } from './types';

describe('MaskedLocalDbAgent', () => {
  it('returns operation-shaped empty read results', async () => {
    await expect(
      maskedLocalDbAgent.getRecordById({
        id: 'wallet-1',
        name: ELocalDBStoreNames.Wallet,
      }),
    ).resolves.toBeUndefined();
    await expect(
      maskedLocalDbAgent.getAllRecords({
        name: ELocalDBStoreNames.Wallet,
      }),
    ).resolves.toEqual({ records: [] });
    await expect(
      maskedLocalDbAgent.getRecordsCount({
        name: ELocalDBStoreNames.Wallet,
      }),
    ).resolves.toEqual({ count: 0 });
  });

  it('runs transaction callbacks without a physical transaction', async () => {
    const task = jest.fn(async (tx) => {
      expect(tx).toEqual({ bucketName: EIndexedDBBucketNames.account });
      return 'computed';
    });

    await expect(
      maskedLocalDbAgent.withTransaction(EIndexedDBBucketNames.account, task),
    ).resolves.toBe('computed');
    expect(task).toHaveBeenCalledTimes(1);
  });

  it('does not invoke write updaters', async () => {
    const updater = jest.fn(() => {
      throw new OneKeyLocalError('Updater must not run');
    });

    await expect(
      maskedLocalDbAgent.txUpdateRecords({
        ids: ['wallet-1'],
        name: ELocalDBStoreNames.Wallet,
        tx: { bucketName: EIndexedDBBucketNames.account },
        updater,
      }),
    ).resolves.toBeUndefined();
    expect(updater).not.toHaveBeenCalled();
  });
});
