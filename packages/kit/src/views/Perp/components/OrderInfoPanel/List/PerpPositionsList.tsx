import { useCallback, useEffect, useMemo, useRef } from 'react';

import { useIntl } from 'react-intl';

import {
  useAllMidsAtom,
  useHyperliquidActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useTokenList } from '../../../hooks/usePerpMarketData';
import {
  usePerpOrders,
  usePerpPositions,
} from '../../../hooks/usePerpOrderInfoPanel';
import { showClosePositionDialog } from '../ClosePositionModal';
import { PositionRow } from '../Components/PositionsRow';
import { showSetTpslDialog } from '../SetTpslModal';

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
  const intl = useIntl();
  const positions = usePerpPositions();
  const openOrders = usePerpOrders();
  const [allMids] = useAllMidsAtom();
  const actions = useHyperliquidActions();
  const { getTokenInfo } = useTokenList();

  const columnsConfig: IColumnConfig[] = useMemo(() => {
    return [
      {
        key: 'asset',
        title: intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        }),
        width: 120,
        align: 'left',
      },
      {
        key: 'size',
        title: intl.formatMessage({
          id: ETranslations.perp_position_position_size,
        }),
        minWidth: 120,
        align: 'left',
        flex: 1,
      },
      {
        key: 'entryPrice',
        title: intl.formatMessage({
          id: ETranslations.perp_position_entry_price,
        }),
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'markPrice',
        title: intl.formatMessage({
          id: ETranslations.perp_position_mark_price,
        }),
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'liqPrice',
        title: intl.formatMessage({
          id: ETranslations.perp_position_liq_price,
        }),
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'pnl',
        title: intl.formatMessage({
          id: ETranslations.perp_position_pnl,
        }),
        minWidth: 160,
        align: 'left',
        flex: 1,
      },
      {
        key: 'margin',
        title: intl.formatMessage({
          id: ETranslations.perp_position_margin,
        }),
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'funding',
        title: intl.formatMessage({
          id: ETranslations.perp_position_funding_2,
        }),
        minWidth: 100,
        align: 'left',
        flex: 1,
      },
      {
        key: 'TPSL',
        title: intl.formatMessage({
          id: ETranslations.perp_position_tp_sl,
        }),
        minWidth: 140,
        align: 'center',
        flex: 1,
      },
      {
        key: 'actions',
        title: intl.formatMessage({
          id: ETranslations.perp_position_close,
        }),
        minWidth: 100,
        align: 'right',
        flex: 1,
      },
    ];
  }, [intl]);
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

  const handleSetTpsl = useCallback(
    (position: AssetPosition['position']) => {
      const tokenInfo = getTokenInfo(position.coin);
      if (!tokenInfo) {
        console.error(
          '[PerpPositionsList] Token info not found for',
          position.coin,
        );
        return;
      }

      showSetTpslDialog({
        position,
        szDecimals: tokenInfo.szDecimals ?? 2,
        assetId: tokenInfo.assetId,
        hyperliquidActions: actions,
      });
    },
    [getTokenInfo, actions],
  );

  const allMidsRef = useRef(allMids);
  useEffect(() => {
    allMidsRef.current = allMids;
  }, [allMids]);

  const handleClosePosition = useCallback(
    ({
      position,
      type,
    }: {
      position: AssetPosition['position'];
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
        szDecimals: tokenInfo.szDecimals ?? 2,
        assetId: tokenInfo.assetId,
        hyperliquidActions: actions,
      });
    },
    [getTokenInfo, actions],
  );

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
        handleClosePosition={(type) => handleClosePosition({ position, type })}
        handleViewTpslOrders={handleViewTpslOrders}
        setTpsl={() => handleSetTpsl(position)}
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
      emptyMessage={intl.formatMessage({
        id: ETranslations.perp_position_empty,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_position_empty_desc,
      })}
    />
  );
}

export { PerpPositionsList };
