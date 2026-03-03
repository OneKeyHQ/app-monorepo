import { useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  NumberSizeableText,
  SizableText,
  Spinner,
  Stack,
  View,
  XStack,
  YStack,
  useMedia,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorTrigger } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorTrigger';
import { useCurrency } from '@onekeyhq/kit/src/components/Currency';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import {
  ESwapProJumpTokenDirection,
  useSwapProJumpTokenAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms/swap';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { equalsIgnoreCase } from '@onekeyhq/shared/src/utils/stringUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IMarketAccountPortfolioItem } from '@onekeyhq/shared/types/marketV2';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { MarketWatchListProviderMirrorV2 } from '../../../MarketWatchListProviderMirrorV2';

import SwapPanelFooterButtons from './SwapPanelFooterButtons';
import { SwapPanelWrap } from './SwapPanelWrap';

function LgTradeButton({
  swapToken,
  onShowSwapDialog,
}: {
  swapToken: ISwapToken;
  onShowSwapDialog?: (swapToken?: ISwapToken) => void;
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
        <Button size="large" variant="primary" onPress={showAccountSelector}>
          {intl.formatMessage({ id: ETranslations.global_connect })}
        </Button>
      </View>
    );
  }

  return (
    <View p="$3">
      <Button
        size="large"
        variant="primary"
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
}: {
  swapToken: ISwapToken;
  disableTrade?: boolean;
  portfolioData?: IMarketAccountPortfolioItem[];
  onShowSwapDialog?: (swapToken?: ISwapToken) => void;
}) {
  const intl = useIntl();
  const media = useMedia();
  const { bottom } = useSafeAreaInsets();
  const currencyInfo = useCurrency();
  const navigation = useAppNavigation();
  const myPositionInfo = useMemo(() => {
    const positionInfo = portfolioData?.find((item) =>
      equalsIgnoreCase(item.tokenAddress, swapToken.contractAddress),
    );
    if (!positionInfo) {
      return {
        formattedValue: '0.00',
        formattedAmount: '0.00',
        isZero: true,
      };
    }
    const tokenPriceBN = new BigNumber(positionInfo?.tokenPrice || '0');
    const amountBN = new BigNumber(positionInfo?.amount || '0');
    const valueBN = tokenPriceBN.multipliedBy(amountBN);
    const isZero = amountBN.eq(0);
    const formattedValue = isZero ? '0.00' : valueBN.toFixed();
    const formattedAmount = isZero ? '0.00' : amountBN.toFixed();
    return {
      formattedValue,
      formattedAmount,
      isZero,
    };
  }, [portfolioData, swapToken.contractAddress]);

  const [, setSwapProJumpTokenAtom] = useSwapProJumpTokenAtom();

  const handleTrade = useCallback(() => {
    setSwapProJumpTokenAtom({
      token: swapToken,
      direction: ESwapProJumpTokenDirection.BUY,
    });
    navigation.pop();
    navigation.switchTab(ETabRoutes.Swap);
  }, [setSwapProJumpTokenAtom, swapToken, navigation]);

  const handleInstant = useCallback(() => {
    onShowSwapDialog?.(swapToken);
  }, [onShowSwapDialog, swapToken]);

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
    return (
      <YStack>
        <Divider />
        <XStack
          px="$5"
          py="$2"
          justifyContent="space-between"
          alignItems="center"
        >
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.dexmarket_details_myposition,
            })}
          </SizableText>
          <XStack gap="$1" alignItems="baseline">
            {myPositionInfo.isZero ? (
              <SizableText size="$bodySmMedium">0.00</SizableText>
            ) : (
              <NumberSizeableText
                size="$bodySmMedium"
                formatter="balance"
                formatterOptions={{ tokenSymbol: '' }}
              >
                {myPositionInfo.formattedAmount}
              </NumberSizeableText>
            )}
            {myPositionInfo.isZero ? (
              <SizableText size="$bodySm" color="$textSubdued">
                ({currencyInfo.symbol}0.00)
              </SizableText>
            ) : (
              <XStack alignItems="baseline">
                <SizableText size="$bodySm" color="$textSubdued">
                  (
                </SizableText>
                <NumberSizeableText
                  size="$bodySm"
                  color="$textSubdued"
                  formatter="value"
                  formatterOptions={{
                    currency: currencyInfo.symbol,
                  }}
                >
                  {myPositionInfo.formattedValue}
                </NumberSizeableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  )
                </SizableText>
              </XStack>
            )}
          </XStack>
        </XStack>
        <Stack px="$5" pb={bottom || '$4'} pt="$2">
          <SwapPanelFooterButtons
            onTrade={handleTrade}
            onInstant={handleInstant}
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
        {media.lg ? (
          <LgTradeButton
            swapToken={swapToken}
            onShowSwapDialog={onShowSwapDialog}
          />
        ) : (
          <MarketWatchListProviderMirrorV2
            storeName={EJotaiContextStoreNames.marketWatchListV2}
          >
            <SwapPanelWrap />
          </MarketWatchListProviderMirrorV2>
        )}
      </AccountSelectorProviderMirror>
    </View>
  );
}
