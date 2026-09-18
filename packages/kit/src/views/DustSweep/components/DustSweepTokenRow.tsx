import type { ReactNode } from 'react';

import {
  Checkbox,
  NumberSizeableText,
  SizableText,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { Token } from '@onekeyhq/kit/src/components/Token';

import type { IDustSweepItem } from '../stateMachine';

export function DustSweepTokenRow({
  item,
  selected,
  onToggle,
}: {
  item: IDustSweepItem;
  selected: boolean;
  onToggle: () => void;
}) {
  const disabled = item.status !== 'waiting';
  let status: ReactNode = null;
  if (item.status === 'running' || item.status === 'broadcasted') {
    status = (
      <SizableText color="$textSubdued">
        {item.status === 'broadcasted' ? '…' : '⌛'}
      </SizableText>
    );
  } else if (item.status === 'success') {
    status = <SizableText color="$green11">✓</SizableText>;
  } else if (item.status === 'skipped' || item.status === 'failed') {
    status = <SizableText color="$red11">×</SizableText>;
  }

  return (
    <ListItem
      px="$0"
      py="$3"
      opacity={disabled ? 0.6 : 1}
      onPress={disabled ? undefined : onToggle}
    >
      <Checkbox
        testID={`dust-sweep-token-checkbox-${item.key}`}
        value={selected}
        disabled={disabled}
        shouldStopPropagation
        containerProps={{ py: '$0' }}
        accessibilityLabel={item.token.symbol}
        onChange={onToggle}
      />
      <Token
        size="md"
        tokenImageUri={item.token.logoURI}
        networkId={item.token.networkId}
        showNetworkIcon
      />
      <ListItem.Text
        flex={1}
        primary={item.token.symbol}
        secondary={item.token.name}
      />
      <Stack alignItems="flex-end" gap="$1">
        <NumberSizeableText formatter="balance" size="$bodyMdMedium">
          {item.token.balanceParsed ?? '0'}
        </NumberSizeableText>
        <XStack alignItems="center" gap="$2">
          <NumberSizeableText
            formatter="value"
            size="$bodySm"
            color="$textSubdued"
          >
            {item.token.fiatValue}
          </NumberSizeableText>
          {status}
        </XStack>
      </Stack>
    </ListItem>
  );
}
