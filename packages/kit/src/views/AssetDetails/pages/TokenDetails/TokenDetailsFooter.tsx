import { memo, useMemo } from 'react';

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

function TokenDetailsFooter(props: { networkId: string }) {
  const { networkId } = props;
  const intl = useIntl();
  const { bottom } = useSafeAreaInsets();
  const { tokenMetadata } = useTokenDetailsContext();
  const navigation = useAppNavigation();

  const priceChangeColor = useMemo(() => {
    const priceChangeBN = new BigNumber(tokenMetadata?.priceChange24h ?? 0);
    if (priceChangeBN.isGreaterThan(0)) {
      return '$textSuccess';
    }
    if (priceChangeBN.isLessThan(0)) {
      return '$textCritical';
    }
    return '$textSubdued';
  }, [tokenMetadata?.priceChange24h]);

  if (networkUtils.isLightningNetworkByNetworkId(networkId)) {
    return null;
  }

  if (
    new BigNumber(tokenMetadata?.priceChange24h ?? 0).isZero() &&
    new BigNumber(tokenMetadata?.price ?? 0).isZero()
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
        onPress={() => {
          if (tokenMetadata?.coingeckoId) {
            navigation.push(EModalAssetDetailRoutes.MarketDetail, {
              token: tokenMetadata.coingeckoId,
            });
          }
        }}
        {...(tokenMetadata?.coingeckoId ? listItemPressStyle : null)}
      >
        <SizableText flex={1} size="$bodyMd">
          {intl.formatMessage({ id: ETranslations.global_market })}
        </SizableText>
        {tokenMetadata ? (
          <XStack alignItems="center" gap="$2">
            <Currency
              size="$bodyMd"
              formatter="price"
              sourceCurrency={tokenMetadata?.currency}
            >
              {tokenMetadata?.price}
            </Currency>
            <NumberSizeableText
              size="$bodyMd"
              formatter="priceChange"
              formatterOptions={{
                showPlusMinusSigns: true,
              }}
              color={priceChangeColor}
            >
              {tokenMetadata?.priceChange24h}
            </NumberSizeableText>
            {tokenMetadata.coingeckoId ? (
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
