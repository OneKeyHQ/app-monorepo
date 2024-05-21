import { useMemo } from 'react';

import {
  Button,
  NumberSizeableText,
  SizableText,
  XStack,
} from '@onekeyhq/components';
import { Token } from '@onekeyhq/kit/src/components/Token';

type INftStatus = 'pending' | 'claimable' | 'staked';

type INftListItemStatusProps = {
  symbol: string;
  amount: string;
  tokenImageUri: string;
  confirmText?: string;
  status: INftStatus;
  onClaim?: () => void;
};

export const NftListItemStatus = ({
  amount,
  symbol,
  tokenImageUri,
  onClaim,
  status,
}: INftListItemStatusProps) => {
  const statusText = useMemo(() => {
    const statuses: Record<INftStatus, string> = {
      'claimable': 'claimable',
      'pending': 'pending',
      'staked': 'staked',
    };
    return statuses[status];
  }, [status]);
  return (
    <XStack justifyContent="space-between">
      <XStack space="$1">
        <Token size="sm" tokenImageUri={tokenImageUri} />
        <NumberSizeableText size="$bodyLgMedium" formatter="balance">
          {amount}
        </NumberSizeableText>
        <SizableText size="$bodyLgMedium">{symbol}</SizableText>
        <SizableText size="$bodyLg">is {statusText}</SizableText>
      </XStack>
      {onClaim ? (
        <Button size="small" onPress={onClaim}>
          Claim
        </Button>
      ) : null}
    </XStack>
  );
};
