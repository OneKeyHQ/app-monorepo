import {
  buildPerpsAccountStatusCheckInitialDetails,
  canApplyPerpsNotActivatedZeroState,
  hasPositivePerpsBalance,
  shouldRefreshPerpsActivationFromFundedState,
} from './perpsAccountStatusCheckUtils';

describe('buildPerpsAccountStatusCheckInitialDetails', () => {
  it('starts with activation unknown so a failed check is never persisted as not-activated', () => {
    expect(buildPerpsAccountStatusCheckInitialDetails()).toEqual({
      activatedOk: undefined,
      agentOk: false,
      referralCodeOk: false,
      builderFeeOk: false,
      internalRebateBoundOk: false,
      abstractionOk: false,
    });
  });
});

describe('canApplyPerpsNotActivatedZeroState', () => {
  it('rejects a stale check result even for the still-active address', () => {
    expect(
      canApplyPerpsNotActivatedZeroState({
        checkSeq: 1,
        latestCheckSeq: 2,
        checkedAddress: '0xabc',
        activeAddress: '0xabc',
      }),
    ).toBe(false);
  });

  it('rejects the latest check result after the active address changed', () => {
    expect(
      canApplyPerpsNotActivatedZeroState({
        checkSeq: 2,
        latestCheckSeq: 2,
        checkedAddress: '0xabc',
        activeAddress: '0xdef',
      }),
    ).toBe(false);
  });

  it('rejects when there is no active address anymore', () => {
    expect(
      canApplyPerpsNotActivatedZeroState({
        checkSeq: 2,
        latestCheckSeq: 2,
        checkedAddress: '0xabc',
        activeAddress: null,
      }),
    ).toBe(false);
  });

  it('accepts the latest check for the still-active address case-insensitively', () => {
    expect(
      canApplyPerpsNotActivatedZeroState({
        checkSeq: 2,
        latestCheckSeq: 2,
        checkedAddress: '0xabc',
        activeAddress: '0xABC',
      }),
    ).toBe(true);
  });
});

describe('hasPositivePerpsBalance', () => {
  it('detects a funded balance across clearinghouse or spot values', () => {
    expect(hasPositivePerpsBalance(['0', undefined, '5.99'])).toBe(true);
  });

  it('rejects empty, invalid, zero, and negative values', () => {
    expect(hasPositivePerpsBalance([undefined, '', 'invalid', '0', '-1'])).toBe(
      false,
    );
  });
});

describe('shouldRefreshPerpsActivationFromFundedState', () => {
  const baseParams = {
    activeAddress: '0xabc',
    eventAddress: '0xABC',
    activatedOk: false,
    hasFundedBalance: true,
    refreshHandled: false,
  };

  it('refreshes a still-unactivated account after a funded event', () => {
    expect(shouldRefreshPerpsActivationFromFundedState(baseParams)).toBe(true);
  });

  it.each([
    ['different account', { eventAddress: '0xdef' }],
    ['activation already confirmed', { activatedOk: true }],
    ['activation still unknown', { activatedOk: undefined }],
    ['zero balance event', { hasFundedBalance: false }],
    ['refresh already handled', { refreshHandled: true }],
  ])('does not refresh for %s', (_, override) => {
    expect(
      shouldRefreshPerpsActivationFromFundedState({
        ...baseParams,
        ...override,
      }),
    ).toBe(false);
  });
});
