import { memo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import NumberSizeableTextWrapper from '@onekeyhq/kit/src/components/NumberSizeableTextWrapper';
import { Token } from '@onekeyhq/kit/src/components/Token';
import type { ITokenProps } from '@onekeyhq/kit/src/components/Token';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { DEFI_PORTFOLIO_DETAIL_COLUMN_NAME_COLOR } from './defiPortfolioDetailStyleUtils';
import { ProtocolValueCell } from './ProtocolValueCell';
import { isProtocolAssetValueUnavailable } from './protocolValueUtils';

import type { ILocalizedProtocolPositionSection } from '../../utils/defiPositionUtils';

const ProtocolPositionSection = memo(
  ({
    itemKeyPrefix,
    section,
    currencySymbol,
    priceUnavailableLabel,
    tokenSize = 'sm',
  }: {
    itemKeyPrefix: string;
    section: ILocalizedProtocolPositionSection;
    currencySymbol: string;
    priceUnavailableLabel: string;
    tokenSize?: ITokenProps['size'];
  }) => {
    const intl = useIntl();
    const amountLabel = intl.formatMessage({
      id: ETranslations.content__amount,
    });
    return (
      <YStack bg="$bgSubdued" borderRadius="$2" px="$3" py="$2" gap="$2">
        <XStack alignItems="center" justifyContent="space-between">
          <SizableText
            size="$bodySmMedium"
            color={DEFI_PORTFOLIO_DETAIL_COLUMN_NAME_COLOR}
          >
            {section.title}
          </SizableText>
          <SizableText size="$bodySmMedium" color="$textSubdued">
            {amountLabel}
          </SizableText>
        </XStack>
        {section.assets.map((asset, assetIndex) => {
          const tokenLabel = (
            <XStack alignItems="center" gap="$2" flex={1} minWidth={0}>
              <Token
                size={tokenSize}
                tokenImageUri={asset.meta?.logoUrl}
                bg="$bgStrong"
              />
              <SizableText size="$bodyMdMedium" numberOfLines={1} flex={1}>
                {asset.symbol}
              </SizableText>
            </XStack>
          );
          const valueCell = (
            <ProtocolValueCell
              value={asset.value}
              currencySymbol={currencySymbol}
              priceUnavailableLabel={priceUnavailableLabel}
              isUnavailable={isProtocolAssetValueUnavailable(asset)}
            />
          );
          const amountText = (
            <NumberSizeableTextWrapper
              hideValue
              size="$bodyMd"
              color="$textSubdued"
              formatter="balance"
              textAlign="right"
            >
              {asset.amount}
            </NumberSizeableTextWrapper>
          );
          return (
            <YStack
              key={`${itemKeyPrefix}-${section.key}-${asset.address}-${assetIndex}`}
              gap="$1"
            >
              <XStack alignItems="center" gap="$3" minHeight={44}>
                {tokenLabel}
                <YStack alignItems="flex-end" minWidth={0} flexShrink={1}>
                  {valueCell}
                  {amountText}
                </YStack>
              </XStack>
            </YStack>
          );
        })}
      </YStack>
    );
  },
);
ProtocolPositionSection.displayName = 'ProtocolPositionSection';

export { ProtocolPositionSection };
