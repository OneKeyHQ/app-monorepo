import { useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  NumberSizeableText,
  SizableText,
  Skeleton,
  Spinner,
  Stack,
  View,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
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

import { SwapPanelWrap } from './SwapPanelWrap';

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
      };
    }
    const tokenPriceBN = new BigNumber(positionInfo?.tokenPrice || '0');
    const amountBN = new BigNumber(positionInfo?.amount || '0');
    const valueBN = tokenPriceBN.multipliedBy(amountBN);
    const formattedValue = valueBN.toFixed();
    const formattedAmount = amountBN.toFixed();
    return {
      formattedValue,
      formattedAmount,
    };
  }, [portfolioData, swapToken.contractAddress]);

  const [, setSwapProJumpTokenAtom] = useSwapProJumpTokenAtom();
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

  if (platformEnv.isNative) {
    if (disableTrade) {
      return null;
    }
    return (
      <YStack>
        <Divider />
        <XStack py="$4" px="$5" justifyContent="space-between">
          <YStack gap="$0.5">
            {myPositionInfo ? (
              <>
                <SizableText size="$bodySmMedium" color="$textSubdued">
                  {intl.formatMessage({
                    id: ETranslations.dexmarket_details_myposition,
                  })}
                </SizableText>
                <NumberSizeableText size="$bodySmMedium" formatter="balance">
                  {myPositionInfo.formattedAmount}
                </NumberSizeableText>
                <NumberSizeableText
                  size="$bodySm"
                  color="$textSubdued"
                  formatter="value"
                  formatterOptions={{ currency: currencyInfo.symbol }}
                >
                  {myPositionInfo.formattedValue}
                </NumberSizeableText>
              </>
            ) : null}
          </YStack>
          <XStack gap="$2" alignItems="center">
            <Button
              size="small"
              variant="primary"
              w="$28"
              h="$12"
              bg="$buttonSuccess"
              onPress={() => {
                setSwapProJumpTokenAtom({
                  token: swapToken,
                  direction: ESwapProJumpTokenDirection.BUY,
                });
                navigation.pop();
                navigation.switchTab(ETabRoutes.Swap);
              }}
            >
              {intl.formatMessage({
                id: ETranslations.global_buy,
              })}
            </Button>
            <Button
              w="$28"
              h="$12"
              size="small"
              bg="$buttonCritical"
              variant="primary"
              onPress={() => {
                setSwapProJumpTokenAtom({
                  token: swapToken,
                  direction: ESwapProJumpTokenDirection.SELL,
                });
                navigation.pop();
                navigation.switchTab(ETabRoutes.Swap);
              }}
            >
              {intl.formatMessage({
                id: ETranslations.global_sell,
              })}
            </Button>
          </XStack>
        </XStack>
      </YStack>
    );
  }

  if (media.lg) {
    return (
      <View p="$3">
        <Button
          size="large"
          variant="primary"
          onPress={() => onShowSwapDialog?.()}
        >
          {intl.formatMessage({ id: ETranslations.dexmarket_details_trade })}
        </Button>
      </View>
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
        <MarketWatchListProviderMirrorV2
          storeName={EJotaiContextStoreNames.marketWatchListV2}
        >
          <SwapPanelWrap />
        </MarketWatchListProviderMirrorV2>
      </AccountSelectorProviderMirror>
    </View>
  );
}
