import { memo } from 'react';

import { SizableText } from '@onekeyhq/components';

interface ITransactionTimeProps {
  timestamp: number;
  formatRelativeTime: (timestamp: number) => string;
  style?: any;
}

function TransactionTimeBase({
  timestamp,
  formatRelativeTime,
  style,
}: ITransactionTimeProps) {
  return (
    <SizableText size="$bodyMd" color="$textSubdued" {...style}>
      {formatRelativeTime(timestamp)}
    </SizableText>
  );
}

const TransactionTime = memo(TransactionTimeBase);

export { TransactionTime };
