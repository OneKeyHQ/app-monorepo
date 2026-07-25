import { memo, useCallback, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import {
  Icon,
  NumberSizeableText,
  Page,
  SizableText,
  Skeleton,
  XStack,
  useSafeAreaInsets,
} from '@onekeyhq/components';
import { Currency } from '@onekeyhq/kit/src/components/Currency';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalAssetDetailRoutes } from '@onekeyhq/shared/src/routes';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';

import { AssetDetailsTestIDs } from '../../testIDs';

import { useTokenDetailsContext } from './TokenDetailsContext';
import {
  buildTokenDetailsMarketNavigationTarget,
  isTokenDetailsMarketMetadataForToken,
} from './tokenDetailsMarketNavigation';

function TokenDetailsFooter(props: {
  isNative?: boolean;
  networkId: string;
  networkName?: string;
  symbol?: string;
  tokenAddress?: string;
  tokenImageUri?: string;
}) {
  const {
    isNative,
    networkId,
    networkName,
    symbol,
    tokenAddress,
    tokenImageUri,
  } = props;
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { tokenMetadata } = useTokenDetailsContext();
  const navigation = useAppNavigation();

  const marketNavigationTarget = useMemo(
    () =>
      buildTokenDetailsMarketNavigationTarget({
        isNative,
        networkId,
        networkName,
        symbol,
        tokenAddress,
        tokenImageUri,
        tokenMetadata,
      }),
    [
      isNative,
      networkId,
      networkName,
      symbol,
      tokenAddress,
      tokenImageUri,
      tokenMetadata,
    ],
  );
  const matchedTokenMetadata = isTokenDetailsMarketMetadataForToken({
    networkId,
    tokenAddress,
    tokenMetadata,
  })
    ? tokenMetadata
    : undefined;

  const handleMarketPress = useCallback(() => {
    if (marketNavigationTarget?.type === 'detail') {
      navigation.push(EModalAssetDetailRoutes.MarketDetail, {
        token: marketNavigationTarget.token,
      });
    } else if (marketNavigationTarget?.type === 'chart') {
      navigation.push(EModalAssetDetailRoutes.MarketChart, {
        networkId: marketNavigationTarget.networkId,
        networkName: marketNavigationTarget.networkName,
        symbol: marketNavigationTarget.symbol,
        tokenAddress: marketNavigationTarget.tokenAddress,
        tokenImageUri: marketNavigationTarget.tokenImageUri,
      });
    }
  }, [marketNavigationTarget, navigation]);

  const priceChangeColor = useMemo(() => {
    const priceChangeBN = new BigNumber(
      matchedTokenMetadata?.priceChange24h ?? 0,
    );
    if (priceChangeBN.isGreaterThan(0)) {
      return '$textSuccess';
    }
    if (priceChangeBN.isLessThan(0)) {
      return '$textCritical';
    }
    return '$textSubdued';
  }, [matchedTokenMetadata?.priceChange24h]);

  if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
    return null;
  }

  if (
    new BigNumber(matchedTokenMetadata?.priceChange24h ?? 0).isZero() &&
    new BigNumber(matchedTokenMetadata?.price ?? 0).isZero()
  ) {
    return null;
  }

  return (
    <Page.Footer>
      <XStack
        testID={AssetDetailsTestIDs.marketFooter}
        alignItems="center"
        px="$5"
        pt="$3"
        pb={bottom || '$3'}
        backgroundColor="$bgSubdued"
        borderTopWidth={StyleSheet.hairlineWidth}
        borderTopColor="$borderSubdued"
        userSelect="none"
        onPress={marketNavigationTarget ? handleMarketPress : undefined}
        {...(marketNavigationTarget ? listItemPressStyle : null)}
      >
        <SizableText flex={1} size="$bodyMd">
          {intl.formatMessage({ id: ETranslations.global_market })}
        </SizableText>
        {matchedTokenMetadata ? (
          <XStack alignItems="center" gap="$2">
            <Currency
              size="$bodyMd"
              formatter="price"
              sourceCurrency={matchedTokenMetadata.currency}
            >
              {matchedTokenMetadata.price}
            </Currency>
            <NumberSizeableText
              size="$bodyMd"
              formatter="priceChange"
              formatterOptions={{
                showPlusMinusSigns: true,
              }}
              color={priceChangeColor}
            >
              {matchedTokenMetadata.priceChange24h}
            </NumberSizeableText>
            {marketNavigationTarget ? (
              <Icon name="ChevronRightSmallOutline" color="$iconSubdued" />
            ) : null}
          </XStack>
        ) : (
          <Skeleton.BodyMd />
        )}
      </XStack>
    </Page.Footer>
  );
}

export default memo(TokenDetailsFooter);
