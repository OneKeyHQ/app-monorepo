import { memo } from 'react';

import { SizableText } from '@onekeyhq/components';

interface ITransactionTypeProps {
  typeText: string;
  typeColor: string;
  style?: any;
}

function TransactionTypeBase({
  typeText,
  typeColor,
  style,
}: ITransactionTypeProps) {
  return (
    <SizableText size="$bodyMdMedium" color={typeColor} {...style}>
      {typeText}
    </SizableText>
  );
}

const TransactionType = memo(TransactionTypeBase);

export { TransactionType };
