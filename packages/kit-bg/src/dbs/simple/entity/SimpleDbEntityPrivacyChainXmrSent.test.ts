// cspell:ignore randMult
import { createMemoryStorage } from '@onekeyhq/shared/src/test-utils/mocks/memoryStorage';

import { SimpleDbEntityPrivacyChainXmrSent } from './SimpleDbEntityPrivacyChainXmrSent';

import type { IPrivacyChainXmrSentDB } from './SimpleDbEntityPrivacyChainXmrSent';

function createEntity(initial?: IPrivacyChainXmrSentDB) {
  const storage = createMemoryStorage(
    initial ? { data: initial, updatedAt: 1 } : null,
  );
  const entity = new SimpleDbEntityPrivacyChainXmrSent();
  Reflect.set(entity, 'appStorage', storage);
  const readSaved = (): unknown =>
    typeof storage.value === 'string'
      ? JSON.parse(storage.value)
      : storage.value;
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
    });
    await entity.recordXmrSent({
      accountId: 'account',
      txid: 'half',
      recipient: 'own-three',
      amountAtomic: '5',
    });
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
        },
        half: { recipient: 'own-three' },
      },
    );
  });

  it('keeps the tx keys with the record but out of the listing', async () => {
    const { entity, readSaved } = createEntity();
    const software = { txKey: '22'.repeat(32), additionalTxKeys: [] };
    const device = {
      salt: '11'.repeat(32),
      randMult: '12'.repeat(32),
      txEncKeys: 'ab'.repeat(76),
      txPrefixHash: '56'.repeat(32),
    };
    await entity.recordXmrSent({
      accountId: 'account',
      txid: 'soft',
      recipient: '4soft',
      amountAtomic: '5',
      feeAtomic: '1',
      txKeys: software,
    });
    await entity.recordXmrSent({
      accountId: 'account',
      txid: 'hw',
      recipient: '4hw',
      txKeys: { device },
    });
    // A later write without keys keeps them.
    await entity.recordXmrSent({
      accountId: 'account',
      txid: 'soft',
      recipient: '4soft',
    });

    await expect(entity.listXmrSent({ accountId: 'account' })).resolves.toEqual(
      {
        soft: { recipient: '4soft', amountAtomic: '5', feeAtomic: '1' },
        hw: { recipient: '4hw' },
      },
    );
    await expect(
      entity.getXmrSentTxKeys({ accountId: 'account', txid: 'soft' }),
    ).resolves.toEqual(software);
    await expect(
      entity.getXmrSentTxKeys({ accountId: 'account', txid: 'hw' }),
    ).resolves.toEqual({ device });
    await expect(
      entity.getXmrSentTxKeys({ accountId: 'account', txid: 'none' }),
    ).resolves.toBeUndefined();
    expect(readSaved()).toMatchObject({
      data: { accounts: { account: { soft: software, hw: { device } } } },
    });

    await entity.removeAccounts({ accountIds: ['account'] });
    await expect(
      entity.getXmrSentTxKeys({ accountId: 'account', txid: 'soft' }),
    ).resolves.toBeUndefined();
  });

  it('refuses malformed tx keys without writing', async () => {
    const { entity, storage } = createEntity();
    await expect(
      entity.recordXmrSent({
        accountId: 'account',
        txid: 'tx',
        recipient: '4x',
        txKeys: { txKey: '22'.repeat(31), additionalTxKeys: [] },
      }),
    ).rejects.toThrow('invalid sent record');
    expect(storage.setItem).not.toHaveBeenCalled();
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
