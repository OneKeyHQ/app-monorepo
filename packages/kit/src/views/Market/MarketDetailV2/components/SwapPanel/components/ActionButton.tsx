import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, resetToRoute, useMedia } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  EModalSwapRoutes,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
} from '@onekeyhq/shared/src/routes';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import {
  ESwapSource,
  ESwapTabSwitchType,
} from '@onekeyhq/shared/types/swap/types';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { ESwapDirection, type ITradeType } from '../hooks/useTradeType';

import type { IToken } from '../types';
import type { GestureResponderEvent } from 'react-native';

export interface IActionButtonProps extends IButtonProps {
  tradeType: ITradeType;
  supportSpeedSwap?: boolean;
  amount: string;
  token?: IToken;
  balance?: BigNumber;
  networkId?: string;
  isWrapped?: boolean;
  actionToken?: ISwapToken;
  actionOtherToken?: ISwapToken;
  onlySupportCrossChain?: boolean;
  onSwapAction?: () => void;
}

export function ActionButton({
  tradeType,
  amount,
  token,
  balance,
  supportSpeedSwap,
  disabled,
  onPress,
  isWrapped,
  actionOtherToken,
  networkId,
  onlySupportCrossChain,
  actionToken,
  onSwapAction,
  ...otherProps
}: IActionButtonProps) {
  const [hasClickedWithoutAmount, setHasClickedWithoutAmount] = useState(false);
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { tokenDetail } = useTokenDetail();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();
  const { createAddress } = useAccountSelectorCreateAddress();
  const { showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });
  const [createAddressLoading, setCreateAddressLoading] = useState(false);
  const actionText =
    tradeType === ESwapDirection.BUY
      ? intl.formatMessage({ id: ETranslations.global_buy })
      : intl.formatMessage({ id: ETranslations.global_sell });

  const amountBN = useMemo(() => new BigNumber(amount || 0), [amount]);
  const isValidAmount = amountBN.isFinite() && !amountBN.isNaN();
  const displayAmount = isValidAmount ? amount : '';

  const totalValue = useMemo(() => {
    if (!amount || !isValidAmount || amountBN.lte(0)) {
      return undefined;
    }

    return amountBN.multipliedBy(new BigNumber(token?.price || '0')).toNumber();
  }, [token?.price, amount, isValidAmount, amountBN]);

  const handleJumpToSwapAction = useCallback(() => {
    navigation.pushModal(EModalRoutes.SwapModal, {
      screen: EModalSwapRoutes.SwapMainLand,
      params: {
        fromAmount: isValidAmount ? amount : '',
        importToToken:
          tradeType === ESwapDirection.BUY ? actionToken : actionOtherToken,
        importFromToken:
          tradeType === ESwapDirection.BUY ? actionOtherToken : actionToken,
        swapTabSwitchType: onlySupportCrossChain
          ? ESwapTabSwitchType.BRIDGE
          : ESwapTabSwitchType.SWAP,
        swapSource: ESwapSource.MARKET,
      },
    });
  }, [
    isValidAmount,
    amount,
    onlySupportCrossChain,
    actionToken,
    actionOtherToken,
    tradeType,
    navigation,
  ]);

  // Truncate symbol if it exceeds 20 characters
  const truncatedSymbol = useMemo(() => {
    const symbol = token?.symbol || '';
    if (symbol.length > 20) {
      return `${symbol.slice(0, 17)}...`;
    }
    return symbol;
  }, [token?.symbol]);

  // Truncate tokenDetail symbol if it exceeds 20 characters
  const truncatedTokenDetailSymbol = useMemo(() => {
    const symbol = tokenDetail?.symbol || '';
    if (symbol.length > 20) {
      return `${symbol.slice(0, 17)}...`;
    }
    return symbol;
  }, [tokenDetail?.symbol]);

  const tokenFormatter: INumberFormatProps = useMemo(() => {
    return {
      formatter: 'balance',
      formatterOptions: {
        tokenSymbol: truncatedSymbol,
      },
    };
  }, [truncatedSymbol]);

  const currencyFormatter: INumberFormatProps = useMemo(() => {
    return {
      formatter: 'value',
      formatterOptions: {
        currency: '$',
      },
    };
  }, []);

  const shouldCreateAddress = usePromiseResult(async () => {
    let result = false;
    if (activeAccount?.canCreateAddress && !createAddressLoading) {
      try {
        const networkAccount =
          await backgroundApiProxy.serviceAccount.getNetworkAccount({
            networkId: networkId ?? '',
            accountId: activeAccount?.indexedAccount?.id
              ? undefined
              : activeAccount?.account?.id,
            indexedAccountId: activeAccount?.indexedAccount?.id,
            deriveType: activeAccount?.deriveType ?? 'default',
          });
        if (!networkAccount.address && activeAccount?.canCreateAddress) {
          result = true;
        }
      } catch (_e) {
        result = Boolean(activeAccount?.canCreateAddress);
      }
    }
    return result;
  }, [
    networkId,
    createAddressLoading,
    activeAccount?.account?.id,
    activeAccount?.canCreateAddress,
    activeAccount?.deriveType,
    activeAccount?.indexedAccount?.id,
  ]);

  // Check for insufficient balance for both buy and sell operations
  const hasAmount = amountBN.gt(0);
  const isInsufficientBalance = balance && hasAmount && amountBN.gt(balance);

  const noAccount =
    !activeAccount?.indexedAccount?.id && !activeAccount?.account?.id;

  // Disable button if insufficient balance
  const shouldDisable = isInsufficientBalance;
  const displayAmountFormatted = numberFormat(displayAmount, tokenFormatter);

  let buttonText = `${actionText} ${displayAmountFormatted} `;
  if (typeof totalValue === 'number') {
    buttonText += `(${numberFormat(totalValue.toFixed(2), currencyFormatter)})`;
  }

  if (isWrapped) {
    buttonText = intl.formatMessage({
      id: ETranslations.swap_page_button_wrap,
    });
  }

  if (shouldDisable) {
    buttonText = intl.formatMessage({
      id: ETranslations.swap_page_button_insufficient_balance,
    });
  }

  if (!hasAmount) {
    buttonText = intl.formatMessage({
      id: ETranslations.swap_page_button_enter_amount,
    });
  }

  if (shouldCreateAddress?.result || createAddressLoading) {
    buttonText = intl.formatMessage({
      id: ETranslations.global_create_address,
    });
  }

  if (noAccount) {
    buttonText = intl.formatMessage({
      id: ETranslations.swap_page_button_no_connected_wallet,
    });
  }
  // Use colored style only for normal trading states (has amount, not disabled, has account)
  let shouldUseColoredStyle =
    hasAmount && !shouldDisable && !noAccount && !disabled;

  let isButtonDisabled = Boolean(
    (shouldDisable || disabled || !hasAmount) &&
    !shouldCreateAddress?.result &&
    !noAccount,
  );

  if (!hasAmount && !hasClickedWithoutAmount) {
    shouldUseColoredStyle = true;
    buttonText = `${actionText} ${truncatedTokenDetailSymbol}`.trim();
    isButtonDisabled = false;
  }

  if (!supportSpeedSwap) {
    shouldUseColoredStyle = true;
  }

  if (platformEnv.isWeb && noAccount) {
    buttonText = intl.formatMessage({ id: ETranslations.global_connect });
    shouldUseColoredStyle = false;
    isButtonDisabled = false;
  }

  const buttonStyleProps = shouldUseColoredStyle
    ? {
        bg:
          tradeType === ESwapDirection.BUY
            ? '$buttonSuccess'
            : '$buttonCritical',
        color: '$textOnColor',
        borderColor:
          tradeType === ESwapDirection.BUY
            ? '$buttonSuccess'
            : '$buttonCritical',
        shadowOpacity: 0,
        elevation: 0,
        hoverStyle: {
          opacity: 0.9,
        },
        pressStyle: {
          opacity: 0.8,
        },
      }
    : {
        variant: 'primary' as const,
      };

  const handlePress = useCallback(
    async (event: GestureResponderEvent) => {
      if (platformEnv.isWeb && noAccount) {
        showAccountSelector();
        return;
      }
      if (!supportSpeedSwap) {
        handleJumpToSwapAction();
        return;
      }
      setHasClickedWithoutAmount(true);
      if (!hasAmount && !hasClickedWithoutAmount) {
        return;
      }
      if (noAccount) {
        resetToRoute(ERootRoutes.Onboarding, {
          screen: EOnboardingV2Routes.OnboardingV2,
          params: {
            screen: EOnboardingPagesV2.GetStarted,
          },
        });
        return;
      }
      if (shouldCreateAddress?.result) {
        setCreateAddressLoading(true);
        try {
          await createAddress({
            num: 0,
            selectAfterCreate: false,
            account: {
              walletId: activeAccount?.wallet?.id,
              networkId: networkId ?? '',
              indexedAccountId: activeAccount?.indexedAccount?.id,
              deriveType: activeAccount?.deriveType ?? 'default',
            },
          });
        } catch (e) {
          console.error('Create address failed:', e);
        } finally {
          setCreateAddressLoading(false);
        }
        return;
      }

      // Log swap action before executing - with error protection
      try {
        onSwapAction?.();
      } catch (analyticsError) {
        // Don't let analytics errors block the swap action
        console.warn('Analytics logging failed:', analyticsError);
      }

      onPress?.(event);
    },
    [
      supportSpeedSwap,
      hasAmount,
      hasClickedWithoutAmount,
      noAccount,
      shouldCreateAddress?.result,
      onPress,
      handleJumpToSwapAction,
      showAccountSelector,
      createAddress,
      activeAccount?.wallet?.id,
      activeAccount?.indexedAccount?.id,
      activeAccount?.deriveType,
      networkId,
      onSwapAction,
    ],
  );

  return (
    <Button
      size={gtMd ? 'medium' : 'large'}
      disabled={isButtonDisabled}
      onPress={handlePress}
      loading={createAddressLoading || otherProps.loading}
      {...otherProps}
      {...buttonStyleProps}
    >
      {buttonText}
    </Button>
  );
}
