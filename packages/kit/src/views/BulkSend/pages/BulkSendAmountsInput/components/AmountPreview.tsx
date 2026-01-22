import {
  Button,
  Divider,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { EAmountInputMode } from '@onekeyhq/shared/types/bulkSend';

type IAmountPreviewProps = {
  type: EAmountInputMode;
  totalAmount?: string;
  totalFiatValue?: string;
  availableBalance: string;
  tokenSymbol: string;
  onMaxPress?: () => void;
};

export function AmountPreview({
  type,
  totalAmount = '0',
  totalFiatValue = '$0',
  availableBalance,
  tokenSymbol,
  onMaxPress,
}: IAmountPreviewProps) {
  const showTotalAmount = type !== EAmountInputMode.Custom;
  const showMaxButton = type === EAmountInputMode.Specified;

  return (
    <YStack>
      {showTotalAmount ? (
        <>
          <YStack>
            <SizableText size="$bodyMd" color="$textSubdued">
              Total amount
            </SizableText>
            <SizableText size="$bodyLgMedium" color="$text">
              {totalAmount} {tokenSymbol} ({totalFiatValue})
            </SizableText>
          </YStack>
          <YStack pt="$3" pb="$2">
            <Divider />
          </YStack>
        </>
      ) : null}
      <XStack py="$0.5" alignItems="center" justifyContent="space-between">
        <XStack gap="$1" alignItems="center">
          <SizableText size="$bodyMd" color="$textSubdued">
            Available:
          </SizableText>
          <SizableText size="$bodyMd" color="$text">
            {availableBalance} {tokenSymbol}
          </SizableText>
        </XStack>
        {showMaxButton ? (
          <Button variant="tertiary" size="small" onPress={onMaxPress}>
            Max
          </Button>
        ) : null}
      </XStack>
    </YStack>
  );
}
