import type { IPerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IPerpsOrderPanelEnableTradingStepKey =
  | 'deposit'
  | 'builderFee'
  | 'agentRemoval'
  | 'agent'
  | 'abstraction';

export type IPerpsOrderPanelEnableTradingStep = {
  key: IPerpsOrderPanelEnableTradingStepKey;
  labelId: ETranslations;
  requiresSignature: boolean;
};

export type IPerpsOrderPanelEnableTradingMode = {
  canAutoEnableInOrderPanel: boolean;
  requiresEnableTradingDialogInOrderPanel: boolean;
};

export function shouldShowPerpsOrderPanelTradingButtons({
  canShowCachedTradingButtons,
  statusReady,
  selectAccountLoading,
  accountStatus,
  enableTradingMode,
}: {
  canShowCachedTradingButtons: boolean;
  statusReady: boolean;
  selectAccountLoading: boolean;
  accountStatus: IPerpsActiveAccountStatusAtom;
  enableTradingMode: IPerpsOrderPanelEnableTradingMode;
}) {
  if (canShowCachedTradingButtons) {
    return true;
  }

  return (
    !selectAccountLoading &&
    statusReady &&
    Boolean(accountStatus.accountAddress) &&
    !accountStatus.accountNotSupport &&
    !accountStatus.canCreateAddress &&
    (Boolean(accountStatus.canTrade) ||
      enableTradingMode.canAutoEnableInOrderPanel ||
      enableTradingMode.requiresEnableTradingDialogInOrderPanel)
  );
}

export function getPerpsOrderPanelEnableTradingSteps(
  status: IPerpsActiveAccountStatusAtom,
): IPerpsOrderPanelEnableTradingStep[] {
  const { details } = status;

  if (details?.activatedOk === false) {
    return [
      {
        key: 'deposit',
        labelId: ETranslations.perp_account_action_vault_transfer_deposit,
        requiresSignature: false,
      },
    ];
  }

  const steps: IPerpsOrderPanelEnableTradingStep[] = [];
  if (!details || details.builderFeeOk !== true) {
    steps.push({
      key: 'builderFee',
      labelId: ETranslations.global_approve,
      requiresSignature: true,
    });
  }
  const shouldSetupAgent =
    !details ||
    details.agentOk !== true ||
    details.internalRebateBoundOk !== true;
  if (shouldSetupAgent) {
    if (details?.requiresAgentRemovalSignature) {
      steps.push({
        key: 'agentRemoval',
        labelId: ETranslations.global_sign,
        requiresSignature: true,
      });
    }
    steps.push({
      key: 'agent',
      labelId: ETranslations.global_sign,
      requiresSignature: true,
    });
  }
  if (!details || details.abstractionOk !== true) {
    steps.push({
      key: 'abstraction',
      labelId: ETranslations.perp_trade_button_enable_trading,
      requiresSignature: true,
    });
  }
  return steps;
}

export function getPerpsOrderPanelEnableTradingSignatureCount(
  steps: IPerpsOrderPanelEnableTradingStep[],
) {
  return steps.filter((step) => step.requiresSignature).length;
}

export type IPerpsOrderPanelPostEnableTradingResult =
  | 'continue'
  | 'noEnoughMargin'
  | 'stop';

export function shouldDisablePerpsOrderPanelTradingButton({
  isTradingStatusDisabled,
  shouldEnableTradingBeforeOrder,
  isNoEnoughMargin,
  isAccountLoading,
  isSubmitting,
  hasBboPriceError,
  isServerActionDisabled,
}: {
  isTradingStatusDisabled: boolean;
  shouldEnableTradingBeforeOrder: boolean;
  isNoEnoughMargin: boolean;
  isAccountLoading: boolean;
  isSubmitting: boolean;
  hasBboPriceError: boolean;
  isServerActionDisabled: boolean;
}) {
  return (
    isTradingStatusDisabled ||
    (!shouldEnableTradingBeforeOrder && isNoEnoughMargin) ||
    isAccountLoading ||
    isSubmitting ||
    (!shouldEnableTradingBeforeOrder && hasBboPriceError) ||
    isServerActionDisabled
  );
}

export function shouldBlockPerpsOrderPanelPreEnableTradingForMargin({
  shouldEnableTradingBeforeOrder,
  isNoEnoughMargin,
  isDepositRequired,
}: {
  shouldEnableTradingBeforeOrder: boolean;
  isNoEnoughMargin: boolean;
  isDepositRequired: boolean;
}) {
  return (
    shouldEnableTradingBeforeOrder && isNoEnoughMargin && !isDepositRequired
  );
}

export function shouldSkipPerpsOrderPanelComputedSizeValidation({
  shouldValidateBboPriceError,
  hasBboPriceError,
}: {
  shouldValidateBboPriceError: boolean;
  hasBboPriceError: boolean;
}) {
  return !shouldValidateBboPriceError && hasBboPriceError;
}

export function getPerpsOrderPanelPostEnableTradingResult({
  enableTradingShouldContinue,
  shouldIgnoreEnableTradingResult,
  isOrderContextChanged,
  isNoEnoughMargin,
}: {
  enableTradingShouldContinue: boolean | undefined;
  shouldIgnoreEnableTradingResult: boolean;
  isOrderContextChanged: boolean;
  isNoEnoughMargin: boolean;
}): IPerpsOrderPanelPostEnableTradingResult {
  if (
    !enableTradingShouldContinue ||
    shouldIgnoreEnableTradingResult ||
    isOrderContextChanged
  ) {
    return 'stop';
  }

  if (isNoEnoughMargin) {
    return 'noEnoughMargin';
  }

  return 'continue';
}
