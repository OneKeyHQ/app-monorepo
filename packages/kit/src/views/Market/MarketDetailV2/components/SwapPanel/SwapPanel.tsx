import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  SizableText,
  Spinner,
  Stack,
  View,
  XStack,
  YStack,
  usePageFooterSafeAreaBottom,
  usePageFooterTabBarHeight,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import {
  prepareStockSwapEntry,
  prepareTopCoinSwapEntry,
} from '@onekeyhq/kit/src/states/jotai/contexts/swap/prepareSwapProEntry';
import {
  ESwapProJumpTokenDirection,
  useSwapFromMarketJumpTokenAtom,
  useSwapProJumpTokenAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketAccountPortfolioDisplayItem } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  type IMarketDetailFooterMode,
  type IMarketMobileDetailKind,
  resolveMarketMobileTradeDestination,
} from '../../utils/marketMobileDetailKind';

import SwapPanelFooterButtons from './SwapPanelFooterButtons';

function TradeButton({
  swapToken,
  onShowSwapDialog,
  disabled,
}: {
  swapToken: ISwapToken;
  onShowSwapDialog?: (swapToken?: ISwapToken) => void;
  disabled?: boolean;
}) {
  const intl = useIntl();
  const { activeAccount, showAccountSelector } = useAccountSelectorTrigger({
    num: 0,
    showConnectWalletModalInDappMode: true,
  });
  const noAccount =
    !activeAccount?.indexedAccount?.id && !activeAccount?.account?.id;

  if (platformEnv.isWeb && noAccount) {
    return (
      <View p="$3">
        <Button
          size="large"
          variant="primary"
          // Same readiness gate as the Trade button it stands in for: this
          // branch otherwise let the account selector open before the token
          // was known, which is the one path the guard used to miss.
          disabled={disabled}
          onPress={showAccountSelector}
          testID="market-no-account-btn"
        >
          {intl.formatMessage({ id: ETranslations.global_connect })}
        </Button>
      </View>
    );
  }

  return (
    <View p="$3">
      <Button
        testID="market-no-account-btn"
        size="large"
        variant="primary"
        disabled={disabled}
        onPress={() => onShowSwapDialog?.(swapToken)}
      >
        {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
      </Button>
    </View>
  );
}

export function SwapPanel({
  swapToken,
  disableTrade,
  portfolioData,
  onShowSwapDialog,
  executionReady = true,
  footerMode = 'buy-sell',
  detailKind,
  onPerps,
  perpsDisabled,
}: {
  swapToken: ISwapToken;
  disableTrade?: boolean;
  portfolioData?: IMarketAccountPortfolioDisplayItem[];
  onShowSwapDialog?: (swapToken?: ISwapToken) => void;
  // False until the token detail confirms the token can be traded. The footer
  // keeps its place and shows the buttons disabled instead of appearing late.
  executionReady?: boolean;
  footerMode?: IMarketDetailFooterMode;
  detailKind?: IMarketMobileDetailKind;
  onPerps?: () => void;
  perpsDisabled?: boolean;
}) {
  const intl = useIntl();
  // This footer is a plain flex sibling, not a Page.Footer, so it must claim the
  // same bottom inset itself. A visible tab bar draws over the buttons, which is
  // the safety net for any missed HideTabBar request.
  const footerSafeAreaBottom = usePageFooterSafeAreaBottom();
  const tabBarHeight = usePageFooterTabBarHeight();
  const bottomInset = footerSafeAreaBottom + tabBarHeight;
  const navigation = useAppNavigation();
  const myPositionInfo = useMemo(() => {
    const positionInfo = portfolioData?.find(
      (item) =>
        (!item.networkId || item.networkId === swapToken.networkId) &&
        equalsIgnoreCase(item.tokenAddress, swapToken.contractAddress),
    );
    if (!positionInfo) {
      return {
        formattedValue: '0.00',
        formattedAmount: '0.00',
        isZero: true,
        pnl: undefined,
      };
    }
    const tokenPriceBN = new BigNumber(positionInfo?.tokenPrice || '0');
    const amountBN = new BigNumber(positionInfo?.amount || '0');
    const totalPriceBN = new BigNumber(positionInfo?.totalPrice || NaN);
    const valueBN = totalPriceBN.isFinite()
      ? totalPriceBN
      : tokenPriceBN.multipliedBy(amountBN);
    const isZero = amountBN.eq(0);
    const formattedValue = isZero ? '0.00' : valueBN.toFixed();
    const formattedAmount = isZero ? '0.00' : amountBN.toFixed();
    return {
      formattedValue,
      formattedAmount,
      isZero,
      pnl: positionInfo.pnl,
    };
  }, [portfolioData, swapToken.contractAddress, swapToken.networkId]);

  const [, setSwapProJumpTokenAtom] = useSwapProJumpTokenAtom();
  const [, setSwapFromMarketJumpToken] = useSwapFromMarketJumpTokenAtom();

  const handleTrade = useCallback(
    (direction: 'from' | 'to') => {
      // Swap needs the token's decimals; the buttons are disabled until then,
      // but Android's gesture layer can still deliver a tap.
      if (!executionReady) {
        return;
      }
      const tradeDestination = swapToken.isStock
        ? 'stock'
        : resolveMarketMobileTradeDestination(detailKind ?? 'trending');
      const swapEntry =
        tradeDestination === 'stock'
          ? prepareStockSwapEntry({ token: swapToken, direction })
          : prepareTopCoinSwapEntry({ token: swapToken, direction });
      // Focus sync can clear the pair before the Swap page paints. Re-apply it
      // after that sync, once swap networks are available.
      setSwapFromMarketJumpToken({
        token: swapToken,
        otherToken:
          direction === 'to' ? swapEntry.fromToken : swapEntry.toToken,
        type: swapEntry.swapType,
        direction,
      });
      // A pending pro intent would switch the Swap tab back to Limit.
      setSwapProJumpTokenAtom({
        token: undefined,
        direction: ESwapProJumpTokenDirection.BUY,
      });
      navigation.switchTab(ETabRoutes.Swap);
    },
    [
      detailKind,
      executionReady,
      setSwapFromMarketJumpToken,
      setSwapProJumpTokenAtom,
      swapToken,
      navigation,
    ],
  );

  const handleBuy = useCallback(() => handleTrade('to'), [handleTrade]);
  const handleSell = useCallback(() => handleTrade('from'), [handleTrade]);

  if (!swapToken) {
    return (
      <Stack
        minHeight={400}
        justifyContent="center"
        alignItems="center"
        width="full"
      >
        <Spinner />
      </Stack>
    );
  }

  if (disableTrade) {
    return null;
  }

  if (platformEnv.isNative) {
    const pnl = myPositionInfo.pnl;
    const unrealizedBN = new BigNumber(pnl?.unrealizedPnlUsd ?? 0);
    const hasPnl = pnl?.isPnlSupported && !unrealizedBN.isNaN();
    const pnlIsPositive = hasPnl && unrealizedBN.gt(0);
    const pnlIsNegative = hasPnl && unrealizedBN.lt(0);

    let pnlColor = '$textSubdued';
    if (pnlIsPositive) pnlColor = '$textSuccess';
    if (pnlIsNegative) pnlColor = '$textCritical';

    let pnlPrefix = '';
    if (pnlIsPositive) pnlPrefix = '+';
    if (pnlIsNegative) pnlPrefix = '-';

    return (
      <YStack>
        <Divider />
        <XStack
          px="$5"
          pt="$2.5"
          justifyContent="space-between"
          alignItems="center"
        >
          <XStack gap="$2" alignItems="center">
            <SizableText size="$bodySmMedium">
              {intl.formatMessage({
                id: ETranslations.dexmarket_details_myposition,
              })}
            </SizableText>
            {myPositionInfo.isZero ? (
              <Currency
                size="$bodySmMedium"
                formatter="value"
                sourceCurrency={USD_CURRENCY_ID}
              >
                0.00
              </Currency>
            ) : (
              <Currency
                size="$bodySmMedium"
                formatter="value"
                sourceCurrency={USD_CURRENCY_ID}
              >
                {myPositionInfo.formattedValue}
              </Currency>
            )}
          </XStack>
          {hasPnl ? (
            <XStack gap="$1" alignItems="center">
              <XStack alignItems="center">
                {pnlPrefix ? (
                  <SizableText size="$bodySmMedium" color={pnlColor}>
                    {pnlPrefix}
                  </SizableText>
                ) : null}
                <Currency
                  size="$bodySmMedium"
                  color={pnlColor}
                  formatter="value"
                  sourceCurrency={USD_CURRENCY_ID}
                >
                  {unrealizedBN.abs().toFixed()}
                </Currency>
              </XStack>
              <SizableText size="$bodySm" color={pnlColor}>
                {`(${pnl?.unrealizedPnlPercent ?? '0'}%)`}
              </SizableText>
            </XStack>
          ) : null}
        </XStack>
        <Stack px="$5" pb={bottomInset || '$4'} pt="$2.5">
          <SwapPanelFooterButtons
            mode={footerMode}
            onBuy={handleBuy}
            onSell={handleSell}
            onPerps={onPerps}
            tradeDisabled={!executionReady}
            perpsDisabled={perpsDisabled}
          />
        </Stack>
      </YStack>
    );
  }

  return (
    <View>
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.home,
          sceneUrl: '',
        }}
        enabledNum={[0]}
      >
        <TradeButton
          swapToken={swapToken}
          onShowSwapDialog={onShowSwapDialog}
          disabled={!executionReady}
        />
      </AccountSelectorProviderMirror>
    </View>
  );
}
