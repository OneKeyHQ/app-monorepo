import { useIntl } from 'react-intl';

import { Divider, XStack, YStack } from '@onekeyhq/components';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { GridItem } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/GridItemV2';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

interface IUserInfoSectionProps {
  userInfo: IBorrowReserveDetail['userInfo'] | undefined;
}

export const UserInfoSection = ({ userInfo }: IUserInfoSectionProps) => {
  const intl = useIntl();

  if (!userInfo) return null;

  const walletBalance = userInfo.walletBalance;
  const suppliedBalance = userInfo.suppliedBalance;
  const borrowedBalance = userInfo.borrowedBalance;
  const availableBorrowBalance = userInfo.availableBorrowBalance;
  const labels = {
    myInfo: intl.formatMessage({ id: ETranslations.defi_my_info }),
    walletBalance: intl.formatMessage({
      id: ETranslations.global_wallet_balance,
    }),
    suppliedBalance: intl.formatMessage({
      id: ETranslations.defi_supplied_balance,
    }),
    borrowedBalance: intl.formatMessage({
      id: ETranslations.defi_borrowed_balance,
    }),
    availableToBorrow: intl.formatMessage({
      id: ETranslations.defi_available_to_borrow,
    }),
  };

  return (
    <YStack gap="$6">
      <EarnText text={{ text: labels.myInfo }} size="$headingLg" />
      <XStack flexWrap="wrap" m="$-5" p="$2">
        <GridItem
          title={{ text: labels.walletBalance }}
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
          title={{ text: labels.suppliedBalance }}
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
          title={{ text: labels.borrowedBalance }}
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
          title={{ text: labels.availableToBorrow }}
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
