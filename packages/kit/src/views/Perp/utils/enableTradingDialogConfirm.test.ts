import {
  getEnableTradingDialogConfirmDecision,
  shouldShowPerpsFirstDepositPrompt,
} from './enableTradingDialogConfirm';

describe('getEnableTradingDialogConfirmDecision', () => {
  it('continues order confirmation when enable trading returns canTrade', () => {
    expect(
      getEnableTradingDialogConfirmDecision({
        canTrade: true,
        details: { activatedOk: true },
      }),
    ).toBe('continue');
  });

  it('requests deposit when enable trading reports the account is not activated', () => {
    expect(
      getEnableTradingDialogConfirmDecision({
        canTrade: false,
        details: { activatedOk: false },
      }),
    ).toBe('deposit');
  });

  it('stops order confirmation for missing or non-tradable statuses', () => {
    expect(getEnableTradingDialogConfirmDecision(undefined)).toBe('stop');
    expect(
      getEnableTradingDialogConfirmDecision({
        canTrade: false,
        details: { activatedOk: true },
      }),
    ).toBe('stop');
  });
});

describe('shouldShowPerpsFirstDepositPrompt', () => {
  const firstDepositStatus = {
    canTrade: false,
    accountNotSupport: false,
    details: { activatedOk: false },
  };

  it('shows the prompt for a supported account that requires its first deposit', () => {
    expect(
      shouldShowPerpsFirstDepositPrompt({
        status: firstDepositStatus,
        isLiveStatusPending: false,
        isPerpActionDisabled: false,
      }),
    ).toBe(true);
  });

  it.each([
    [
      'unsupported account',
      { ...firstDepositStatus, accountNotSupport: true },
      false,
      false,
    ],
    ['pending live status', firstDepositStatus, true, false],
    ['disabled Perps actions', firstDepositStatus, false, true],
  ])(
    'hides the prompt for %s',
    (_, status, isLiveStatusPending, isPerpActionDisabled) => {
      expect(
        shouldShowPerpsFirstDepositPrompt({
          status,
          isLiveStatusPending,
          isPerpActionDisabled,
        }),
      ).toBe(false);
    },
  );
});
