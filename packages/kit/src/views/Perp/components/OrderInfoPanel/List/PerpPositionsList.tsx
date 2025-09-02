import {
  useAllMidsAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IWsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { usePerpPositions } from '../../../hooks/usePerpOrderInfoPanel';
import { PositionRow } from '../Components/PositionsRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

// Column configuration for CommonTableListView
const COLUMNS: IColumnConfig[] = [
  { key: 'side', title: '', width: 10 },
  { key: 'symbol', title: 'Symbol', width: 140 },
  { key: 'size', title: 'Size', width: 120 },
  { key: 'entryPrice', title: 'Entry Price', width: 100 },
  { key: 'markPrice', title: 'Mark Price', width: 100 },
  { key: 'pnl', title: 'PnL (ROE %)', width: 140 },
  { key: 'margin', title: 'Margin', width: 100 },
  { key: 'liqPrice', title: 'Liq. Price', width: 100 },
  { key: 'actions', title: 'Close', width: 140 },
];

function PerpPositionsList() {
  const positions = usePerpPositions();
  const [allMids] = useAllMidsAtom();
  const actions = useHyperliquidActions();

  const renderPositionRow = (
    item: IWsWebData2['clearinghouseState']['assetPositions'][number],
    _index: number,
  ) => {
    const position = item.position;
    const coin = position?.coin;
    const szi = position?.szi;
    const midValue = allMids?.mids?.[coin];
    return (
      <PositionRow
        key={`${coin}_${szi}`}
        pos={position}
        mid={midValue}
        actions={actions}
      />
    );
  };

  return (
    <CommonTableListView
      columns={COLUMNS}
      data={positions}
      renderRow={renderPositionRow}
      emptyMessage="No open positions"
      emptySubMessage="Your positions will appear here after opening trades"
    />
  );
}

export { PerpPositionsList };
