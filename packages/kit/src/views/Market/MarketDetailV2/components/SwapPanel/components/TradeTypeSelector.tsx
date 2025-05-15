import { SegmentControl } from '@onekeyhq/components';

import type { ITradeType } from '../useSwapPanel';

export function TradeTypeSelector({
  value,
  onChange,
}: {
  value: ITradeType;
  onChange: (value: ITradeType) => void;
}) {
  return (
    <SegmentControl
      value={value}
      options={[
        { label: 'Buy', value: 'buy' },
        { label: 'Sell', value: 'sell' },
      ]}
      onChange={(v) => {
        onChange(v as ITradeType);
      }}
    />
  );
}
