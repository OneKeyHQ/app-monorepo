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
