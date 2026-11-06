import { getPrivacyTransactionReviewDigest } from './privacyTransactionReview';

const approved = {
  accountId: 'account',
  networkId: 'network',
  proposalHex: 'aabb',
  intent: { to: 'recipient', amount: '9007199254740993', fee: '1', max: false },
};

describe('privacy payment approval digest', () => {
  it('is stable when object insertion order changes', () => {
    expect(getPrivacyTransactionReviewDigest(approved)).toBe(
      getPrivacyTransactionReviewDigest({
        ...approved,
        intent: {
          max: false,
          fee: '1',
          amount: '9007199254740993',
          to: 'recipient',
        },
      }),
    );
  });
  it.each(['accountId', 'networkId', 'proposalHex'])(
    'binds %s to the approval',
    (key) => {
      expect(
        getPrivacyTransactionReviewDigest({ ...approved, [key]: 'changed' }),
      ).not.toBe(getPrivacyTransactionReviewDigest(approved));
    },
  );
  it.each(['to', 'amount', 'fee', 'max'])(
    'binds intent field %s to the approval',
    (key) => {
      expect(
        getPrivacyTransactionReviewDigest({
          ...approved,
          intent: { ...approved.intent, [key]: 'changed' },
        }),
      ).not.toBe(getPrivacyTransactionReviewDigest(approved));
    },
  );
});
