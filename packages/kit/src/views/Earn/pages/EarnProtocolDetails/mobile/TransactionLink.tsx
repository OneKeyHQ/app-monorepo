import { useCallback } from 'react';

import { Icon, SizableText, XStack } from '@onekeyhq/components';
import { openTransactionDetailsUrl } from '@onekeyhq/kit/src/utils/explorerUtils';

import type { GestureResponderEvent } from 'react-native';

export function TransactionLink({
  networkId,
  txHash,
  label,
  accessibilityLabel,
}: {
  networkId: string;
  txHash: string;
  label?: string;
  accessibilityLabel?: string;
}) {
  // The row itself may open something else, so the hash must not bubble.
  const onPress = useCallback(
    (event: GestureResponderEvent) => {
      event.stopPropagation();
      void openTransactionDetailsUrl({ networkId, txid: txHash });
    },
    [networkId, txHash],
  );
  const text = label ?? `${txHash.slice(0, 6)}…${txHash.slice(-4)}`;
  const accessibleLabel = accessibilityLabel ?? text;

  return (
    <XStack
      render={<button type="button" aria-label={accessibleLabel} />}
      ai="center"
      gap="$1"
      cursor="pointer"
      flexShrink={1}
      bg="transparent"
      borderWidth={0}
      p="$0"
      role="link"
      aria-label={accessibleLabel}
      onPress={onPress}
    >
      <SizableText size="$bodySm" color="$textSubdued" flexShrink={1}>
        {text}
      </SizableText>
      <Icon name="OpenOutline" size="$4" color="$iconSubdued" />
    </XStack>
  );
}
