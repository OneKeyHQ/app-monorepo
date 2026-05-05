import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Divider,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import { EManagePositionType } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IBorrowReserveDetail } from '@onekeyhq/shared/types/staking';

import { BorrowNavigation } from '../../../borrowUtils';

interface IManagePositionPartProps {
  accountId: string;
  userInfo?: IBorrowReserveDetail['userInfo'];
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
}

export const ManagePositionPart = ({
  accountId,
  userInfo,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  symbol,
  logoURI,
}: IManagePositionPartProps) => {
  const navigation = useAppNavigation();
  const intl = useIntl();

  const handleSupply = useCallback(() => {
    BorrowNavigation.pushToBorrowManagePosition(navigation, {
      accountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      symbol,
      logoURI,
      providerLogoURI: logoURI,
      type: EManagePositionType.Supply,
    });
  }, [
    navigation,
    accountId,
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI,
  ]);

  const handleBorrow = useCallback(() => {
    BorrowNavigation.pushToBorrowManagePosition(navigation, {
      accountId,
      networkId,
      provider,
      marketAddress,
      reserveAddress,
      symbol,
      logoURI,
      providerLogoURI: logoURI,
      type: EManagePositionType.Borrow,
    });
  }, [
    navigation,
    accountId,
    networkId,
    provider,
    marketAddress,
    reserveAddress,
    symbol,
    logoURI,
  ]);

  const labels = {
    myInfo: intl.formatMessage({ id: ETranslations.defi_my_info }),
    walletBalance: intl.formatMessage({
      id: ETranslations.global_wallet_balance,
    }),
    availableToBorrow: intl.formatMessage({
      id: ETranslations.defi_available_to_borrow,
    }),
    suppliedBalance: intl.formatMessage({
      id: ETranslations.defi_supplied_balance,
    }),
    borrowedBalance: intl.formatMessage({
      id: ETranslations.defi_borrowed_balance,
    }),
  };

  return (
    <YStack flex={4}>
      <YStack gap="$1.5" flex={1} px="$5">
        {/* My info header */}
        <SizableText size="$headingMd" mb="$3.5">
          {labels.myInfo}
        </SizableText>

        {/* Wallet balance section */}
        <XStack jc="space-between" ai="flex-start">
          <YStack gap="$1">
            <XStack ai="center" gap="$1">
              <Icon name="WalletOutline" size="$4" color="$iconSubdued" />
              <SizableText size="$bodyMd" color="$textSubdued">
                {labels.walletBalance}
              </SizableText>
            </XStack>
            <EarnText
              text={userInfo?.walletBalance?.title}
              size="$headingXl"
              color="$text"
            />
            <EarnText
              text={userInfo?.walletBalance?.description}
              size="$bodyMd"
              color="$textSubdued"
            />
          </YStack>
          {userInfo?.walletBalance?.button ? (
            <Button
              mt="auto"
              mb="$1.5"
              variant="primary"
              size="medium"
              disabled={userInfo.walletBalance.button.disabled}
              onPress={handleSupply}
            >
              {userInfo.walletBalance.button.text.text}
            </Button>
          ) : null}
        </XStack>

        {/* Gap between sections */}
        <YStack h="$4" />

        {/* Available to borrow section */}
        <XStack jc="space-between" ai="flex-start">
          <YStack gap="$1">
            <XStack ai="center" gap="$1">
              <SizableText size="$bodyMd" color="$textSubdued">
                {labels.availableToBorrow}
              </SizableText>
              <EarnTooltip
                title={labels.availableToBorrow}
                tooltip={userInfo?.availableBorrowBalance?.tooltip}
              />
            </XStack>
            <EarnText
              text={userInfo?.availableBorrowBalance?.title}
              size="$headingXl"
              color="$text"
            />
            <EarnText
              text={userInfo?.availableBorrowBalance?.description}
              size="$bodyMd"
              color="$textSubdued"
            />
          </YStack>
          {userInfo?.availableBorrowBalance?.button ? (
            <Button
              mt="auto"
              mb="$1.5"
              variant="primary"
              size="medium"
              disabled={userInfo.availableBorrowBalance.button.disabled}
              onPress={handleBorrow}
            >
              {userInfo.availableBorrowBalance.button.text.text}
            </Button>
          ) : null}
        </XStack>

        {/* Divider */}
        <Divider my="$5" />

        {/* Supplied balance */}
        <XStack ai="center" gap="$1" mb="$2">
          <SizableText size="$bodyMd" color="$textSubdued">
            {labels.suppliedBalance}
          </SizableText>
          <EarnText
            text={userInfo?.suppliedBalance?.title}
            size="$bodyMdMedium"
            color="$text"
          />
          {userInfo?.suppliedBalance?.description?.text ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              ({userInfo.suppliedBalance.description.text})
            </SizableText>
          ) : null}
        </XStack>

        {/* Borrowed balance */}
        <XStack ai="center" gap="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {labels.borrowedBalance}
          </SizableText>
          <EarnText
            text={userInfo?.borrowedBalance?.title}
            size="$bodyMdMedium"
            color="$text"
          />
          {userInfo?.borrowedBalance?.description?.text ? (
            <SizableText size="$bodyMd" color="$textSubdued">
              ({userInfo.borrowedBalance.description.text})
            </SizableText>
          ) : null}
        </XStack>
      </YStack>
    </YStack>
  );
};
