import type { ReactNode } from 'react';
import { memo, useCallback, useMemo } from 'react';

import { Button, SizableText } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import { useTradingGuard } from '../hooks/useTradingGuard';

import { showDepositWithdrawModal } from './TradingPanel/modals/DepositWithdrawModal';

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
  const { isAgentReady } = useTradingGuard();
  const [perpsAccount] = usePerpsActiveAccountAtom();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();

  // Memoize account info to optimize callback dependencies
  const accountInfo = useMemo(
    () => ({
      accountAddress: perpsAccount.accountAddress,
      accountId: perpsAccount.accountId,
    }),
    [perpsAccount.accountAddress, perpsAccount.accountId],
  );

  const enableTrading = useCallback(async () => {
    try {
      const status =
        await backgroundApiProxy.serviceHyperliquid.enableTrading();
      if (
        status?.details?.activatedOk === false &&
        accountInfo.accountAddress &&
        accountInfo.accountId
      ) {
        void showDepositWithdrawModal({
          withdrawable: '0',
          actionType: 'deposit',
        });
      }
    } catch (error) {
      console.error('[TradingGuardWrapper] Enable trading failed:', error);
    }
  }, [accountInfo.accountAddress, accountInfo.accountId]);

  const shouldShowEnableTrading = useMemo(
    () => forceShowEnableTrading || !isAgentReady,
    [forceShowEnableTrading, isAgentReady],
  );

  const isEnableTradingLoading = perpsAccountLoading.enableTradingLoading;

  const buttonText = useMemo(
    () =>
      appLocale.intl.formatMessage({
        id: ETranslations.perp_trade_button_enable_trading,
      }),
    [],
  );

  const buttonStyles = useMemo(() => {
    const isDisabled = disabled || isEnableTradingLoading;
    return {
      hoverStyle: isDisabled ? undefined : { bg: '$green8' },
      pressStyle: isDisabled ? undefined : { bg: '$green8' },
    };
  }, [disabled, isEnableTradingLoading]);

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
          {buttonText}
        </SizableText>
      </Button>
    );
  }

  return <>{children}</>;
}

const TradingGuardWrapper = memo(TradingGuardWrapperInternal);
TradingGuardWrapper.displayName = 'TradingGuardWrapper';

export { TradingGuardWrapper };
