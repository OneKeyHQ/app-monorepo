import { ETransactionType } from '@onekeyhq/shared/types/signatureRecord';

import { LocalDbBase } from './LocalDbBase';
import { ELocalDBStoreNames } from './localDBStoreNames';
import { EIndexedDBBucketNames } from './types';

import type { IDBSignedTransaction } from './types';

function record(
  id: string,
  owner?: string,
  overrides: Partial<IDBSignedTransaction> = {},
): IDBSignedTransaction {
  return {
    id,
    networkId: 'zec--0',
    address: 'synthetic-address',
    title: 'OneKey Wallet',
    hash: 'synthetic-hash',
    createdAt: 1,
    dataStringify: JSON.stringify({
      type: ETransactionType.CONTRACT_INTERACTION,
      privacyChainAccountId: owner,
    }),
    ...overrides,
  };
}

function harness(records: IDBSignedTransaction[]) {
  const txRemoveRecords = jest.fn(async () => undefined);
  const withSpaceFreeingTransaction = jest.fn(
    async (
      _bucket: EIndexedDBBucketNames,
      task: Parameters<LocalDbBase['withSpaceFreeingTransaction']>[1],
    ) =>
      task(
        {} as Parameters<
          Parameters<LocalDbBase['withSpaceFreeingTransaction']>[1]
        >[0],
      ),
  );
  const db = Object.assign(
    Object.create(LocalDbBase.prototype) as LocalDbBase,
    {
      getAllRecords: jest.fn(async () => ({ records })),
      withSpaceFreeingTransaction,
      txRemoveRecords,
    },
  );
  return { db, txRemoveRecords, withSpaceFreeingTransaction };
}

it.each(['synthetic-address', ''])(
  'keeps address-only deletion independent of ownership metadata: %p',
  async (address) => {
    const matching = { networkId: 'evm--1', address };
    const { db, txRemoveRecords } = harness([
      record('legacy', undefined, matching),
      record('owned', 'account-b', matching),
      record('malformed', undefined, {
        ...matching,
        dataStringify: '{invalid',
      }),
      record('other-network'),
      record('other-address', undefined, {
        networkId: 'evm--1',
        address: 'synthetic-other',
      }),
    ]);
    await db.removeSignedTransactions({
      networkId: 'evm--1',
      address,
    });
    expect(txRemoveRecords).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ['legacy', 'owned', 'malformed'] }),
    );
  },
);

it('deletes only the selected account and network, preserving same-address aliases', async () => {
  const { db, txRemoveRecords, withSpaceFreeingTransaction } = harness([
    record('owned', 'account-a'),
    record('alias', 'account-b'),
    record('other-network', 'account-a', { networkId: 'evm--1' }),
    record('legacy-same-address'),
    record('legacy-other-address', undefined, { address: 'synthetic-other' }),
  ]);
  await db.removeSignedTransactions({
    networkId: 'zec--0',
    accountId: 'account-a',
    address: 'synthetic-address',
  });
  expect(withSpaceFreeingTransaction).toHaveBeenCalledWith(
    EIndexedDBBucketNames.archive,
    expect.any(Function),
  );
  expect(txRemoveRecords).toHaveBeenCalledWith({
    name: ELocalDBStoreNames.SignedTransaction,
    tx: {},
    ids: ['owned', 'legacy-same-address'],
  });
});

it('still removes owned rows when the account address no longer exists', async () => {
  const { db, txRemoveRecords } = harness([
    record('owned', 'account-a'),
    record('alias', 'account-b'),
    record('legacy'),
  ]);
  await db.removeSignedTransactions({
    networkId: 'zec--0',
    accountId: 'account-a',
  });
  expect(txRemoveRecords).toHaveBeenCalledWith(
    expect.objectContaining({ ids: ['owned'] }),
  );
});

it('preserves only this deletion epoch so new authorized sends survive old cleanup', async () => {
  const withEpoch = (epoch: string) =>
    JSON.stringify({
      type: ETransactionType.CONTRACT_INTERACTION,
      privacyChainAccountId: 'account-a',
      privacyChainEpoch: epoch,
    });
  const { db, txRemoveRecords } = harness([
    record('old', 'account-a'),
    record('new', 'account-a', { dataStringify: withEpoch('new-epoch') }),
    record('previous', 'account-a', {
      dataStringify: withEpoch('previous-epoch'),
    }),
    record('peer', 'account-b'),
  ]);
  await db.removeSignedTransactions({
    networkId: 'zec--0',
    accountId: 'account-a',
    preservePrivacyChainEpoch: 'new-epoch',
  });
  expect(txRemoveRecords).toHaveBeenCalledWith(
    expect.objectContaining({ ids: ['old', 'previous'] }),
  );
});

it('isolates malformed legacy data and does not open an empty delete transaction', async () => {
  const { db, withSpaceFreeingTransaction } = harness([
    record('malformed', undefined, { dataStringify: '{invalid' }),
    record('null', undefined, { dataStringify: 'null' }),
  ]);
  await db.removeSignedTransactions({
    networkId: 'zec--0',
    accountId: 'account-a',
  });
  expect(withSpaceFreeingTransaction).not.toHaveBeenCalled();
});

it('enumerates archive-only owners on the selected network for removal retries', async () => {
  const { db } = harness([
    record('a', 'account-a'),
    record('a-again', 'account-a'),
    record('b', 'account-b'),
    record('other', 'account-c', { networkId: 'evm--1' }),
    record('malformed', undefined, { dataStringify: '{invalid' }),
    record('legacy'),
  ]);
  await expect(
    db.listSignedTransactionAccountIds({ networkId: 'zec--0' }),
  ).resolves.toEqual(['account-a', 'account-b']);
});
