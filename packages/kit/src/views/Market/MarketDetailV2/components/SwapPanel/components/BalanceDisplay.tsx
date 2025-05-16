import { SizableText, XStack } from '@onekeyhq/components';

interface ITokenInfo {
  label: string;
  value: string;
  price?: number;
}

export interface IBalanceDisplayProps {
  balance?: string;
  token?: ITokenInfo;
}

export function BalanceDisplay({ balance, token }: IBalanceDisplayProps) {
  return (
    <XStack justifyContent="space-between" alignItems="center">
      <SizableText size="$bodyMd" color="$textSubdued">
        Balance
      </SizableText>
      <SizableText size="$bodyMdMedium">
        {balance || '-'} {token?.label || ''}
      </SizableText>
    </XStack>
  );
}
