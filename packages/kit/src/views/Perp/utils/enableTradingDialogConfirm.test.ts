import { getEnableTradingDialogConfirmDecision } from './enableTradingDialogConfirm';

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
