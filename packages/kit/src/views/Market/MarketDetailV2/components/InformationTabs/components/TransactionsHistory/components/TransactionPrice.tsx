import { memo } from 'react';

import { NumberSizeableText } from '@onekeyhq/components';

interface ITransactionPriceProps {
  price: string;
  style?: any;
}

function TransactionPriceBase({ price, style }: ITransactionPriceProps) {
  return (
    <NumberSizeableText
      size="$bodyMd"
      color="$text"
      formatter="marketCap"
      formatterOptions={{ currency: '$', capAtMaxT: true }}
      {...style}
    >
      {price}
    </NumberSizeableText>
  );
}

const TransactionPrice = memo(TransactionPriceBase);

export { TransactionPrice };
