import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  getPerpsOrderPanelEnableTradingSignatureCount,
  getPerpsOrderPanelEnableTradingSteps,
  getPerpsOrderPanelPostEnableTradingResult,
  shouldShowPerpsOrderPanelTradingButtons,
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
});

describe('getPerpsOrderPanelPostEnableTradingResult', () => {
  it('stops order submission when the latest state changes after enabling trading', () => {
    expect(
      getPerpsOrderPanelPostEnableTradingResult({
        enableTradingShouldContinue: true,
        shouldIgnoreEnableTradingResult: true,
        isNoEnoughMargin: false,
      }),
    ).toBe('stop');

    expect(
      getPerpsOrderPanelPostEnableTradingResult({
        enableTradingShouldContinue: true,
        shouldIgnoreEnableTradingResult: false,
        isNoEnoughMargin: true,
      }),
    ).toBe('noEnoughMargin');
  });

  it('continues only when enable trading succeeds and the latest state is still valid', () => {
    expect(
      getPerpsOrderPanelPostEnableTradingResult({
        enableTradingShouldContinue: true,
        shouldIgnoreEnableTradingResult: false,
        isNoEnoughMargin: false,
      }),
    ).toBe('continue');
  });
});
