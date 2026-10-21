import { SimpleDbEntityPrivacyChainXmrSent } from './SimpleDbEntityPrivacyChainXmrSent';

import type { IPrivacyChainXmrSentDB } from './SimpleDbEntityPrivacyChainXmrSent';

function createEntity(initial?: IPrivacyChainXmrSentDB) {
  let saved: unknown = initial ? { data: initial, updatedAt: 1 } : null;
  const entity = new SimpleDbEntityPrivacyChainXmrSent();
  const storage = {
    getItem: jest.fn(async () => saved),
    setItem: jest.fn(async (_key: string, value: unknown) => {
      saved = value;
    }),
    removeItem: jest.fn(async () => {
      saved = null;
    }),
  };
  Reflect.set(entity, 'appStorage', storage);
  const readSaved = (): unknown =>
    typeof saved === 'string' ? JSON.parse(saved) : saved;
  return { entity, storage, readSaved };
}

describe('privacy chain xmr sent records', () => {
  it('merges recipient and amounts into one record per tx', async () => {
    const { entity } = createEntity();
    await entity.recordXmrSent({
      accountId: 'account',
      txid: 'legacy',
      recipient: 'own-two',
    });
    await entity.recordXmrSent({
      accountId: 'account',
      txid: 'new',
      recipient: 'own-two',
      amountAtomic: '1000000000000',
      feeAtomic: '30000000',
      outcomeUnknown: true,
    });
    // Only a recorded pair counts; a lone amount is not kept.
    await entity.recordXmrSent({
      accountId: 'account',
      txid: 'half',
      recipient: 'own-three',
      amountAtomic: '5',
    });
    // A recipient-only write keeps the amounts already recorded.
    await entity.recordXmrSent({
      accountId: 'account',
      txid: 'new',
      recipient: 'own-two',
    });

    await expect(entity.listXmrSent({ accountId: 'account' })).resolves.toEqual(
      {
        legacy: { recipient: 'own-two' },
        new: {
          recipient: 'own-two',
          amountAtomic: '1000000000000',
          feeAtomic: '30000000',
          outcomeUnknown: true,
        },
        half: { recipient: 'own-three' },
      },
    );
  });

  it('quarantines a malformed record and keeps it through writes', async () => {
    const { entity, readSaved } = createEntity({
      accounts: {
        account: {
          good: { recipient: '4good', amountAtomic: '1', feeAtomic: '2' },
          bad: { recipient: '4bad', amountAtomic: 'not-a-number' },
        },
      },
    });

    await expect(entity.listXmrSent({ accountId: 'account' })).resolves.toEqual(
      { good: { recipient: '4good', amountAtomic: '1', feeAtomic: '2' } },
    );
    await entity.recordXmrSent({
      accountId: 'account',
      txid: 'new',
      recipient: '4new',
    });

    expect(readSaved()).toMatchObject({
      data: {
        accounts: {
          account: {
            good: { recipient: '4good', amountAtomic: '1', feeAtomic: '2' },
            bad: { recipient: '4bad', amountAtomic: 'not-a-number' },
            new: { recipient: '4new' },
          },
        },
      },
    });
  });

  it('refuses writes to an unreadable account record without deleting it', async () => {
    const { entity, storage } = createEntity({
      accounts: { account: 'secret-blob' },
    });

    await expect(entity.listXmrSent({ accountId: 'account' })).resolves.toEqual(
      {},
    );
    await expect(
      entity.recordXmrSent({
        accountId: 'account',
        txid: 'tx',
        recipient: '4x',
      }),
    ).rejects.toThrow('sent record list is unreadable');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('fails a malformed container without echoing its content', async () => {
    const { entity, storage } = createEntity({
      accounts: 'secret-blob',
    } as unknown as IPrivacyChainXmrSentDB);

    const error = await entity.getRawData().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      'simpledb: invalid persisted data (privacyChainXmrSent)',
    );
    expect(storage.removeItem).not.toHaveBeenCalled();
  });

  it('removes the given accounts only, quarantined records included', async () => {
    const { entity } = createEntity({
      accounts: { gone: { bad: { amountAtomic: 'x' } } },
    });
    await entity.recordXmrSent({
      accountId: 'kept',
      txid: 'x2',
      recipient: '4kept',
    });
    await expect(entity.listAccountIds()).resolves.toEqual(['gone', 'kept']);

    await entity.removeAccounts({ accountIds: ['gone'] });

    await expect(entity.listAccountIds()).resolves.toEqual(['kept']);
    await expect(entity.listXmrSent({ accountId: 'kept' })).resolves.toEqual({
      x2: { recipient: '4kept' },
    });
  });
});
