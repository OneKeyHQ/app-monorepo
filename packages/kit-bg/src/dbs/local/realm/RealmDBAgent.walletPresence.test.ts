import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { writeWalletPresenceHint } from '@onekeyhq/shared/src/utils/walletPresenceHintUtils';

import { ELocalDBStoreNames } from '../localDBStoreNames';
import { EIndexedDBBucketNames } from '../types';

import { RealmDBAgent } from './RealmDBAgent';

import type { ILocalDBRecord } from '../types';
import type Realm from 'realm';

jest.mock('realm', () => ({ __esModule: true, default: { Object: class {} } }));
jest.mock('@onekeyhq/shared/src/utils/walletPresenceHintUtils', () => ({
  writeWalletPresenceHint: jest.fn(),
}));

it.each([
  ELocalDBStoreNames.Wallet,
  ELocalDBStoreNames.Account,
  ELocalDBStoreNames.IndexedAccount,
])(
  'publishes the first committed %s before the transaction returns and ignores a failed commit',
  async (name) => {
    const count = new Map<ELocalDBStoreNames, number>([
      [ELocalDBStoreNames.Wallet, 3],
    ]);
    let pendingStore: ELocalDBStoreNames | undefined;
    const commitTransaction = jest.fn(() => {
      if (pendingStore)
        count.set(pendingStore, (count.get(pendingStore) ?? 0) + 1);
    });
    const realm = {
      objects: (store: ELocalDBStoreNames) => ({
        length: count.get(store) ?? 0,
      }),
      beginTransaction: jest.fn(),
      commitTransaction,
      cancelTransaction: jest.fn(),
      create: (store: ELocalDBStoreNames) => {
        pendingStore = store;
      },
    };
    const db = new RealmDBAgent(realm as unknown as Realm);
    expect(writeWalletPresenceHint).toHaveBeenLastCalledWith({
      hasWallet: false,
    });
    jest.mocked(writeWalletPresenceHint).mockClear();
    const save = () =>
      db.withTransaction(EIndexedDBBucketNames.account, (tx) =>
        db.txAddRecords({
          name,
          tx,
          records: [{ id: 'first' } as ILocalDBRecord<typeof name>],
        }),
      );
    commitTransaction.mockImplementationOnce(() => {
      throw new OneKeyLocalError('failed commit');
    });
    await expect(save()).rejects.toThrow('failed commit');
    expect(writeWalletPresenceHint).not.toHaveBeenCalled();
    await save();
    expect(writeWalletPresenceHint).toHaveBeenCalledWith({ hasWallet: true });
    expect(commitTransaction.mock.invocationCallOrder[1]).toBeLessThan(
      jest.mocked(writeWalletPresenceHint).mock.invocationCallOrder[0],
    );
  },
);
