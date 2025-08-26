import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import { Button, useMedia } from '@onekeyhq/components';
import type { IButtonProps } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes, EOnboardingPages } from '@onekeyhq/shared/src/routes';
import { numberFormat } from '@onekeyhq/shared/src/utils/numberUtils';

import { useTokenDetail } from '../../../hooks/useTokenDetail';
import { usePaymentTokenPrice } from '../hooks/usePaymentTokenPrice';
import { ESwapDirection, type ITradeType } from '../hooks/useTradeType';

import type { IToken } from '../types';
import type { GestureResponderEvent } from 'react-native';

export interface IActionButtonProps extends IButtonProps {
  tradeType: ITradeType;
  amount: string;
  token?: {
    symbol: string;
  };
  balance?: BigNumber;
  paymentToken?: IToken;
  networkId?: string;
  isWrapped?: boolean;
}

export function ActionButton({
  tradeType,
  amount,
  token,
  balance,
  disabled,
  onPress,
  isWrapped,
  paymentToken,
  networkId,
  ...otherProps
}: IActionButtonProps) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const { tokenDetail } = useTokenDetail();
  const [settingsValue] = useSettingsPersistAtom();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const navigation = useAppNavigation();
  const { createAddress } = useAccountSelectorCreateAddress();
  // Get payment token price for buy orders
  const { price: paymentTokenPrice } = usePaymentTokenPrice(
    tradeType === ESwapDirection.BUY ? paymentToken : undefined,
    networkId,
  );
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

    if (tradeType === ESwapDirection.BUY && paymentTokenPrice) {
      // For buy orders: payment amount × payment token price
      return amountBN.multipliedBy(paymentTokenPrice).toNumber();
    }

    if (tradeType === ESwapDirection.SELL && tokenDetail?.price) {
      // For sell orders: target token amount × target token price
      return amountBN.multipliedBy(tokenDetail.price).toNumber();
    }

    return undefined;
  }, [
    tradeType,
    tokenDetail?.price,
    paymentTokenPrice,
    amount,
    isValidAmount,
    amountBN,
  ]);

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
      } catch (e) {
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
  const displayAmountFormatted = numberFormat(displayAmount, {
    formatter: 'balance',
    formatterOptions: {
      tokenSymbol: token?.symbol || '',
    },
  });

  let buttonText = `${actionText} ${displayAmountFormatted as string} `;
  if (typeof totalValue === 'number') {
    buttonText += `(${
      numberFormat(totalValue.toFixed(2), {
        formatter: 'value',
        formatterOptions: {
          currency: settingsValue.currencyInfo.symbol,
        },
      }) as string
    })`;
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
  const shouldUseColoredStyle = hasAmount && !shouldDisable && !noAccount;

  const buttonStyleProps = shouldUseColoredStyle
    ? {
        bg:
          tradeType === ESwapDirection.BUY
            ? '$buttonSuccess'
            : '$buttonCritical',
        color: '$textOnColor',
        borderWidth: 0,
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
      if (noAccount) {
        navigation.pushModal(EModalRoutes.OnboardingModal, {
          screen: EOnboardingPages.GetStarted,
        });
        return;
      }
      if (shouldCreateAddress?.result) {
        setCreateAddressLoading(true);
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
        setCreateAddressLoading(false);
        return;
      }
      onPress?.(event);
    },
    [
      networkId,
      noAccount,
      shouldCreateAddress,
      onPress,
      navigation,
      createAddress,
      activeAccount?.wallet?.id,
      activeAccount?.indexedAccount?.id,
      activeAccount?.deriveType,
    ],
  );

  return (
    <Button
      size={gtMd ? 'medium' : 'large'}
      disabled={Boolean(
        (shouldDisable || disabled || !hasAmount) &&
          !shouldCreateAddress?.result &&
          !noAccount,
      )}
      onPress={shouldDisable ? undefined : handlePress}
      loading={createAddressLoading || otherProps.loading}
      {...otherProps}
      {...buttonStyleProps}
    >
      {buttonText}
    </Button>
  );
}
