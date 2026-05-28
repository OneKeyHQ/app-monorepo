import type { IPerpsActiveAccountStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export type IPerpsOrderPanelEnableTradingStepKey =
  | 'deposit'
  | 'builderFee'
  | 'agent'
  | 'abstraction';

export type IPerpsOrderPanelEnableTradingStep = {
  key: IPerpsOrderPanelEnableTradingStepKey;
  labelId: ETranslations;
  requiresSignature: boolean;
};

export function shouldShowPerpsOrderPanelTradingButtons({
  canShowCachedTradingButtons,
  statusReady,
  selectAccountLoading,
  accountStatus,
}: {
  canShowCachedTradingButtons: boolean;
  statusReady: boolean;
  selectAccountLoading: boolean;
  accountStatus: IPerpsActiveAccountStatusAtom;
}) {
  if (canShowCachedTradingButtons) {
    return true;
  }

  return (
    !selectAccountLoading &&
    statusReady &&
    Boolean(accountStatus.accountAddress) &&
    !accountStatus.accountNotSupport &&
    !accountStatus.canCreateAddress
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
  if (
    !details ||
    details.agentOk !== true ||
    details.internalRebateBoundOk !== true
  ) {
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

export function getPerpsOrderPanelPostEnableTradingResult({
  enableTradingShouldContinue,
  shouldIgnoreEnableTradingResult,
  isNoEnoughMargin,
}: {
  enableTradingShouldContinue: boolean | undefined;
  shouldIgnoreEnableTradingResult: boolean;
  isNoEnoughMargin: boolean;
}): IPerpsOrderPanelPostEnableTradingResult {
  if (!enableTradingShouldContinue || shouldIgnoreEnableTradingResult) {
    return 'stop';
  }

  if (isNoEnoughMargin) {
    return 'noEnoughMargin';
  }

  return 'continue';
}
