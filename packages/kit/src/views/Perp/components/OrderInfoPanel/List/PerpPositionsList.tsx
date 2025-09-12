import { useMemo } from 'react';

import {
  useAllMidsAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';

import { useTokenList } from '../../../hooks';
import {
  usePerpOrders,
  usePerpPositions,
} from '../../../hooks/usePerpOrderInfoPanel';
import { showClosePositionDialog } from '../ClosePositionModal';
import { PositionRow } from '../Components/PositionsRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

import type { AssetPosition } from '@nktkas/hyperliquid';

interface IPerpPositionsListProps {
  handleViewTpslOrders: () => void;
  isMobile?: boolean;
}

function PerpPositionsList({
  handleViewTpslOrders,
  isMobile,
}: IPerpPositionsListProps) {
  const positions = usePerpPositions();
  const openOrders = usePerpOrders();
  const [allMids] = useAllMidsAtom();
  const actions = useHyperliquidActions();
  const { getTokenInfo } = useTokenList();
  const columnsConfig: IColumnConfig[] = useMemo(() => {
    return [
      { key: 'asset', title: 'Asset', width: 120, align: 'left' },
      {
        key: 'size',
        title: 'Position Size',
        minWidth: 120,
        align: 'left',
        flex: 1,
      },
      {
        key: 'entryPrice',
        title: 'Entry Price',
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'markPrice',
        title: 'Mark Price',
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'liqPrice',
        title: 'Liq. Price',
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'pnl',
        title: 'PnL (ROE %)',
        minWidth: 160,
        align: 'left',
        flex: 1,
      },
      {
        key: 'margin',
        title: 'Margin',
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'funding',
        title: 'Funding',
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      { key: 'TPSL', title: 'TP/SL', minWidth: 140, align: 'center', flex: 1 },
      {
        key: 'actions',
        title: 'Close',
        minWidth: 100,
        align: 'right',
        flex: 1,
      },
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
  const positionSort = useMemo<AssetPosition[]>(() => {
    return positions.sort(
      (a, b) =>
        parseFloat(b.position.positionValue || '0') -
        parseFloat(a.position.positionValue || '0'),
    );
  }, [positions]);

  const onAllClose = () => {
    console.log('onAllClose');
  };
  const setTpsl = () => {
    console.log('setTpsl');
  };
  const handleLimitClose = ({
    position,
  }: {
    position: AssetPosition['position'];
  }) => {
    // TODO: implement limit close
  };
  const handleMarketClose = ({
    position,
  }: {
    position: AssetPosition['position'];
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
  const renderPositionRow = (item: AssetPosition, _index: number) => {
    const position = item.position;
    const coin = position?.coin;
    const szi = position?.szi;
    const midValue = allMids?.mids?.[coin];
    const tpslOrders = openOrders.filter(
      (order) =>
        order.coin === coin &&
        (order.orderType.startsWith('Take') ||
          order.orderType.startsWith('Stop')),
    );
    return (
      <PositionRow
        key={`${coin}_${szi}`}
        pos={position}
        mid={midValue}
        isMobile={isMobile}
        tpslOrders={tpslOrders}
        cellMinWidth={totalMinWidth}
        columnConfigs={columnsConfig}
        handleMarketClose={handleMarketClose}
        handleLimitClose={handleLimitClose}
        handleViewTpslOrders={handleViewTpslOrders}
        onAllClose={onAllClose}
        setTpsl={setTpsl}
        index={_index}
      />
    );
  };

  return (
    <CommonTableListView
      columns={columnsConfig}
      minTableWidth={totalMinWidth}
      data={positionSort}
      isMobile={isMobile}
      renderRow={renderPositionRow}
      emptyMessage="No open positions"
      emptySubMessage="Your positions will appear here after opening trades"
    />
  );
}

export { PerpPositionsList };
