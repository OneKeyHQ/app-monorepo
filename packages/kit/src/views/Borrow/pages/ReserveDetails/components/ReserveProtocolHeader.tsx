import { useIntl } from 'react-intl';

import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';
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
}: IReserveProtocolHeaderProps) => {
  const intl = useIntl();
  const labels = {
    oraclePrice: `${intl.formatMessage({
      id: ETranslations.defi_oracle_price,
    })}:`,
    reserveSize: `${intl.formatMessage({
      id: ETranslations.defi_reserve_size,
    })}:`,
    availableLiquidity: `${intl.formatMessage({
      id: ETranslations.defi_available_liquidity,
    })}:`,
    utilizationRatio: `${intl.formatMessage({
      id: ETranslations.defi_utilization_ratio,
    })}:`,
  };

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
                {labels.oraclePrice}
              </SizableText>
              <SizableText size="$bodySmMedium">{oraclePrice}</SizableText>
            </XStack>
          ) : null}
        </XStack>
        <XStack gap="$6" mt="$5" mb="$8">
          {reserveSize ? (
            <YStack flex={1} gap="$1" jc="center">
              <HeaderField
                title={labels.reserveSize}
                description={reserveSize}
              />
            </YStack>
          ) : null}
          {availableLiquidity ? (
            <YStack flex={1} gap="$1" jc="center">
              <HeaderField
                title={labels.availableLiquidity}
                description={availableLiquidity}
              />
            </YStack>
          ) : null}
          {utilizationRatio ? (
            <YStack flex={1} gap="$1" jc="center">
              <HeaderField
                title={labels.utilizationRatio}
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
