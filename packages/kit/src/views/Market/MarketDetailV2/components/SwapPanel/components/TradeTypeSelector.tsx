import { useState } from 'react';

import { SegmentControl } from '@onekeyhq/components';

export function TradeTypeSelector() {
  const [buySellMode, setBuySellMode] = useState<'buy' | 'sell'>('buy');

  return (
    <SegmentControl
      value={buySellMode}
      options={[
        { label: 'Buy', value: 'buy' },
        { label: 'Sell', value: 'sell' },
      ]}
      onChange={(value) => {
        setBuySellMode(value as 'buy' | 'sell');
      }}
    />
  );
}
