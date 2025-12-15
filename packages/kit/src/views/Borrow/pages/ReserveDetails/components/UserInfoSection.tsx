import { Divider, XStack, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

interface IUserInfoSectionProps {
  userInfo: IBorrowReserveDetail['userInfo'] | undefined;
}

export const UserInfoSection = ({ userInfo }: IUserInfoSectionProps) => {
  if (!userInfo) return null;

  return (
    <YStack gap="$6">
      <EarnText text={{ text: 'Your Info' }} size="$headingLg" />
      <XStack flexWrap="wrap" m="$-5" p="$2">
        <GridItem
          title={{ text: 'Wallet Balance' }}
          description={{ text: userInfo.walletBalance ?? '-' }}
        />
        <GridItem
          title={{ text: 'Supplied Balance' }}
          description={{ text: userInfo.suppliedBalance ?? '-' }}
        />
        <GridItem
          title={{ text: 'Borrowed Balance' }}
          description={{ text: userInfo.borrowedBalance ?? '-' }}
        />
        <GridItem
          title={{ text: 'Available to Borrow' }}
          description={{ text: userInfo.availableBorrowBalance ?? '-' }}
        />
      </XStack>
      <Divider />
    </YStack>
  );
};
