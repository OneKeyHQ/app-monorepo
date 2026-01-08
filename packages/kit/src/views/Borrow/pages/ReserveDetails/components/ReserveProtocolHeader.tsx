import { Fragment } from 'react';

import { useIntl } from 'react-intl';

import {
  IconButton,
  Image,
  SizableText,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { PlatformBonusSection } from './PlatformBonusSection';

interface IReserveProtocolHeaderProps {
  symbol: string;
  logoURI?: string;
  onShare?: () => void;
  oraclePrice?: string;
  reserveSize?: string;
  availableLiquidity?: string;
  utilizationRatio?: string;
  platformBonus?: IBorrowReserveDetail['platformBonus'];
  managers?: IBorrowReserveDetail['managers'];
}

const HeaderField = ({
  title,
  description,
}: {
  title: React.ReactNode;
  description: React.ReactNode;
}) => {
  return (
    <YStack gap="$1" jc="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        {title}
      </SizableText>
      <SizableText size="$bodyLgMedium">{description}</SizableText>
    </YStack>
  );
};

export const ReserveProtocolHeader = ({
  symbol,
  logoURI,
  onShare,
  oraclePrice,
  reserveSize,
  availableLiquidity,
  utilizationRatio,
  platformBonus,
  managers,
}: IReserveProtocolHeaderProps) => {
  const intl = useIntl();
  const { gtMd } = useMedia();

  const labels = {
    oraclePrice: intl.formatMessage({
      id: ETranslations.defi_oracle_price,
    }),
    reserveSize: intl.formatMessage({
      id: ETranslations.defi_reserve_size,
    }),
    availableLiquidity: intl.formatMessage({
      id: ETranslations.defi_available_liquidity,
    }),
    utilizationRatio: intl.formatMessage({
      id: ETranslations.defi_utilization_ratio,
    }),
  };

  // Mobile layout: managers section, large token/symbol, 2x2 stats grid
  if (!gtMd) {
    return (
      <YStack>
        <YStack jc="center">
          {managers?.items?.length ? (
            <XStack gap="$1" ai="center" mb="$6" flexWrap="wrap">
              {managers.items.map((item, index) => (
                <Fragment key={index}>
                  <XStack gap="$1" ai="center">
                    <Image
                      size="$4"
                      borderRadius="$1"
                      source={{ uri: item.logoURI }}
                    />
                    <EarnText text={item.title} size="$bodySm" />
                    <EarnText text={item.description} size="$bodySm" />
                  </XStack>
                  {/* Separator dot - don't show after last item */}
                  {index !== managers.items.length - 1 ? (
                    <XStack w="$4" h="$4" ai="center" jc="center">
                      <XStack
                        w="$1"
                        h="$1"
                        borderRadius="$full"
                        bg="$iconSubdued"
                      />
                    </XStack>
                  ) : null}
                </Fragment>
              ))}
            </XStack>
          ) : null}
          {/* Token icon + Symbol (large) */}
          <XStack gap="$2" ai="center" mb="$6">
            <Token size="lg" tokenImageUri={logoURI} />
            <SizableText size="$heading2xl">{symbol}</SizableText>
          </XStack>
          {/* Statistics grid (2x2 layout) */}
          <YStack gap="$6" mb="$6">
            {/* Row 1: Reserve size | Available liquidity */}
            <XStack>
              {reserveSize ? (
                <YStack flex={1}>
                  <HeaderField
                    title={labels.reserveSize}
                    description={reserveSize}
                  />
                </YStack>
              ) : null}
              {availableLiquidity ? (
                <YStack flex={1}>
                  <HeaderField
                    title={labels.availableLiquidity}
                    description={availableLiquidity}
                  />
                </YStack>
              ) : null}
            </XStack>
            {/* Row 2: Utilization ratio | Oracle price */}
            <XStack>
              {utilizationRatio ? (
                <YStack flex={1}>
                  <HeaderField
                    title={labels.utilizationRatio}
                    description={utilizationRatio}
                  />
                </YStack>
              ) : null}
              {oraclePrice ? (
                <YStack flex={1}>
                  <HeaderField
                    title={labels.oraclePrice}
                    description={oraclePrice}
                  />
                </YStack>
              ) : null}
            </XStack>
          </YStack>
          <PlatformBonusSection platformBonus={platformBonus} />
        </YStack>
      </YStack>
    );
  }

  // Desktop layout: inline token/symbol with share button, horizontal stats
  return (
    <YStack>
      <YStack jc="center">
        <XStack gap="$2" ai="center">
          <Token size="xs" tokenImageUri={logoURI} />
          <SizableText size="$bodyLgMedium">{symbol}</SizableText>
          {onShare ? (
            <IconButton
              icon="ShareOutline"
              size="small"
              variant="tertiary"
              iconColor="$iconSubdued"
              onPress={onShare}
            />
          ) : null}
          {oraclePrice ? (
            <XStack ml="$1" gap="$1" ai="center">
              <SizableText size="$bodySm" color="$textSubdued">
                {`${labels.oraclePrice}:`}
              </SizableText>
              <SizableText size="$bodySmMedium">{oraclePrice}</SizableText>
            </XStack>
          ) : null}
        </XStack>
        <XStack gap="$6" mt="$5" mb="$8">
          {reserveSize ? (
            <YStack flex={1} gap="$1" jc="center">
              <HeaderField
                title={`${labels.reserveSize}:`}
                description={reserveSize}
              />
            </YStack>
          ) : null}
          {availableLiquidity ? (
            <YStack flex={1} gap="$1" jc="center">
              <HeaderField
                title={`${labels.availableLiquidity}:`}
                description={availableLiquidity}
              />
            </YStack>
          ) : null}
          {utilizationRatio ? (
            <YStack flex={1} gap="$1" jc="center">
              <HeaderField
                title={`${labels.utilizationRatio}:`}
                description={utilizationRatio}
              />
            </YStack>
          ) : null}
        </XStack>
        <PlatformBonusSection platformBonus={platformBonus} />
      </YStack>
    </YStack>
  );
};
