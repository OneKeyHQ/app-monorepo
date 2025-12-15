import { IconButton, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

interface IReserveProtocolHeaderProps {
  symbol: string;
  logoURI?: string;
  onShare?: () => void;
  oraclePrice?: string;
  reserveSize?: string;
  availableLiquidity?: string;
  utilizationRatio?: string;
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
}: IReserveProtocolHeaderProps) => (
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
              Oracle Price:
            </SizableText>
            <SizableText size="$bodySmMedium">{oraclePrice}</SizableText>
          </XStack>
        ) : null}
      </XStack>
      <XStack gap="$6" mt="$5">
        {reserveSize ? (
          <YStack gap="$1" jc="center">
            <HeaderField title="Reserve Size:" description={reserveSize} />
          </YStack>
        ) : null}
        {availableLiquidity ? (
          <YStack gap="$1" jc="center">
            <HeaderField
              title="Available Liquidity:"
              description={availableLiquidity}
            />
          </YStack>
        ) : null}
        {utilizationRatio ? (
          <YStack gap="$1" jc="center">
            <HeaderField
              title="Utilization Ratio:"
              description={utilizationRatio}
            />
          </YStack>
        ) : null}
      </XStack>
    </YStack>
  </YStack>
);
