import { memo, useMemo } from 'react';

import BigNumber from 'bignumber.js';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  NumberSizeableText,
  Page,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

import { marketNavigation } from '../../../Market/marketUtils';

import { useTokenDetailsContext } from './TokenDetailsContext';

function TokenDetailsFooter() {
  const intl = useIntl();
  const { tokenMetadata } = useTokenDetailsContext();
  const [settings] = useSettingsPersistAtom();
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

  return (
    <Page.Footer>
      <Divider />
      <XStack
        px="$5"
        py="$3"
        justifyContent="space-between"
        alignItems="center"
        {...(tokenMetadata?.coingeckoId ? listItemPressStyle : null)}
        backgroundColor="$bgSubdued"
        onPress={() => {
          if (tokenMetadata?.coingeckoId) {
            void marketNavigation.pushDetailPageFromDeeplink(navigation, {
              coinGeckoId: tokenMetadata.coingeckoId,
            });
          }
        }}
      >
        <SizableText size="$bodyMd">
          {intl.formatMessage({ id: ETranslations.global_market })}
        </SizableText>
        {tokenMetadata ? (
          <XStack alignItems="center" gap="$2">
            <NumberSizeableText
              size="$bodyMd"
              formatter="price"
              formatterOptions={{
                currency: settings.currencyInfo.symbol,
              }}
            >
              {tokenMetadata?.price}
            </NumberSizeableText>
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
