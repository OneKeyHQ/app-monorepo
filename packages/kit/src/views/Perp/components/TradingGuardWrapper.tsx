import type { ReactNode } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Spinner } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
  usePerpsActiveAccountIsAgentReadyAtom,
  usePerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useShowDepositWithdrawModal } from '../hooks/useShowDepositWithdrawModal';

import { showHyperliquidTermsDialog } from './HyperliquidTerms';

interface ITradingGuardWrapperProps {
  children?: ReactNode;
  forceShowEnableTrading?: boolean;
  disabled?: boolean;
}

function TradingGuardWrapperInternal({
  children,
  forceShowEnableTrading = false,
  disabled = false,
}: ITradingGuardWrapperProps) {
  const intl = useIntl();
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [{ isAgentReady }] = usePerpsActiveAccountIsAgentReadyAtom();
  // Memoize account info to optimize callback dependencies
  const accountInfo = useMemo(
    () => ({
      accountAddress: perpsAccount.accountAddress,
      accountId: perpsAccount.accountId,
    }),
    [perpsAccount.accountAddress, perpsAccount.accountId],
  );
  const { showDepositWithdrawModal } = useShowDepositWithdrawModal();
  const enableTrading = useCallback(async () => {
    try {
      const didAcceptTerms = await showHyperliquidTermsDialog();
      if (!didAcceptTerms) {
        return;
      }

      const status =
        await backgroundApiProxy.serviceHyperliquid.enableTrading();
      if (
        status?.details?.activatedOk === false &&
        accountInfo.accountAddress &&
        accountInfo.accountId
      ) {
        await showDepositWithdrawModal('deposit');
      }
    } catch (error) {
      console.error('[TradingGuardWrapper] Enable trading failed:', error);
    }
  }, [
    accountInfo.accountAddress,
    accountInfo.accountId,
    showDepositWithdrawModal,
  ]);

  const shouldShowEnableTrading = useMemo(() => {
    return forceShowEnableTrading || isAgentReady === false;
  }, [forceShowEnableTrading, isAgentReady]);

  const isEnableTradingLoading = perpsAccountLoading.enableTradingLoading;

  const buttonStyles = useMemo(() => {
    const isDisabled = disabled || isEnableTradingLoading;
    return {
      hoverStyle: isDisabled ? undefined : { bg: '$green8' },
      pressStyle: isDisabled ? undefined : { bg: '$green8' },
    };
  }, [disabled, isEnableTradingLoading]);

  if (perpsAccountLoading.selectAccountLoading) {
    return (
      <Button variant="primary" size="medium" disabled>
        <Spinner />
      </Button>
    );
  }

  if (perpsAccountStatus.accountNotSupport) {
    return (
      <Button variant="primary" size="medium" disabled>
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
        variant="primary"
        size="medium"
        disabled={disabled || isEnableTradingLoading}
        loading={isEnableTradingLoading}
        onPress={disabled ? undefined : enableTrading}
        bg="#18794E"
        hoverStyle={buttonStyles.hoverStyle}
        pressStyle={buttonStyles.pressStyle}
        color="$textOnColor"
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
