import { useCallback } from 'react';

import { Button, SizableText, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
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

  const handleOpenManageModal = useCallback(() => {
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

  return (
    <YStack flex={4}>
      <YStack gap="$1.5" flex={1} p="$5">
        <YStack
          p="$4"
          borderRadius="$3"
          borderWidth={1}
          borderColor="$borderSubdued"
          gap="$4"
        >
          <SizableText size="$headingMd">Manage Position</SizableText>
          <YStack gap="$3">
            <SizableText size="$bodySm" color="$textSubdued">
              Hello World
            </SizableText>
            <Button variant="primary" onPress={handleOpenManageModal}>
              Manage Position
            </Button>
          </YStack>
        </YStack>
      </YStack>
    </YStack>
  );
};
