import { SimpleDbEntityXmr } from './SimpleDbEntityXmr';

function createEntity() {
  let saved: unknown = null;
  const entity = new SimpleDbEntityXmr();
  Reflect.set(entity, 'appStorage', {
    getItem: async () => saved,
    setItem: async (_key: string, value: unknown) => {
      saved = value;
    },
  });
  return entity;
}
describe('Monero simple db entity', () => {
  it('still reads data written with the retired transaction reviews', async () => {
    const entity = new SimpleDbEntityXmr();
    Reflect.set(entity, 'appStorage', {
      getItem: async () =>
        JSON.stringify({
          data: {
            accounts: { account: { intent: 'on' } },
            transactionReviews: {
              account: { r: { digest: 'd', state: 'unsigned' } },
            },
          },
        }),
      setItem: async () => undefined,
    });
    expect(await entity.getAccountState({ accountId: 'account' })).toEqual({
      intent: 'on',
    });
  });
  it('preserves legacy recipients and persists payment and fee separately', async () => {
    const entity = createEntity();
    await entity.recordSentRecipient({
      accountId: 'account',
      txid: 'legacy',
      recipient: 'own-two',
    });
    await entity.recordSentRecipient({
      accountId: 'account',
      txid: 'new',
      recipient: 'own-two',
      amountAtomic: '1000000000000',
      feeAtomic: '30000000',
    });
    expect(await entity.getSentRecipients({ accountId: 'account' })).toEqual({
      legacy: 'own-two',
      new: 'own-two',
    });
    expect(await entity.getSentAmounts({ accountId: 'account' })).toEqual({
      new: { amountAtomic: '1000000000000', feeAtomic: '30000000' },
    });
    await entity.removeAccount({ accountId: 'account' });
    expect(await entity.getSentAmounts({ accountId: 'account' })).toEqual({});
  });
  // Re-enabling after a local data delete must not start at tip and miss
  // older funds; removing the account itself keeps nothing.
  it('keeps only the birthday when local data is deleted', async () => {
    const entity = createEntity();
    const scanned = {
      intent: 'on' as const,
      birthdayHeight: 3_000_000,
      birthdaySource: 'user',
      birthdayTimestamp: 1_700_000_000_000,
      keyImagesImportedAt: 1,
    };
    await entity.setAccountState({ accountId: 'account', state: scanned });

    await entity.removeAccount({ accountId: 'account', keepBirthday: true });
    expect(await entity.getAccountState({ accountId: 'account' })).toEqual({
      intent: 'off',
      birthdayHeight: 3_000_000,
      birthdaySource: 'user',
      birthdayTimestamp: 1_700_000_000_000,
    });
    expect(await entity.hasAnyAccountState()).toBe(false);

    await entity.removeAccount({ accountId: 'account' });
    expect(await entity.listAccountIds()).toEqual([]);
  });
});
