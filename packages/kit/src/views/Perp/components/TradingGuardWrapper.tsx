import type { ReactNode } from 'react';
import {
  cloneElement,
  isValidElement,
  memo,
  useCallback,
  useMemo,
  useState,
} from 'react';

import { useIntl } from 'react-intl';

import { Button, SizableText, Spinner } from '@onekeyhq/components';
import {
  usePerpsAccountLoadingInfoAtom,
  usePerpsActiveAccountIsAgentReadyAtom,
  usePerpsActiveAccountStatusAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useEnableTradingWithDepositFallback } from '../hooks/useEnableTradingWithDepositFallback';

import { getTradingGuardRenderMode } from './TradingGuardWrapper.utils';

type ITradingGuardActionChildProps = {
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void | Promise<void>;
};

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
  const [isGuardedActionLoading, setIsGuardedActionLoading] = useState(false);

  const shouldShowEnableTrading = useMemo(() => {
    if (bypassEnableTradingGuard) {
      return forceShowEnableTrading;
    }
    return forceShowEnableTrading || isAgentReady === false;
  }, [bypassEnableTradingGuard, forceShowEnableTrading, isAgentReady]);

  const isEnableTradingLoading =
    perpsAccountLoading.enableTradingLoading || isGuardedActionLoading;
  const actionableChild = isValidElement<ITradingGuardActionChildProps>(
    children,
  )
    ? children
    : undefined;
  const canRunGuardedAction = Boolean(
    !forceShowEnableTrading && actionableChild?.props.onPress,
  );
  const renderMode = getTradingGuardRenderMode({
    selectAccountLoading: perpsAccountLoading.selectAccountLoading,
    accountNotSupport: Boolean(perpsAccountStatus.accountNotSupport),
    shouldShowEnableTrading,
    hasChildren: Boolean(children),
    canRunGuardedAction,
  });

  const buttonStyles = useMemo(() => {
    const isDisabled = disabled || isEnableTradingLoading;
    return {
      hoverStyle: isDisabled ? undefined : { bg: '$green8' },
      pressStyle: isDisabled ? undefined : { bg: '$green8' },
    };
  }, [disabled, isEnableTradingLoading]);

  const renderGuardedChildren = useCallback(() => {
    if (!actionableChild) {
      return null;
    }

    const childProps = actionableChild.props;
    const childDisabled = Boolean(childProps.disabled);
    const childLoading = Boolean(childProps.loading);

    const handleGuardedAction = async () => {
      if (disabled || childDisabled || isEnableTradingLoading) {
        return;
      }

      setIsGuardedActionLoading(true);
      let shouldContinue = false;
      try {
        const result = await enableTrading();
        shouldContinue = result.shouldContinue;
      } finally {
        setIsGuardedActionLoading(false);
      }

      if (!shouldContinue) {
        return;
      }
      await childProps.onPress?.();
    };

    return cloneElement(actionableChild, {
      disabled: disabled || childDisabled || isEnableTradingLoading,
      loading: childLoading || isEnableTradingLoading,
      onPress: handleGuardedAction,
    });
  }, [actionableChild, disabled, enableTrading, isEnableTradingLoading]);

  if (renderMode === 'selectAccountLoading') {
    return (
      <Button
        variant="primary"
        size="medium"
        disabled
        testID="perp-is-disabled-btn"
      >
        <Spinner />
      </Button>
    );
  }

  if (renderMode === 'accountNotSupport') {
    return (
      <Button
        variant="primary"
        size="medium"
        disabled
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

  if (renderMode === 'guardedChildren') {
    return renderGuardedChildren();
  }

  if (renderMode === 'enableTradingButton') {
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
