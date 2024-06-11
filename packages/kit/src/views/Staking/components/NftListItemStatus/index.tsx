import { useCallback, useMemo, useState } from 'react';

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
  onClaim?: () => Promise<void>;
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
  const [loading, setLoading] = useState(false);
  const onPress = useCallback(async () => {
    try {
      setLoading(true);
      await onClaim?.();
    } finally {
      setLoading(false);
    }
  }, [onClaim]);
  return (
    <XStack justifyContent="space-between">
      <XStack alignItems="center">
        <Token size="xs" tokenImageUri={tokenImageUri} />
        <XStack ml="$2" space="$1" alignItems="center">
          <NumberSizeableText size="$bodyLgMedium" formatter="balance">
            {amount}
          </NumberSizeableText>
          <SizableText size="$bodyLgMedium">{symbol}</SizableText>
          <SizableText size="$bodyLg">is {statusText}</SizableText>
        </XStack>
      </XStack>
      {onClaim ? (
        <Button
          size="small"
          variant="primary"
          loading={loading}
          onPress={onPress}
        >
          Claim
        </Button>
      ) : null}
    </XStack>
  );
};
