import { useCallback, useEffect, useMemo, useRef } from 'react';

import {
  useAllMidsAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import type { IWsWebData2 } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { useTokenList } from '../../../hooks/usePerpMarketData';
import {
  usePerpOrders,
  usePerpPositions,
} from '../../../hooks/usePerpOrderInfoPanel';
import { showClosePositionDialog } from '../ClosePositionModal';
import { PositionRow } from '../Components/PositionsRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

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
      { key: 'asset', title: 'Asset', width: 100, align: 'left' },
      {
        key: 'size',
        title: 'Position Size',
        minWidth: 100,
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
        minWidth: 140,
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

  const onAllClose = useCallback(() => {
    console.log('onAllClose');
  }, []);

  const setTpsl = useCallback(() => {
    console.log('setTpsl');
  }, []);

  const allMidsRef = useRef(allMids);
  useEffect(() => {
    allMidsRef.current = allMids;
  }, [allMids]);

  const handleClosePosition = useCallback(
    ({
      position,
      type,
    }: {
      position: IWsWebData2['clearinghouseState']['assetPositions'][number]['position'];
      type: 'market' | 'limit';
    }) => {
      const tokenInfo = getTokenInfo(position.coin);
      if (!tokenInfo) {
        console.error(
          '[PerpPositionsList] Token info not found for',
          position.coin,
        );
        return;
      }

      showClosePositionDialog({
        position,
        type,
        szDecimals: tokenInfo.szDecimals || 2,
        assetId: tokenInfo.assetId,
        getMidPrice: () => allMidsRef.current?.mids?.[position.coin] || '',
        hyperliquidActions: actions,
      });
    },
    [getTokenInfo, actions],
  );

  const renderPositionRow = (
    item: IWsWebData2['clearinghouseState']['assetPositions'][number],
    _index: number,
  ) => {
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
        handleClosePosition={(type) => handleClosePosition({ position, type })}
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
      data={positions}
      isMobile={isMobile}
      renderRow={renderPositionRow}
      emptyMessage="No open positions"
      emptySubMessage="Your positions will appear here after opening trades"
    />
  );
}

export { PerpPositionsList };
