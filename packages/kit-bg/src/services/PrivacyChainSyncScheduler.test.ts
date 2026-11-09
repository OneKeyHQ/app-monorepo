import {
  getPrivacyChainFailureBackoffMs,
  getPrivacyChainSyncReason,
  pickPrivacyChainSyncCandidate,
  setActiveTimeout,
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

describe('getPrivacyChainFailureBackoffMs', () => {
  it('doubles from 5 s and caps at 5 minutes', () => {
    expect(getPrivacyChainFailureBackoffMs(0)).toBe(0);
    expect(getPrivacyChainFailureBackoffMs(1)).toBe(5000);
    expect(getPrivacyChainFailureBackoffMs(2)).toBe(10_000);
    expect(getPrivacyChainFailureBackoffMs(20)).toBe(5 * 60 * 1000);
  });
});

describe('backfill rotation order', () => {
  it('visits every backfill group in turn regardless of key case', () => {
    // Locale order puts 'a' before 'B', code-unit order the reverse; mixing them skips 'B'.
    const candidates = ['B:1', 'a:1', 'c:1'].map((runtimeStateKey) => ({
      runtimeStateKey,
      reason: 'backfill' as const,
    }));
    const visited: string[] = [];
    let last: string | undefined;
    for (let i = 0; i < 3; i += 1) {
      const next = pickPrivacyChainSyncCandidate(candidates, last);
      visited.push(next?.runtimeStateKey ?? '');
      last = next?.runtimeStateKey;
    }
    expect(new Set(visited).size).toBe(3);
  });
});

describe('setActiveTimeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('fires once the process has run for the whole span', () => {
    const onTimeout = jest.fn();
    setActiveTimeout(onTimeout, 5000);
    jest.advanceTimersByTime(4000);
    expect(onTimeout).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  // A phone in the background or a laptop asleep wakes far past the deadline.
  it('does not count a suspension', () => {
    const onTimeout = jest.fn();
    setActiveTimeout(onTimeout, 5000);
    jest.setSystemTime(Date.now() + 10 * 60 * 1000);
    // The wake counts as one tick, not ten minutes.
    jest.advanceTimersByTime(1000);
    expect(onTimeout).not.toHaveBeenCalled();
    jest.advanceTimersByTime(3000);
    expect(onTimeout).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  // A hidden window slows timers to about once a minute; that time still ran.
  it('still counts a throttled tick', () => {
    const onTimeout = jest.fn();
    setActiveTimeout(onTimeout, 60_000);
    jest.setSystemTime(Date.now() + 59_000);
    jest.advanceTimersByTime(1000);
    expect(onTimeout).toHaveBeenCalledTimes(1);
  });

  it('stops when cancelled', () => {
    const onTimeout = jest.fn();
    const cancel = setActiveTimeout(onTimeout, 2000);
    cancel();
    jest.advanceTimersByTime(5000);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
