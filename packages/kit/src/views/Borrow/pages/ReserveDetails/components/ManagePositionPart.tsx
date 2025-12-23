import { useCallback } from 'react';

import {
  Button,
  Divider,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EarnText } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnText';
import { EarnTooltip } from '@onekeyhq/kit/src/views/Staking/components/ProtocolDetails/EarnTooltip';
import { EManagePositionType } from '@onekeyhq/kit/src/views/Staking/pages/ManagePosition/hooks/useManagePage';

import { BorrowNavigation } from '../../../borrowUtils';

interface IManagePositionPartProps {
  accountId: string;
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
  symbol: string;
  logoURI?: string;
}

export const ManagePositionPart = ({
  accountId,
  networkId,
  provider,
  marketAddress,
  reserveAddress,
  symbol,
  logoURI,
}: IManagePositionPartProps) => {
  const navigation = useAppNavigation();

  const { result: details } = usePromiseResult(
    async () => {
      if (!accountId) return undefined;
      return backgroundApiProxy.serviceStaking.getBorrowReserveDetails({
        networkId,
        provider,
        marketAddress,
        reserveAddress,
        accountId,
      });
    },
    [networkId, provider, marketAddress, reserveAddress, accountId],
    { revalidateOnFocus: true },
  );

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

  const userInfo = details?.userInfo;

  return (
    <YStack flex={4}>
      <YStack gap="$1.5" flex={1} p="$5">
        {/* My info header */}
        <SizableText size="$headingMd" mb="$5">
          My info
        </SizableText>

        {/* Wallet balance section */}
        <XStack jc="space-between" ai="flex-start">
          <YStack gap="$1">
            <XStack ai="center" gap="$1">
              <Icon name="WalletOutline" size="$4" color="$iconSubdued" />
              <SizableText size="$bodyMd" color="$textSubdued">
                Wallet balance
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
              variant="primary"
              size="medium"
              disabled={userInfo.walletBalance.button.disabled}
              onPress={handleSupply}
            >
              <EarnText
                text={userInfo.walletBalance.button.text}
                color="$textInverse"
              />
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
                Available to borrow
              </SizableText>
              <EarnTooltip
                title="Available to borrow"
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
              variant="primary"
              size="medium"
              disabled={userInfo.availableBorrowBalance.button.disabled}
              onPress={handleBorrow}
            >
              <EarnText
                text={userInfo.availableBorrowBalance.button.text}
                color="$textInverse"
              />
            </Button>
          ) : null}
        </XStack>

        {/* Divider */}
        <Divider my="$5" />

        {/* Supplied balance */}
        <XStack ai="center" gap="$1" mb="$2">
          <SizableText size="$bodyMd" color="$textSubdued">
            Supplied balance
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
            Borrowed balance
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
