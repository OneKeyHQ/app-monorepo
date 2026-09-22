import { useCallback } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';

import type { GestureResponderEvent } from 'react-native';

/** Short hash + explorer link, used by every phone reward row that carries one. */
export function TransactionLink({
  networkId,
  txHash,
}: {
  networkId: string;
  txHash: string;
}) {
  // The row itself may open something else, so the hash must not bubble.
  const onPress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      void openTransactionDetailsUrl({ networkId, txid: txHash });
    },
    [networkId, txHash],
  );

  return (
    <XStack ai="center" gap="$1" cursor="pointer" onPress={onPress}>
      <SizableText size="$bodySm" color="$textSubdued">
        {`${txHash.slice(0, 6)}…${txHash.slice(-4)}`}
      </SizableText>
      <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}
