import type { ReactNode } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  perpsActiveAccountStatusAtom,
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountEnableTradingModeAtom,
  usePerpsActiveAccountIsAgentReadyAtom,
  usePerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import errorToastUtils from '@onekeyhq/shared/src/errors/utils/errorToastUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  useConfirmHyperliquidTerms,
  useRequestEnableTradingWithDepositFallback,
} from '../hooks/useEnableTradingWithDepositFallback';
import { useShowDepositWithdrawModal } from '../hooks/useShowDepositWithdrawModal';
import { getEnableTradingDialogConfirmDecision } from '../utils/enableTradingDialogConfirm';

import { showEnableTradingStepsDialog } from './TradingPanel/modals/EnableTradingStepsDialog';

interface ITradingGuardWrapperProps {
  children?: ReactNode;
  forceShowEnableTrading?: boolean;
  bypassEnableTradingGuard?: boolean;
  disabled?: boolean;
  buttonSize?: 'medium' | 'large';
}

function TradingGuardWrapperInternal({
  children,
  forceShowEnableTrading = false,
  bypassEnableTradingGuard = false,
  disabled = false,
  buttonSize = 'medium',
}: ITradingGuardWrapperProps) {
  const intl = useIntl();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [enableTradingMode] = usePerpsActiveAccountEnableTradingModeAtom();
  const [{ isAgentReady }] = usePerpsActiveAccountIsAgentReadyAtom();
  const confirmHyperliquidTerms = useConfirmHyperliquidTerms();
  const requestEnableTradingWithDepositFallback =
    useRequestEnableTradingWithDepositFallback();
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();

  const shouldShowEnableTrading = useMemo(() => {
    if (bypassEnableTradingGuard) {
      return forceShowEnableTrading;
    }
    return forceShowEnableTrading || isAgentReady === false;
  }, [bypassEnableTradingGuard, forceShowEnableTrading, isAgentReady]);

  const isEnableTradingLoading = perpsAccountLoading.enableTradingLoading;
  const shouldShowEnableTradingStepsDialog =
    enableTradingMode.requiresExplicitEnableTrading;

  const buttonStyles = useMemo(() => {
    const isDisabled = disabled || isEnableTradingLoading;
    return {
      hoverStyle: isDisabled ? undefined : { bg: '$green8' },
      pressStyle: isDisabled ? undefined : { bg: '$green8' },
    };
  }, [disabled, isEnableTradingLoading]);

  const handleEnableTrading = useCallback(async () => {
    if (disabled || isEnableTradingLoading) {
      return;
    }

    if (shouldShowEnableTradingStepsDialog) {
      // The dialog must use a fresh status snapshot so the predicted
      // confirmations stay aligned with the enable-trading execution path.
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        await backgroundApiProxy.serviceHyperliquid.checkPerpsAccountStatus();
      } catch (error) {
        errorToastUtils.toastIfError(error);
        return;
      }
      const latestPerpsAccountStatus =
        (await perpsActiveAccountStatusAtom.get()) ?? perpsAccountStatus;
      if (
        getEnableTradingDialogConfirmDecision(latestPerpsAccountStatus) ===
        'deposit'
      ) {
        await showDepositWithdrawModal('deposit');
        return;
      }

      await showEnableTradingStepsDialog({
        accountStatus: latestPerpsAccountStatus,
        onConfirm: async ({ closeDialog }) => {
          const didAcceptTerms = await confirmHyperliquidTerms();
          if (!didAcceptTerms) {
            return {
              shouldContinue: false,
              status: undefined,
            };
          }
          return requestEnableTradingWithDepositFallback({
            beforeDeposit: closeDialog,
          });
        },
      });
      return;
    }

    const didAcceptTerms = await confirmHyperliquidTerms();
    if (!didAcceptTerms) {
      return;
    }

    await requestEnableTradingWithDepositFallback();
  }, [
    confirmHyperliquidTerms,
    disabled,
    isEnableTradingLoading,
    perpsAccountStatus,
    requestEnableTradingWithDepositFallback,
    showDepositWithdrawModal,
    shouldShowEnableTradingStepsDialog,
  ]);

  if (perpsAccountLoading.selectAccountLoading) {
    return (
      <Button
        variant="primary"
        size={buttonSize}
        disabled
        childrenAsText={false}
        testID="perp-is-disabled-btn"
      >
        <Spinner />
      </Button>
    );
  }

  if (perpsAccountStatus.accountNotSupport) {
    return (
      <Button
        variant="primary"
        size={buttonSize}
        disabled
        childrenAsText={false}
        testID="perp-is-disabled-btn"
      >
        <SizableText size="$bodyMdMedium" color="$textOnColor">
          {intl.formatMessage({
            id: ETranslations.perp_trade_button_account_unsupported,
          })}
        </SizableText>
      </Button>
    );
  }

  if (shouldShowEnableTrading || !children) {
    return (
      <Button
        testID="perp-is-disabled-btn"
        variant="primary"
        size={buttonSize}
        disabled={disabled || isEnableTradingLoading}
        loading={isEnableTradingLoading}
        onPress={disabled ? undefined : handleEnableTrading}
        bg="#18794E"
        hoverStyle={buttonStyles.hoverStyle}
        pressStyle={buttonStyles.pressStyle}
        color="$textOnColor"
        childrenAsText={false}
      >
        <SizableText size="$bodyMdMedium" color="$textOnColor">
          {intl.formatMessage({
            id: ETranslations.perp_trade_button_enable_trading,
          })}
        </SizableText>
      </Button>
    );
  }

  return <>{children}</>;
}

const TradingGuardWrapper = memo(TradingGuardWrapperInternal);
TradingGuardWrapper.displayName = 'TradingGuardWrapper';

export { TradingGuardWrapper };
