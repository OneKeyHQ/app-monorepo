import {
  buildPerpsAccountStatusCheckInitialDetails,
  canApplyPerpsNotActivatedZeroState,
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
