import { SizableText, YStack } from '@onekeyhq/components';

interface IManagePositionPartProps {
  networkId: string;
  provider: string;
  marketAddress: string;
  reserveAddress: string;
}

export const ManagePositionPart = ({
  networkId,
  provider,
  marketAddress,
  reserveAddress,
}: IManagePositionPartProps) => (
  // TODO: Implement ManagePosition for Borrow
  // - Add supply/withdraw actions
  // - Add borrow/repay actions
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
            TODO: Supply / Withdraw
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            TODO: Borrow / Repay
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            networkId: {networkId}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            provider: {provider}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            marketAddress: {marketAddress}
          </SizableText>
          <SizableText size="$bodySm" color="$textSubdued">
            reserveAddress: {reserveAddress}
          </SizableText>
        </YStack>
      </YStack>
    </YStack>
  </YStack>
);
