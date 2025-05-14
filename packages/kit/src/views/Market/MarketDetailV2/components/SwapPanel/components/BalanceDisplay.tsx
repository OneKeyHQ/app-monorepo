import { SizableText, XStack } from '@onekeyhq/components';

export function BalanceDisplay() {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        Balance
      </SizableText>
      <SizableText size="$bodyMdMedium">2 SOL</SizableText>
    </XStack>
  );
}
