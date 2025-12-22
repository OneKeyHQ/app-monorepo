import { Divider, XStack, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

interface IUserInfoSectionProps {
  userInfo: IBorrowReserveDetail['userInfo'] | undefined;
}

export const UserInfoSection = ({ userInfo }: IUserInfoSectionProps) => {
  if (!userInfo) return null;

  const walletBalance = userInfo.walletBalance;
  const suppliedBalance = userInfo.suppliedBalance;
  const borrowedBalance = userInfo.borrowedBalance;
  const availableBorrowBalance = userInfo.availableBorrowBalance;

  return (
    <YStack gap="$6">
      <EarnText text={{ text: 'Your Info' }} size="$headingLg" />
      <XStack flexWrap="wrap" m="$-5" p="$2">
        <GridItem
          title={{ text: 'Wallet Balance' }}
          description={walletBalance?.title ?? { text: '-' }}
          descriptionComponent={
            walletBalance?.description ? (
              <EarnText
                text={walletBalance.description}
                size="$bodySm"
                color="$textSubdued"
              />
            ) : null
          }
          tooltip={walletBalance?.tooltip}
        />
        <GridItem
          title={{ text: 'Supplied Balance' }}
          description={suppliedBalance?.title ?? { text: '-' }}
          descriptionComponent={
            suppliedBalance?.description ? (
              <EarnText
                text={suppliedBalance.description}
                size="$bodySm"
                color="$textSubdued"
              />
            ) : null
          }
          tooltip={suppliedBalance?.tooltip}
        />
        <GridItem
          title={{ text: 'Borrowed Balance' }}
          description={borrowedBalance?.title ?? { text: '-' }}
          descriptionComponent={
            borrowedBalance?.description ? (
              <EarnText
                text={borrowedBalance.description}
                size="$bodySm"
                color="$textSubdued"
              />
            ) : null
          }
          tooltip={borrowedBalance?.tooltip}
        />
        <GridItem
          title={{ text: 'Available to Borrow' }}
          description={availableBorrowBalance?.title ?? { text: '-' }}
          descriptionComponent={
            availableBorrowBalance?.description ? (
              <EarnText
                text={availableBorrowBalance.description}
                size="$bodySm"
                color="$textSubdued"
              />
            ) : null
          }
          tooltip={availableBorrowBalance?.tooltip}
        />
      </XStack>
      <Divider />
    </YStack>
  );
};
