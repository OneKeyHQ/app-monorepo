import type { ReactNode } from 'react';
import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Spinner } from '@onekeyhq/components';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountIsAgentReadyAtom,
  usePerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useEnableTradingWithDepositFallback } from '../hooks/useEnableTradingWithDepositFallback';

interface ITradingGuardWrapperProps {
  children?: ReactNode;
  forceShowEnableTrading?: boolean;
  bypassEnableTradingGuard?: boolean;
  disabled?: boolean;
}

function TradingGuardWrapperInternal({
  children,
  forceShowEnableTrading = false,
  bypassEnableTradingGuard = false,
  disabled = false,
}: ITradingGuardWrapperProps) {
  const intl = useIntl();
  const [perpsAccountLoading] = usePerpsAccountLoadingInfoAtom();
  const [perpsAccountStatus] = usePerpsActiveAccountStatusAtom();
  const [{ isAgentReady }] = usePerpsActiveAccountIsAgentReadyAtom();
  const enableTrading = useEnableTradingWithDepositFallback();

  const shouldShowEnableTrading = useMemo(() => {
    if (bypassEnableTradingGuard) {
      return forceShowEnableTrading;
    }
    return forceShowEnableTrading || isAgentReady === false;
  }, [bypassEnableTradingGuard, forceShowEnableTrading, isAgentReady]);

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
      <Button
        variant="primary"
        size="medium"
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
        size="medium"
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
        size="medium"
        disabled={disabled || isEnableTradingLoading}
        loading={isEnableTradingLoading}
        onPress={disabled ? undefined : enableTrading}
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
