import { useEffect, useMemo, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDebugRenderTrackerProps } from '@onekeyhq/components';
import { useHyperliquidActions } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActivePositionAtom,
  usePerpsActivePositionLengthAtom,
  usePositionFilterByCurrentTokenAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms';
import {
  usePerpsActiveAccountAtom,
  usePerpsActiveAssetAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { showCloseAllPositionsDialog } from '../CloseAllPositionsModal';
import { MobilePositionsListHeader } from '../Components/MobilePositionsListHeader';
import { PositionRow } from '../Components/PositionsRow';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

interface IPerpPositionsListProps {
  handleViewTpslOrders: () => void;
  isMobile?: boolean;
  useTabsList?: boolean;
  disableListScroll?: boolean;
}

function PerpPositionsList({
  handleViewTpslOrders,
  isMobile,
  useTabsList,
  disableListScroll,
}: IPerpPositionsListProps) {
  const intl = useIntl();
  const [currentUser] = usePerpsActiveAccountAtom();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const [positionsLength] = usePerpsActivePositionLengthAtom();
  const [filterByCurrentToken] = usePositionFilterByCurrentTokenAtom();
  const [activeAsset] = usePerpsActiveAssetAtom();
  const [positions] = usePerpsActivePositionAtom();
  const [currentListPage, setCurrentListPage] = useState(1);
  useEffect(() => {
    noop(currentUser?.accountAddress);
    setCurrentListPage(1);
  }, [currentUser?.accountAddress]);

  const columnsConfig: IColumnConfig[] = useMemo(() => {
    return [
      {
        key: 'asset',
        title: intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        }),
        width: 110,
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
        minWidth: 180,
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
        tooltip: intl.formatMessage({
          id: ETranslations.perp_position_margin_tooltip,
        }),
      },
      {
        key: 'funding',
        title: intl.formatMessage({
          id: ETranslations.perp_position_funding_2,
        }),
        minWidth: 100,
        align: 'left',
        flex: 1,
        tooltip: intl.formatMessage({
          id: ETranslations.perp_position_margin_tooltip_funding,
        }),
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
        key: 'closeAll',
        title: intl.formatMessage({
          id: ETranslations.perp_position_close,
        }),
        minWidth: 80,
        align: 'right',
        flex: 1,
        fixed: true,
        ...(positionsLength > 0 && {
          onPress: () => showCloseAllPositionsDialog(),
        }),
      },
    ];
  }, [intl, positionsLength]);
  const totalMinWidth = useMemo(
    () =>
      columnsConfig.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [columnsConfig],
  );

  // Generate mocked positions with correct original indices
  const mockedPositions = useMemo<{ index: number }[]>(() => {
    if (!isMobile || !filterByCurrentToken || !activeAsset?.coin) {
      // No filter: use sequential indices
      return Array.from(
        { length: positions.activePositions.length },
        (_, index) => ({
          index,
        }),
      );
    }
    // Filter active: preserve original indices from unfiltered array
    return positions.activePositions
      .map((p, originalIndex) => ({ position: p, originalIndex }))
      .filter((item) => item.position.position.coin === activeAsset.coin)
      .map((item) => ({ index: item.originalIndex }));
  }, [
    positions.activePositions,
    isMobile,
    filterByCurrentToken,
    activeAsset?.coin,
  ]);

  const renderPositionRow = (
    item: { index: number },
    _index: number,
    renderMode?: 'full' | 'left' | 'right',
    isHovered?: boolean,
    onHoverChange?: (index: number | null) => void,
  ) => (
    <PositionRow
      mockedPosition={item}
      isMobile={isMobile}
      cellMinWidth={totalMinWidth}
      columnConfigs={columnsConfig}
      handleViewTpslOrders={handleViewTpslOrders}
      renderMode={renderMode}
      isHovered={isHovered}
      onHoverChange={onHoverChange}
    />
  );
  const actions = useHyperliquidActions();
  return (
    <CommonTableListView
      onPullToRefresh={async () => {
        await actions.current.refreshAllPerpsData();
      }}
      listViewDebugRenderTrackerProps={useMemo(
        (): IDebugRenderTrackerProps => ({
          name: 'PerpPositionsList',
          position: 'top-left',
        }),
        [],
      )}
      useTabsList={useTabsList}
      disableListScroll={disableListScroll}
      currentListPage={currentListPage}
      setCurrentListPage={setCurrentListPage}
      enablePagination={!isMobile}
      columns={columnsConfig}
      minTableWidth={totalMinWidth}
      data={mockedPositions}
      isMobile={isMobile}
      renderRow={renderPositionRow}
      emptyMessage={intl.formatMessage({
        id: ETranslations.perp_position_empty,
      })}
      emptySubMessage={intl.formatMessage({
        id: ETranslations.perp_position_empty_desc,
      })}
      ListHeaderComponent={
        isMobile ? (
          <MobilePositionsListHeader
            totalPositionCount={positions.activePositions.length}
          />
        ) : null
      }
    />
  );
}

export { PerpPositionsList };
