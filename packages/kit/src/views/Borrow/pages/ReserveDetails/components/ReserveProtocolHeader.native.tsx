import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
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

// Native version: Token + Symbol is displayed in Page.Header (modal header)
// So we only show Oracle Price and other fields here
export const ReserveProtocolHeader = ({
  onShare,
  oraclePrice,
  reserveSize,
  availableLiquidity,
  utilizationRatio,
  platformBonus,
}: IReserveProtocolHeaderProps) => (
  <YStack>
    <YStack jc="center">
      {/* Oracle Price + Share button row */}
      <XStack gap="$2" ai="center">
        {oraclePrice ? (
          <XStack gap="$1" ai="center">
            <SizableText size="$bodySm" color="$textSubdued">
              Oracle Price:
            </SizableText>
            <SizableText size="$bodySmMedium">{oraclePrice}</SizableText>
          </XStack>
        ) : null}
        {onShare ? (
          <IconButton
            icon="ShareOutline"
            size="small"
            variant="tertiary"
            iconColor="$iconSubdued"
            onPress={onShare}
          />
        ) : null}
      </XStack>
      <XStack gap="$6" mt="$5" mb="$8">
        {reserveSize ? (
          <YStack flex={1} gap="$1" jc="center">
            <HeaderField title="Reserve Size:" description={reserveSize} />
          </YStack>
        ) : null}
        {availableLiquidity ? (
          <YStack flex={1} gap="$1" jc="center">
            <HeaderField
              title="Available Liquidity:"
              description={availableLiquidity}
            />
          </YStack>
        ) : null}
        {utilizationRatio ? (
          <YStack flex={1} gap="$1" jc="center">
            <HeaderField
              title="Utilization Ratio:"
              description={utilizationRatio}
            />
          </YStack>
        ) : null}
      </XStack>
      <PlatformBonusSection platformBonus={platformBonus} />
    </YStack>
  </YStack>
);
