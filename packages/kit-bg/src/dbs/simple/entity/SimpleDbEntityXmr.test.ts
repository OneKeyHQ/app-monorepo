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
const review = {
  accountId: 'account',
  reservationId: 'reservation',
  digest: 'digest',
};

describe('Monero persisted transaction approvals', () => {
  it('cancellation prevents a later signer and remains retryable until released', async () => {
    const entity = createEntity();
    await entity.saveTransactionReview(review);
    expect(await entity.abandonUnsignedTransactionReview(review)).toBe(true);
    expect(await entity.abandonUnsignedTransactionReview(review)).toBe(true);
    await expect(entity.claimTransactionReview(review)).rejects.toThrow();
    await entity.removeTransactionReview(review);
    expect(await entity.abandonUnsignedTransactionReview(review)).toBe(false);
  });
  it('does not abandon signed inputs or another account’s approval', async () => {
    const entity = createEntity();
    await entity.saveTransactionReview(review);
    expect(
      await entity.abandonUnsignedTransactionReview({
        ...review,
        accountId: 'other',
      }),
    ).toBe(false);
    await entity.claimTransactionReview(review);
    expect(await entity.abandonUnsignedTransactionReview(review)).toBe(false);
  });
  it('retains an abandoned approval for release retry after another preview is built', async () => {
    const entity = createEntity();
    await entity.saveTransactionReview(review);
    await entity.abandonUnsignedTransactionReview(review);
    const latest = { ...review, reservationId: 'latest' };
    await entity.saveTransactionReview(latest);
    await expect(entity.claimTransactionReview(review)).rejects.toThrow();
    expect(await entity.abandonUnsignedTransactionReview(review)).toBe(true);
    await entity.removeTransactionReview(review);
    expect(await entity.abandonUnsignedTransactionReview(review)).toBe(false);
    await entity.claimTransactionReview(latest);
  });
  it('an approval can be signed or abandoned, never both concurrently', async () => {
    const entity = createEntity();
    await entity.saveTransactionReview(review);
    const [signed, abandoned] = await Promise.allSettled([
      entity.claimTransactionReview(review),
      entity.abandonUnsignedTransactionReview(review),
    ]);
    expect(signed.status).toBe('fulfilled');
    expect(abandoned).toEqual({ status: 'fulfilled', value: false });
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
  // Deleting an account leaves none of its send approvals behind.
  it('drops transaction reviews with the account', async () => {
    const entity = createEntity();
    await entity.saveTransactionReview(review);
    await entity.removeAccount({ accountId: review.accountId });
    expect(
      (await entity.getRawData())?.transactionReviews?.[review.accountId],
    ).toBeUndefined();
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
  it('allows only one concurrent signer to claim an approval', async () => {
    const entity = createEntity();
    await entity.saveTransactionReview(review);
    const attempts = await Promise.allSettled([
      entity.claimTransactionReview(review),
      entity.claimTransactionReview(review),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === 'rejected'),
    ).toHaveLength(1);
  });
  it('rejects a replaced digest and another account without consuming the approval', async () => {
    const entity = createEntity();
    await entity.saveTransactionReview(review);
    await expect(
      entity.claimTransactionReview({ ...review, digest: 'changed' }),
    ).rejects.toThrow();
    await expect(
      entity.claimTransactionReview({ ...review, accountId: 'other' }),
    ).rejects.toThrow();
    await entity.claimTransactionReview(review);
  });
  it('a new review invalidates an earlier unsigned approval but retains signed ones', async () => {
    const entity = createEntity();
    await entity.saveTransactionReview(review);
    await entity.claimTransactionReview(review);
    await entity.saveTransactionReview({
      ...review,
      reservationId: 'abandoned',
    });
    await entity.saveTransactionReview({ ...review, reservationId: 'latest' });
    await expect(
      entity.claimTransactionReview({ ...review, reservationId: 'abandoned' }),
    ).rejects.toThrow();
    expect(
      (await entity.getRawData())?.transactionReviews?.account?.reservation
        ?.state,
    ).toBe('signed');
    await entity.claimTransactionReview({ ...review, reservationId: 'latest' });
  });
  it('fails closed when persistence is blocked', async () => {
    const entity = createEntity();
    jest.spyOn(entity, 'setRawData').mockResolvedValue(undefined);
    await expect(entity.claimTransactionReview(review)).rejects.toThrow(
      'could not be claimed',
    );
  });
});
