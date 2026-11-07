import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityPrivacyChainZcashSent } from './SimpleDbEntityPrivacyChainZcashSent';

import type {
  IPrivacyChainZcashSentDB,
  IZcashSentRecord,
} from './SimpleDbEntityPrivacyChainZcashSent';

function createEntity(initial?: IPrivacyChainZcashSentDB) {
  const storage = createMemoryStorage(
    initial ? { data: initial, updatedAt: 1 } : null,
  );
  const entity = new SimpleDbEntityPrivacyChainZcashSent();
  Reflect.set(entity, 'appStorage', storage);
  const readSaved = (): unknown =>
    typeof storage.value === 'string'
      ? JSON.parse(storage.value)
      : storage.value;
  return { entity, storage, readSaved };
}

const memoHex = `68656c6c6f${'00'.repeat(507)}`;
const record: IZcashSentRecord = {
  recipient: 'u1recipient',
  amountZat: '80000',
  feeZat: '20000',
  memoHex,
  createdAt: 1,
};

describe('privacy chain zcash sent records', () => {
  it('keeps one record per account and lowercase txid', async () => {
    const { entity } = createEntity();
    await entity.recordZcashSent({
      accountId: 'account',
      txid: 'AB'.repeat(32),
      record,
    });
    await entity.recordZcashSent({
      accountId: 'account',
      txid: 'cd'.repeat(32),
      record: { ...record, memoHex: undefined },
    });
    await entity.recordZcashSent({
      accountId: 'other',
      txid: 'ab'.repeat(32),
      record: { ...record, recipient: 'u1other' },
    });

    await expect(
      entity.listZcashSent({ accountId: 'account' }),
    ).resolves.toEqual({
      ['ab'.repeat(32)]: record,
      ['cd'.repeat(32)]: { ...record, memoHex: undefined },
    });
    await expect(entity.listZcashSent({ accountId: 'other' })).resolves.toEqual(
      { ['ab'.repeat(32)]: { ...record, recipient: 'u1other' } },
    );
  });

  it.each([
    ['an empty recipient', { recipient: '' }],
    ['a fractional amount', { amountZat: '0.1' }],
    ['a negative fee', { feeZat: '-1' }],
    ['a short memo', { memoHex: 'ff' }],
    ['an uppercase memo', { memoHex: memoHex.toUpperCase() }],
  ])('refuses %s', async (_label, change) => {
    const { entity, storage } = createEntity();
    await expect(
      entity.recordZcashSent({
        accountId: 'account',
        txid: 'tx',
        record: { ...record, ...change },
      }),
    ).rejects.toThrow('zcash: invalid sent record');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('quarantines a malformed record and keeps it through writes', async () => {
    const { entity, readSaved } = createEntity({
      accounts: {
        account: {
          good: record,
          bad: { ...record, amountZat: 'not-a-number' },
        },
      },
    });

    await expect(
      entity.listZcashSent({ accountId: 'account' }),
    ).resolves.toEqual({ good: record });
    await entity.recordZcashSent({ accountId: 'account', txid: 'new', record });

    expect(readSaved()).toMatchObject({
      data: {
        accounts: {
          account: {
            good: record,
            bad: { ...record, amountZat: 'not-a-number' },
            new: record,
          },
        },
      },
    });
  });

  it('refuses writes to an unreadable account record without deleting it', async () => {
    const { entity, storage } = createEntity({
      accounts: { account: 'secret-blob' },
    });

    await expect(
      entity.listZcashSent({ accountId: 'account' }),
    ).resolves.toEqual({});
    await expect(
      entity.recordZcashSent({ accountId: 'account', txid: 'tx', record }),
    ).rejects.toThrow('sent record list is unreadable');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('fails a malformed container without echoing its content', async () => {
    const { entity, storage } = createEntity({
      accounts: 'secret-blob',
    } as unknown as IPrivacyChainZcashSentDB);

    const error = await entity.getRawData().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      'simpledb: invalid persisted data (privacyChainZcashSent)',
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('removes the given accounts only, quarantined records included', async () => {
    const { entity } = createEntity({
      accounts: { gone: { bad: { amountZat: 'x' } } },
    });
    await entity.recordZcashSent({ accountId: 'kept', txid: 'x2', record });
    await expect(entity.listAccountIds()).resolves.toEqual(['gone', 'kept']);

    await entity.removeAccounts({ accountIds: ['gone'] });

    await expect(entity.listAccountIds()).resolves.toEqual(['kept']);
    await expect(entity.listZcashSent({ accountId: 'kept' })).resolves.toEqual({
      x2: record,
    });
  });
});
