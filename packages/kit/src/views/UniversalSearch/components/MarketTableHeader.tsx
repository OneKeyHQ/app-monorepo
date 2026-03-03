import { useIntl } from 'react-intl';

import { SizableText, XStack, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

export const MARKET_NAME_COLUMN_WIDTH = 160;
export const MARKET_DATA_COLUMN_WIDTH = '25%';

export function MarketTableHeader() {
  const intl = useIntl();
  const { gtMd } = useMedia();
  return (
    <XStack alignSelf="stretch" mx="$2" px="$3" py="$1.5" gap="$3" ai="center">
      <XStack w={MARKET_NAME_COLUMN_WIDTH} gap="$1" ai="center" flexShrink={0}>
        <XStack w="$8" ai="center" jc="center">
          <SizableText size="$bodySm" color="$textSubdued">
            #
          </SizableText>
        </XStack>
        <SizableText size="$bodySm" color="$textSubdued" flex={1}>
          {intl.formatMessage({ id: ETranslations.global_name }).toUpperCase()}
        </SizableText>
      </XStack>
      <XStack flex={1} minWidth={0}>
        <XStack
          w={gtMd ? MARKET_DATA_COLUMN_WIDTH : undefined}
          flex={gtMd ? undefined : 1}
          jc="flex-end"
        >
          <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
            {intl
              .formatMessage({ id: ETranslations.global_price })
              .toUpperCase()}{' '}
            / 24H
          </SizableText>
        </XStack>
        {gtMd ? (
          <XStack w={MARKET_DATA_COLUMN_WIDTH} jc="flex-end">
            <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
              {intl
                .formatMessage({ id: ETranslations.global_liquidity })
                .toUpperCase()}
            </SizableText>
          </XStack>
        ) : null}
        {gtMd ? (
          <XStack w={MARKET_DATA_COLUMN_WIDTH} jc="flex-end">
            <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
              {intl
                .formatMessage({ id: ETranslations.dexmarket_turnover })
                .toUpperCase()}
            </SizableText>
          </XStack>
        ) : null}
        {gtMd ? (
          <XStack w={MARKET_DATA_COLUMN_WIDTH} jc="flex-end">
            <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
              {intl
                .formatMessage({ id: ETranslations.dexmarket_market_cap })
                .toUpperCase()}
            </SizableText>
          </XStack>
        ) : null}
      </XStack>
    </XStack>
  );
}
