import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import type { IDebugRenderTrackerProps } from '@onekeyhq/components';
import {
  ScrollView,
  SizableText,
  Tooltip,
  XStack,
  YStack,
} from '@onekeyhq/components';
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

import {
  type IPerpsMobileLayoutTraceRect,
  getPerpsMobileLayoutTraceRect,
  isPerpsMobileLayoutTraceRectChanged,
  tracePerpsMobileLayout,
} from '../../../utils/mobileLayoutTrace';
import { showCloseAllPositionsDialog } from '../CloseAllPositionsModal';
import { MobilePositionsListHeader } from '../Components/MobilePositionsListHeader';
import { PerpPositionsEmptyState } from '../Components/PerpPositionsEmptyState';
import { type IPositionRowItem, PositionRow } from '../Components/PositionsRow';
import { calcCellAlign, getColumnStyle } from '../utils';

import { CommonTableListView, type IColumnConfig } from './CommonTableListView';

import type { LayoutChangeEvent } from 'react-native';

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
  const layoutRectsRef = useRef<
    Record<string, IPerpsMobileLayoutTraceRect | undefined>
  >({});
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
        fixed: positionsLength > 0,
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

  // Keep each row on the same positions snapshot that decided list emptiness.
  const mockedPositions = useMemo<IPositionRowItem[]>(() => {
    if (!isMobile || !filterByCurrentToken || !activeAsset?.coin) {
      return positions.activePositions.map((activePosition, index) => ({
        index,
        activePosition,
      }));
    }
    return positions.activePositions
      .map((activePosition, originalIndex) => ({
        index: originalIndex,
        activePosition,
      }))
      .filter((item) => item.activePosition.position.coin === activeAsset.coin);
  }, [
    positions.activePositions,
    isMobile,
    filterByCurrentToken,
    activeAsset?.coin,
  ]);

  const handleTraceLayout = useCallback(
    (name: string, event: LayoutChangeEvent) => {
      if (!isMobile) {
        return;
      }
      const rect = getPerpsMobileLayoutTraceRect(event);
      if (
        isPerpsMobileLayoutTraceRectChanged(layoutRectsRef.current[name], rect)
      ) {
        tracePerpsMobileLayout(`positionsList.${name}.layout`, {
          rect,
          mockedPositionsLength: mockedPositions.length,
          activePositionsLength: positions.activePositions.length,
          filterByCurrentToken,
          activeCoin: activeAsset?.coin,
          hasAccountAddress: Boolean(currentUser?.accountAddress),
          useTabsList,
          disableListScroll,
        });
        layoutRectsRef.current[name] = rect;
      }
    },
    [
      activeAsset?.coin,
      currentUser?.accountAddress,
      disableListScroll,
      filterByCurrentToken,
      isMobile,
      mockedPositions.length,
      positions.activePositions.length,
      useTabsList,
    ],
  );

  useEffect(() => {
    if (!isMobile) {
      return;
    }
    tracePerpsMobileLayout('positionsList.state', {
      positionsLength,
      mockedPositionsLength: mockedPositions.length,
      activePositionsLength: positions.activePositions.length,
      filterByCurrentToken,
      activeCoin: activeAsset?.coin,
      hasAccountAddress: Boolean(currentUser?.accountAddress),
      useTabsList,
      disableListScroll,
    });
  }, [
    activeAsset?.coin,
    currentUser?.accountAddress,
    disableListScroll,
    filterByCurrentToken,
    isMobile,
    mockedPositions.length,
    positions.activePositions.length,
    positionsLength,
    useTabsList,
  ]);

  const renderPositionRow = (
    item: IPositionRowItem,
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
  const keyExtractor = useCallback((item: IPositionRowItem) => {
    return item.activePosition.position.coin;
  }, []);
  const actions = useHyperliquidActions();
  const listViewDebugRenderTrackerProps = useMemo(
    (): IDebugRenderTrackerProps => ({
      name: 'PerpPositionsList',
      position: 'top-left',
    }),
    [],
  );

  const renderDesktopHeaderCell = (column: IColumnConfig, index: number) => (
    <XStack
      key={`${column.key}-${index}`}
      {...getColumnStyle(column)}
      justifyContent={calcCellAlign(column.align) as any}
      cursor="default"
    >
      {column.tooltip ? (
        <Tooltip
          placement="top"
          renderTrigger={
            <SizableText
              size="$bodySmMedium"
              borderBottomWidth="$px"
              borderTopWidth={0}
              borderLeftWidth={0}
              borderRightWidth={0}
              borderBottomColor="$border"
              borderStyle="dashed"
              cursor="help"
              color="$textSubdued"
              textAlign={column.align || 'left'}
            >
              {column.title}
            </SizableText>
          }
          renderContent={column.tooltip}
        />
      ) : (
        <SizableText
          size="$bodySmMedium"
          borderBottomWidth="$px"
          borderBottomColor="transparent"
          color="$textSubdued"
          textAlign={column.align || 'left'}
        >
          {column.title}
        </SizableText>
      )}
    </XStack>
  );

  if (!isMobile && mockedPositions.length === 0) {
    return (
      <YStack flex={1} width="100%">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          nestedScrollEnabled
          contentContainerStyle={{
            minWidth: totalMinWidth,
            flexGrow: 1,
          }}
        >
          <XStack
            flex={1}
            py="$2"
            pl="$5"
            pr="$3"
            display="flex"
            minWidth={totalMinWidth}
            width="100%"
            borderBottomWidth="$px"
            borderBottomColor="$borderSubdued"
            bg="$bgSubtle"
          >
            {columnsConfig.map(renderDesktopHeaderCell)}
          </XStack>
        </ScrollView>
        <YStack flex={1} width="100%">
          <PerpPositionsEmptyState />
        </YStack>
      </YStack>
    );
  }

  return (
    <YStack flex={1} onLayout={(event) => handleTraceLayout('root', event)}>
      <CommonTableListView
        onPullToRefresh={async () => {
          await actions.current.refreshAllPerpsData();
        }}
        listViewDebugRenderTrackerProps={listViewDebugRenderTrackerProps}
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
        keyExtractor={keyExtractor}
        ListEmptyComponent={<PerpPositionsEmptyState isMobile={isMobile} />}
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
    </YStack>
  );
}

export { PerpPositionsList };
