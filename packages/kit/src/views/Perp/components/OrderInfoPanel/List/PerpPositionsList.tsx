import { useMemo } from 'react';

import {
  useAllMidsAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IWsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useTokenList } from '../../../hooks';
import { usePerpPositions } from '../../../hooks/usePerpOrderInfoPanel';
import { showClosePositionDialog } from '../ClosePositionModal';
import { PositionRow } from '../Components/PositionsRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

// Column configuration for CommonTableListView
const COLUMNS: IColumnConfig[] = [
  { key: 'asset', title: 'Asset', width: 100 },
  { key: 'size', title: 'Position Size', width: 100 },
  {
    key: 'entryPrice',
    title: 'Entry Price',
    minWidth: 80,
    align: 'left',
    flex: 1,
  },
  {
    key: 'markPrice',
    title: 'Mark Price',
    minWidth: 80,
    align: 'left',
    flex: 1,
  },
  {
    key: 'liqPrice',
    title: 'Liq. Price',
    minWidth: 80,
    align: 'left',
    flex: 1,
  },
  { key: 'pnl', title: 'PnL (ROE %)', minWidth: 100, align: 'left', flex: 1 },
  { key: 'margin', title: 'Margin', minWidth: 100, align: 'left', flex: 1 },
  { key: 'funding', title: 'Funding', minWidth: 100, align: 'left', flex: 1 },
  { key: 'TPSL', title: 'TP/SL', minWidth: 100, align: 'left', flex: 1 },
  { key: 'actions', title: 'Close', width: 100, align: 'center' },
];

function PerpPositionsList() {
  const positions = usePerpPositions();
  const [allMids] = useAllMidsAtom();
  const actions = useHyperliquidActions();
  const { getTokenInfo } = useTokenList();
  const columnsConfig: IColumnConfig[] = useMemo(() => {
    return [
      { key: 'asset', title: 'Asset', width: 100 },
      { key: 'size', title: 'Position Size', width: 100 },
      {
        key: 'entryPrice',
        title: 'Entry Price',
        minWidth: 80,
        align: 'left',
        flex: 1,
      },
      {
        key: 'markPrice',
        title: 'Mark Price',
        minWidth: 80,
        align: 'left',
        flex: 1,
      },
      {
        key: 'liqPrice',
        title: 'Liq. Price',
        minWidth: 80,
        align: 'left',
        flex: 1,
      },
      {
        key: 'pnl',
        title: 'PnL (ROE %)',
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      { key: 'margin', title: 'Margin', minWidth: 100, align: 'left', flex: 1 },
      {
        key: 'funding',
        title: 'Funding',
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      { key: 'TPSL', title: 'TP/SL', minWidth: 100, align: 'left', flex: 1 },
      { key: 'actions', title: 'Close', width: 100, align: 'center' },
    ];
  }, []);
  const totalMinWidth = useMemo(
    () =>
      columnsConfig.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [columnsConfig],
  );

  const handleLimitClose = ({
    position,
  }: {
    position: IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];
  }) => {
    // TODO: implement limit close
  };
  const handleMarketClose = ({
    position,
  }: {
    position: IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];
  }) => {
    const tokenInfo = getTokenInfo(position.coin);
    if (tokenInfo) {
      showClosePositionDialog({
        position,
        assetId: tokenInfo.assetId,
        mid: allMids?.mids?.[position.coin],
        hyperliquidActions: actions,
      });
    }
  };
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
        cellMinWidth={totalMinWidth}
        columnConfigs={columnsConfig}
        handleMarketClose={handleMarketClose}
        handleLimitClose={handleLimitClose}
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
