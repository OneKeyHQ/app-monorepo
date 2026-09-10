import {
  getPrivacyChainSyncReason,
  pickPrivacyChainSyncCandidate,
} from './PrivacyChainSyncScheduler';

describe('PrivacyChainSyncScheduler', () => {
  test('skips the wallet runtime when tip and membership are unchanged', () => {
    expect(
      getPrivacyChainSyncReason({
        previous: { accountSignature: 'account-1', lastChainTip: 100 },
        accountSignature: 'account-1',
        chainTip: 100,
        hasBackfill: false,
      }),
    ).toBeUndefined();
  });

  test.each([
    {
      expected: 'membership',
      previous: { accountSignature: 'account-1', lastChainTip: 100 },
      accountSignature: 'account-1|account-2',
      chainTip: 100,
      hasBackfill: false,
    },
    {
      expected: 'tip',
      previous: { accountSignature: 'account-1', lastChainTip: 100 },
      accountSignature: 'account-1',
      chainTip: 101,
      hasBackfill: false,
    },
    {
      expected: 'backfill',
      previous: { accountSignature: 'account-1', lastChainTip: 100 },
      accountSignature: 'account-1',
      chainTip: 100,
      hasBackfill: true,
    },
  ])('returns $expected when that lane needs work', (params) => {
    expect(getPrivacyChainSyncReason(params)).toBe(params.expected);
  });

  test('prioritizes the tip lane ahead of membership and backfill', () => {
    expect(
      pickPrivacyChainSyncCandidate([
        { runtimeStateKey: 'backfill', reason: 'backfill' as const },
        { runtimeStateKey: 'member', reason: 'membership' as const },
        { runtimeStateKey: 'tip', reason: 'tip' as const },
      ])?.runtimeStateKey,
    ).toBe('tip');
  });

  test('rotates between wallet runtimes doing birthday backfill', () => {
    const candidates = [
      { runtimeStateKey: 'a', reason: 'backfill' as const },
      { runtimeStateKey: 'b', reason: 'backfill' as const },
    ];
    expect(
      pickPrivacyChainSyncCandidate(candidates, 'a')?.runtimeStateKey,
    ).toBe('b');
    expect(
      pickPrivacyChainSyncCandidate(candidates, 'b')?.runtimeStateKey,
    ).toBe('a');
  });
});
