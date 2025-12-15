import { Divider, XStack, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

interface IReserveInfoSectionProps {
  details: IBorrowReserveDetail | undefined;
}

export const ReserveInfoSection = ({ details }: IReserveInfoSectionProps) => {
  if (!details) return null;

  return (
    <YStack gap="$6">
      <EarnText text={{ text: 'Reserve Info' }} size="$headingLg" />
      <XStack flexWrap="wrap" m="$-5" p="$2">
        <GridItem
          title={{ text: 'Reserve Size' }}
          description={{ text: details.reserveSize ?? '-' }}
        />
        <GridItem
          title={{ text: 'Utilization Ratio' }}
          description={{ text: details.utilizationRatio ?? '-' }}
        />
        <GridItem
          title={{ text: 'Available Liquidity' }}
          description={{ text: details.liquidity ?? '-' }}
        />
        <GridItem
          title={{ text: 'Oracle Price' }}
          description={{ text: details.oraclePrice ?? '-' }}
        />
      </XStack>
      <Divider />
    </YStack>
  );
};
