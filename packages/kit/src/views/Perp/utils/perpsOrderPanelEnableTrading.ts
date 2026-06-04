import type {
  IPerpsAbstractionModeSource,
  IPerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EHyperLiquidAbstractionMode } from '@onekeyhq/shared/types/hyperliquid';

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
  requiresExplicitEnableTrading: boolean;
};

type IPerpsEnableTradingAbstractionMode = {
  accountAddress?: string;
  mode?: EHyperLiquidAbstractionMode;
  source?: IPerpsAbstractionModeSource;
};

function resolveAbstractionOk({
  status,
  abstractionMode,
}: {
  status: IPerpsActiveAccountStatusAtom;
  abstractionMode?: IPerpsEnableTradingAbstractionMode;
}) {
  const liveModeMatchesAccount =
    abstractionMode &&
    abstractionMode.source !== 'cache' &&
    abstractionMode.accountAddress?.toLowerCase() ===
      status.accountAddress?.toLowerCase();

  if (liveModeMatchesAccount) {
    return (
      abstractionMode.mode === EHyperLiquidAbstractionMode.UNIFIED_ACCOUNT ||
      abstractionMode.mode === EHyperLiquidAbstractionMode.PORTFOLIO_MARGIN
    );
  }

  return status.details?.abstractionOk === true;
}

export function getPerpsOrderPanelEnableTradingModeByAccount({
  accountId,
  indexedAccountId,
}: {
  accountId?: string | null;
  indexedAccountId?: string | null;
}): IPerpsOrderPanelEnableTradingMode {
  const resolvedAccountId = accountId ?? indexedAccountId;
  if (!resolvedAccountId) {
    return {
      canAutoEnableInOrderPanel: false,
      requiresEnableTradingDialogInOrderPanel: false,
      requiresExplicitEnableTrading: true,
    };
  }

  const isSoftwareAccount =
    accountUtils.isHdAccount({ accountId: resolvedAccountId }) ||
    accountUtils.isImportedAccount({ accountId: resolvedAccountId });
  const isHardwareAccount = accountUtils.isHwAccount({
    accountId: resolvedAccountId,
  });

  return {
    canAutoEnableInOrderPanel: isSoftwareAccount,
    requiresEnableTradingDialogInOrderPanel: isHardwareAccount,
    requiresExplicitEnableTrading: !isSoftwareAccount,
  };
}

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
      enableTradingMode.requiresExplicitEnableTrading)
  );
}

export function shouldReservePerpsMobileEnableTradingLayout({
  isMobile,
  canShowTradingButtons,
}: {
  isMobile: boolean;
  canShowTradingButtons: boolean;
}) {
  return isMobile && !canShowTradingButtons;
}

export function getPerpsOrderPanelEnableTradingSteps(
  status: IPerpsActiveAccountStatusAtom,
  {
    abstractionMode,
  }: {
    abstractionMode?: IPerpsEnableTradingAbstractionMode;
  } = {},
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
  if (
    !details ||
    !resolveAbstractionOk({
      status,
      abstractionMode,
    })
  ) {
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

export function shouldDisablePerpsOrderPanelTradingButtonForAccountLoading({
  selectAccountLoading,
  enableTradingLoading,
  enableTradingTriggered,
  enableTradingStatusPending,
  isLiveStatusPending,
}: {
  selectAccountLoading: boolean;
  enableTradingLoading: boolean;
  enableTradingTriggered: boolean;
  enableTradingStatusPending: boolean;
  isLiveStatusPending: boolean;
}) {
  if (enableTradingLoading && enableTradingTriggered) {
    return true;
  }
  if (isLiveStatusPending) {
    return false;
  }
  if (enableTradingLoading && enableTradingStatusPending) {
    return true;
  }
  return selectAccountLoading;
}

export function shouldBlockPerpsOrderPanelPreEnableTradingForMargin({
  shouldEnableTradingBeforeOrder: _shouldEnableTradingBeforeOrder,
  isNoEnoughMargin: _isNoEnoughMargin,
  isDepositRequired: _isDepositRequired,
}: {
  shouldEnableTradingBeforeOrder: boolean;
  isNoEnoughMargin: boolean;
  isDepositRequired: boolean;
}) {
  // Pre-enable margin snapshots are not authoritative. Always resolve the
  // trading-enabled state first, then recheck margin with the latest account data.
  return false;
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
