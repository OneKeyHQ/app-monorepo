import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getPerpsOrderPanelEnableTradingSignatureCount,
  getPerpsOrderPanelEnableTradingSteps,
  getPerpsOrderPanelPostEnableTradingResult,
  shouldBlockPerpsOrderPanelPreEnableTradingForMargin,
  shouldDisablePerpsOrderPanelTradingButton,
  shouldShowPerpsOrderPanelTradingButtons,
  shouldSkipPerpsOrderPanelComputedSizeValidation,
} from './perpsOrderPanelEnableTrading';

describe('shouldShowPerpsOrderPanelTradingButtons', () => {
  it('shows trading buttons for a hardware account that is not enabled yet', () => {
    expect(
      shouldShowPerpsOrderPanelTradingButtons({
        canShowCachedTradingButtons: false,
        statusReady: true,
        selectAccountLoading: false,
        accountStatus: {
          accountAddress: '0xabc',
          accountNotSupport: false,
          canCreateAddress: false,
          canTrade: false,
          details: {
            activatedOk: true,
            agentOk: false,
            builderFeeOk: false,
            referralCodeOk: false,
            internalRebateBoundOk: false,
            abstractionOk: false,
          },
        },
        enableTradingMode: {
          canAutoEnableInOrderPanel: false,
          requiresEnableTradingDialogInOrderPanel: true,
        },
      }),
    ).toBe(true);
  });

  it('keeps non-auto-enable accounts on the fallback CTA path', () => {
    expect(
      shouldShowPerpsOrderPanelTradingButtons({
        canShowCachedTradingButtons: false,
        statusReady: true,
        selectAccountLoading: false,
        accountStatus: {
          accountAddress: '0xabc',
          accountNotSupport: false,
          canCreateAddress: false,
          canTrade: false,
          details: {
            activatedOk: true,
            agentOk: false,
            builderFeeOk: false,
            referralCodeOk: true,
            internalRebateBoundOk: true,
            abstractionOk: false,
          },
        },
        enableTradingMode: {
          canAutoEnableInOrderPanel: false,
          requiresEnableTradingDialogInOrderPanel: false,
        },
      }),
    ).toBe(false);
  });

  it('keeps the fallback button for unsupported or address-creation states', () => {
    expect(
      shouldShowPerpsOrderPanelTradingButtons({
        canShowCachedTradingButtons: false,
        statusReady: true,
        selectAccountLoading: false,
        accountStatus: {
          accountAddress: '0xabc',
          accountNotSupport: true,
          canCreateAddress: false,
          canTrade: false,
          details: undefined,
        },
        enableTradingMode: {
          canAutoEnableInOrderPanel: true,
          requiresEnableTradingDialogInOrderPanel: false,
        },
      }),
    ).toBe(false);

    expect(
      shouldShowPerpsOrderPanelTradingButtons({
        canShowCachedTradingButtons: false,
        statusReady: true,
        selectAccountLoading: false,
        accountStatus: {
          accountAddress: null,
          accountNotSupport: false,
          canCreateAddress: true,
          canTrade: false,
          details: undefined,
        },
        enableTradingMode: {
          canAutoEnableInOrderPanel: true,
          requiresEnableTradingDialogInOrderPanel: false,
        },
      }),
    ).toBe(false);
  });
});

describe('getPerpsOrderPanelEnableTradingSteps', () => {
  it('counts hardware wallet signature steps from unmet status details', () => {
    const steps = getPerpsOrderPanelEnableTradingSteps({
      accountAddress: '0xabc',
      accountNotSupport: false,
      canCreateAddress: false,
      canTrade: false,
      details: {
        activatedOk: true,
        agentOk: false,
        builderFeeOk: false,
        referralCodeOk: true,
        internalRebateBoundOk: true,
        abstractionOk: false,
      },
    });

    expect(steps).toEqual([
      {
        key: 'builderFee',
        labelId: ETranslations.global_approve,
        requiresSignature: true,
      },
      {
        key: 'agent',
        labelId: ETranslations.global_sign,
        requiresSignature: true,
      },
      {
        key: 'abstraction',
        labelId: ETranslations.perp_trade_button_enable_trading,
        requiresSignature: true,
      },
    ]);
    expect(getPerpsOrderPanelEnableTradingSignatureCount(steps)).toBe(3);
  });

  it('counts agent slot recovery as an extra hardware signature', () => {
    const steps = getPerpsOrderPanelEnableTradingSteps({
      accountAddress: '0xabc',
      accountNotSupport: false,
      canCreateAddress: false,
      canTrade: false,
      details: {
        activatedOk: true,
        agentOk: false,
        builderFeeOk: true,
        referralCodeOk: true,
        internalRebateBoundOk: true,
        abstractionOk: true,
        requiresAgentRemovalSignature: true,
      },
    });

    expect(steps).toEqual([
      {
        key: 'agentRemoval',
        labelId: ETranslations.global_sign,
        requiresSignature: true,
      },
      {
        key: 'agent',
        labelId: ETranslations.global_sign,
        requiresSignature: true,
      },
    ]);
    expect(getPerpsOrderPanelEnableTradingSignatureCount(steps)).toBe(2);
  });

  it('does not count deposit fallback as a hardware signature', () => {
    const steps = getPerpsOrderPanelEnableTradingSteps({
      accountAddress: '0xabc',
      accountNotSupport: false,
      canCreateAddress: false,
      canTrade: false,
      details: {
        activatedOk: false,
        agentOk: false,
        builderFeeOk: false,
        referralCodeOk: false,
        internalRebateBoundOk: false,
        abstractionOk: false,
      },
    });

    expect(steps).toEqual([
      {
        key: 'deposit',
        labelId: ETranslations.perp_account_action_vault_transfer_deposit,
        requiresSignature: false,
      },
    ]);
    expect(getPerpsOrderPanelEnableTradingSignatureCount(steps)).toBe(0);
  });
});

describe('getPerpsOrderPanelPostEnableTradingResult', () => {
  it('stops order submission when enabling trading does not continue', () => {
    expect(
      getPerpsOrderPanelPostEnableTradingResult({
        enableTradingShouldContinue: false,
        shouldIgnoreEnableTradingResult: false,
        isOrderContextChanged: false,
        isNoEnoughMargin: false,
      }),
    ).toBe('stop');

    expect(
      getPerpsOrderPanelPostEnableTradingResult({
        enableTradingShouldContinue: undefined,
        shouldIgnoreEnableTradingResult: false,
        isOrderContextChanged: false,
        isNoEnoughMargin: false,
      }),
    ).toBe('stop');
  });

  it('stops order submission when the latest state changes after enabling trading', () => {
    expect(
      getPerpsOrderPanelPostEnableTradingResult({
        enableTradingShouldContinue: true,
        shouldIgnoreEnableTradingResult: true,
        isOrderContextChanged: false,
        isNoEnoughMargin: false,
      }),
    ).toBe('stop');

    expect(
      getPerpsOrderPanelPostEnableTradingResult({
        enableTradingShouldContinue: true,
        shouldIgnoreEnableTradingResult: false,
        isOrderContextChanged: true,
        isNoEnoughMargin: false,
      }),
    ).toBe('stop');
  });

  it('reports no-enough-margin only when enable trading can still continue', () => {
    expect(
      getPerpsOrderPanelPostEnableTradingResult({
        enableTradingShouldContinue: true,
        shouldIgnoreEnableTradingResult: false,
        isOrderContextChanged: false,
        isNoEnoughMargin: true,
      }),
    ).toBe('noEnoughMargin');
  });

  it('continues only when enable trading succeeds and the latest state is still valid', () => {
    expect(
      getPerpsOrderPanelPostEnableTradingResult({
        enableTradingShouldContinue: true,
        shouldIgnoreEnableTradingResult: false,
        isOrderContextChanged: false,
        isNoEnoughMargin: false,
      }),
    ).toBe('continue');
  });
});

describe('shouldBlockPerpsOrderPanelPreEnableTradingForMargin', () => {
  it('blocks enable side effects for known insufficient margin orders', () => {
    expect(
      shouldBlockPerpsOrderPanelPreEnableTradingForMargin({
        shouldEnableTradingBeforeOrder: true,
        isNoEnoughMargin: true,
        isDepositRequired: false,
      }),
    ).toBe(true);
  });

  it('keeps deposit fallback reachable when the account is not activated', () => {
    expect(
      shouldBlockPerpsOrderPanelPreEnableTradingForMargin({
        shouldEnableTradingBeforeOrder: true,
        isNoEnoughMargin: true,
        isDepositRequired: true,
      }),
    ).toBe(false);
  });

  it('does not block normal order submission', () => {
    expect(
      shouldBlockPerpsOrderPanelPreEnableTradingForMargin({
        shouldEnableTradingBeforeOrder: false,
        isNoEnoughMargin: true,
        isDepositRequired: false,
      }),
    ).toBe(false);
  });
});

describe('shouldDisablePerpsOrderPanelTradingButton', () => {
  it('lets enable-trading accounts press the button when only BBO price is unavailable', () => {
    expect(
      shouldDisablePerpsOrderPanelTradingButton({
        isTradingStatusDisabled: false,
        shouldEnableTradingBeforeOrder: true,
        isNoEnoughMargin: false,
        isAccountLoading: false,
        isSubmitting: false,
        hasBboPriceError: true,
        isServerActionDisabled: false,
      }),
    ).toBe(false);
  });

  it('keeps BBO price errors blocking normal order submission', () => {
    expect(
      shouldDisablePerpsOrderPanelTradingButton({
        isTradingStatusDisabled: false,
        shouldEnableTradingBeforeOrder: false,
        isNoEnoughMargin: false,
        isAccountLoading: false,
        isSubmitting: false,
        hasBboPriceError: true,
        isServerActionDisabled: false,
      }),
    ).toBe(true);
  });
});

describe('shouldSkipPerpsOrderPanelComputedSizeValidation', () => {
  it('skips computed size validation only for pre-enable BBO unavailable flows', () => {
    expect(
      shouldSkipPerpsOrderPanelComputedSizeValidation({
        shouldValidateBboPriceError: false,
        hasBboPriceError: true,
      }),
    ).toBe(true);

    expect(
      shouldSkipPerpsOrderPanelComputedSizeValidation({
        shouldValidateBboPriceError: true,
        hasBboPriceError: true,
      }),
    ).toBe(false);

    expect(
      shouldSkipPerpsOrderPanelComputedSizeValidation({
        shouldValidateBboPriceError: false,
        hasBboPriceError: false,
      }),
    ).toBe(false);
  });
});
