import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';

import {
  type IDebugRenderTrackerProps,
  SizableText,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IPerpsActiveTwapOrder,
  useHyperliquidActions,
  usePerpsActiveTwapOrdersAtom,
  usePerpsTwapHistoryAtom,
  usePerpsTwapSliceFillsAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import {
  usePerpsActiveAccountAtom,
  useSpotPairDisplayMapAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { formatTime } from '@onekeyhq/shared/src/utils/dateUtils';
import type { INumberFormatProps } from '@onekeyhq/shared/src/utils/numberUtils';
import {
  formatLocalizedNumberString,
  numberFormat,
} from '@onekeyhq/shared/src/utils/numberUtils';
import { getValidPriceDecimals } from '@onekeyhq/shared/src/utils/perpsUtils';
import type {
  IFill,
  ITwapHistoryRecord,
  ITwapSliceFill,
  ITwapState,
} from '@onekeyhq/shared/types/hyperliquid/sdk';

import { OrderInfoSubTabs } from '../Components/OrderInfoSubTabs';
import {
  calcCellAlign,
  getColumnStyle,
  getPerpFillDirectionType,
  getTwapAssetDisplayName,
} from '../utils';

import {
  CommonTableListView,
  type IColumnConfig,
  type IRenderMode,
} from './CommonTableListView';

const TWAP_PAGE_SIZE = 40;

type ITwapPanelTab = 'active' | 'history' | 'fills';

type IFillWithOid = IFill & {
  oid?: number;
};

const balanceFormatter: INumberFormatProps = {
  formatter: 'balance',
};

const valueFormatter: INumberFormatProps = {
  formatter: 'balance',
  formatterOptions: {
    currency: '$',
  },
};

const TWAP_ORDERS_SUB_TABS: Array<{ key: ITwapPanelTab; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'history', label: 'History' },
  { key: 'fills', label: 'Fill History' },
];

const TWAP_EMPTY_STATE_MAP: Record<
  ITwapPanelTab,
  { title: string; description: string }
> = {
  active: {
    title: 'No active TWAP',
    description: 'Your active TWAP orders will appear here.',
  },
  history: {
    title: 'No TWAP history',
    description: 'Your TWAP history will appear here.',
  },
  fills: {
    title: 'No TWAP fill history',
    description: 'Your TWAP fill history will appear here.',
  },
};

function formatTwapDateTime(timestamp: number) {
  const timeDate = new Date(timestamp);
  const date = formatTime(timeDate, { formatTemplate: 'yyyy-LL-dd' });
  const time = formatTime(timeDate, { formatTemplate: 'HH:mm:ss' });
  return {
    date,
    time,
    inline: `${formatTime(timeDate, {
      formatTemplate: 'M/d/yyyy',
    })} - ${time}`,
  };
}

function normalizeEpochMs(timestamp: number | undefined) {
  if (!timestamp) {
    return undefined;
  }
  return timestamp > 1_000_000_000_000 ? timestamp : timestamp * 1000;
}

function formatElapsedDuration(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

function formatTotalDuration(minutes: number) {
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (remainingMinutes === 0) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

function getTableRowBgColor({
  isHovered,
  index,
}: {
  isHovered?: boolean;
  index: number;
}) {
  if (isHovered) {
    return '$bgHover';
  }
  return index % 2 === 1 ? '$bgSubdued' : '$bgApp';
}

function getTwapSideInfo(state: ITwapState) {
  if (state.side === 'B') {
    return {
      text: state.reduceOnly ? 'Close Short' : 'Long',
      color: '$green11',
    };
  }
  return {
    text: state.reduceOnly ? 'Close Long' : 'Short',
    color: '$red11',
  };
}

function getTwapBaseInfo({
  state,
  now,
  endTime,
  spotDisplayMap,
}: {
  state: ITwapState;
  now: number;
  endTime?: number;
  spotDisplayMap: Record<string, string>;
}) {
  const executedSize = new BigNumber(state.executedSz);
  const totalSize = new BigNumber(state.sz);
  const executedNotional = new BigNumber(state.executedNtl);
  const avgPrice =
    executedSize.gt(0) && executedNotional.gte(0)
      ? executedNotional.dividedBy(executedSize)
      : undefined;
  const avgPriceValue = avgPrice?.isFinite()
    ? avgPrice.toFixed(getValidPriceDecimals(avgPrice.toFixed()))
    : undefined;
  const assetSymbol = getTwapAssetDisplayName(state.coin, spotDisplayMap);
  const sizeFormatted = numberFormat(totalSize.toFixed(), balanceFormatter);
  const executedSizeFormatted = numberFormat(
    executedSize.toFixed(),
    balanceFormatter,
  );
  const totalMs = state.minutes * 60_000;
  const elapsedMs = Math.min(
    Math.max((endTime ?? now) - state.timestamp, 0),
    totalMs,
  );

  return {
    assetSymbol,
    sizeFormatted,
    executedSizeFormatted,
    sizeWithSymbol: `${sizeFormatted} ${assetSymbol}`,
    executedSizeWithSymbol: `${executedSizeFormatted} ${assetSymbol}`,
    avgPriceFormatted: avgPriceValue
      ? formatLocalizedNumberString(avgPriceValue)
      : '--',
    runningTimeText: `${formatElapsedDuration(elapsedMs)} / ${formatTotalDuration(
      state.minutes,
    )}`,
    reduceOnlyText: state.reduceOnly ? 'Yes' : 'No',
  };
}

function getFillKey(record: ITwapSliceFill) {
  const { fill, twapId } = record;
  const fillWithOid = fill as IFillWithOid;
  if (typeof fill.tid === 'number') {
    return `tid:${fill.tid}:${twapId}`;
  }
  return `${twapId}:${fill.hash}-${fillWithOid.oid ?? ''}-${fill.time}-${fill.coin}-${fill.side}-${fill.px}-${fill.sz}`;
}

function sortTwapSliceFills(fills: ITwapSliceFill[]) {
  return fills.toSorted(
    (a, b) =>
      b.fill.time - a.fill.time ||
      b.twapId - a.twapId ||
      (b.fill.tid ?? 0) - (a.fill.tid ?? 0),
  );
}

function getFillDirectionInfo(fill: IFill) {
  let color = fill.side === 'B' ? '$green11' : '$red11';
  const directionType = getPerpFillDirectionType(fill.dir);
  let text = fill.dir;

  if (directionType === 'openLong') {
    text = 'Long';
  } else if (directionType === 'openShort') {
    text = 'Short';
  } else if (directionType === 'closeLong') {
    text = 'Close Long';
  } else if (directionType === 'closeShort') {
    text = 'Close Short';
  }

  if (fill.side === 'A') {
    color = '$red11';
  }

  return { text, color };
}

function TwapEmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      minHeight={240}
      gap="$2"
    >
      <SizableText size="$bodyMdMedium" color="$text">
        {title}
      </SizableText>
      <SizableText size="$bodySm" color="$textSubdued">
        {description}
      </SizableText>
    </YStack>
  );
}

function TwapActiveRow({
  order,
  now,
  cellMinWidth,
  columnConfigs,
  onTerminate,
  index,
  renderMode = 'full',
  isHovered,
  onHoverChange,
  spotDisplayMap,
}: {
  order: IPerpsActiveTwapOrder;
  now: number;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  onTerminate: () => void;
  index: number;
  renderMode?: IRenderMode;
  isHovered?: boolean;
  onHoverChange?: (index: number | null) => void;
  spotDisplayMap: Record<string, string>;
}) {
  const { state } = order;
  const sideInfo = useMemo(() => getTwapSideInfo(state), [state]);
  const baseInfo = useMemo(
    () => getTwapBaseInfo({ state, now, spotDisplayMap }),
    [now, spotDisplayMap, state],
  );
  const creationTime = useMemo(
    () => formatTwapDateTime(state.timestamp),
    [state.timestamp],
  );
  const bgColor = getTableRowBgColor({ isHovered, index });
  const shouldRenderLeft = renderMode === 'full' || renderMode === 'left';
  const shouldRenderRight = renderMode === 'full' || renderMode === 'right';

  return (
    <XStack
      flex={1}
      py="$1.5"
      pl="$5"
      pr="$3"
      alignItems="center"
      backgroundColor={bgColor}
      onHoverIn={() => onHoverChange?.(index)}
      onHoverOut={() => onHoverChange?.(null)}
      minWidth={renderMode === 'full' ? cellMinWidth : undefined}
    >
      {shouldRenderLeft ? (
        <>
          <YStack
            {...getColumnStyle(columnConfigs[0])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[0].align)}
          >
            <SizableText size="$bodySmMedium" color={sideInfo.color}>
              {baseInfo.assetSymbol}
            </SizableText>
          </YStack>
          <XStack
            {...getColumnStyle(columnConfigs[1])}
            justifyContent={calcCellAlign(columnConfigs[1].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm" color={sideInfo.color}>
              {baseInfo.sizeWithSymbol}
            </SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[2])}
            justifyContent={calcCellAlign(columnConfigs[2].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm" color={sideInfo.color}>
              {baseInfo.executedSizeWithSymbol}
            </SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[3])}
            justifyContent={calcCellAlign(columnConfigs[3].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">
              {baseInfo.avgPriceFormatted}
            </SizableText>
          </XStack>
          <YStack
            {...getColumnStyle(columnConfigs[4])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[4].align)}
          >
            <SizableText size="$bodySm">{baseInfo.runningTimeText}</SizableText>
          </YStack>
          <XStack
            {...getColumnStyle(columnConfigs[5])}
            justifyContent={calcCellAlign(columnConfigs[5].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">{baseInfo.reduceOnlyText}</SizableText>
          </XStack>
          <YStack
            {...getColumnStyle(columnConfigs[6])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[6].align)}
          >
            <SizableText size="$bodySm">{creationTime.inline}</SizableText>
          </YStack>
        </>
      ) : null}
      {shouldRenderRight ? (
        <XStack
          {...getColumnStyle(columnConfigs[7])}
          justifyContent={calcCellAlign(columnConfigs[7].align)}
          alignItems="center"
          cursor="pointer"
        >
          <SizableText
            color="$red11"
            hoverStyle={{ size: '$bodySmMedium', fontWeight: 600 }}
            size="$bodySm"
            fontWeight={400}
            onPress={onTerminate}
          >
            Terminate
          </SizableText>
        </XStack>
      ) : null}
    </XStack>
  );
}

function TwapHistoryRow({
  record,
  now,
  cellMinWidth,
  columnConfigs,
  index,
  renderMode = 'full',
  isHovered,
  onHoverChange,
  spotDisplayMap,
}: {
  record: ITwapHistoryRecord;
  now: number;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  index: number;
  renderMode?: IRenderMode;
  isHovered?: boolean;
  onHoverChange?: (index: number | null) => void;
  spotDisplayMap: Record<string, string>;
}) {
  const { state } = record;
  const endTime =
    record.status.status === 'activated'
      ? undefined
      : normalizeEpochMs(record.time);
  const sideInfo = useMemo(() => getTwapSideInfo(state), [state]);
  const baseInfo = useMemo(
    () => getTwapBaseInfo({ state, now, endTime, spotDisplayMap }),
    [endTime, now, spotDisplayMap, state],
  );
  const creationTime = useMemo(
    () => formatTwapDateTime(state.timestamp),
    [state.timestamp],
  );
  const statusText =
    record.status.status === 'error'
      ? `Error${record.status.description ? `: ${record.status.description}` : ''}`
      : record.status.status.charAt(0).toUpperCase() +
        record.status.status.slice(1);
  const bgColor = getTableRowBgColor({ isHovered, index });
  const shouldRenderLeft = renderMode === 'full' || renderMode === 'left';
  const shouldRenderRight = renderMode === 'full' || renderMode === 'right';

  return (
    <XStack
      flex={1}
      py="$1.5"
      pl="$5"
      pr="$3"
      alignItems="center"
      backgroundColor={bgColor}
      onHoverIn={() => onHoverChange?.(index)}
      onHoverOut={() => onHoverChange?.(null)}
      minWidth={renderMode === 'full' ? cellMinWidth : undefined}
    >
      {shouldRenderLeft ? (
        <>
          <YStack
            {...getColumnStyle(columnConfigs[0])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[0].align)}
          >
            <SizableText size="$bodySmMedium" color={sideInfo.color}>
              {baseInfo.assetSymbol}
            </SizableText>
          </YStack>
          <XStack
            {...getColumnStyle(columnConfigs[1])}
            justifyContent={calcCellAlign(columnConfigs[1].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm" color={sideInfo.color}>
              {baseInfo.sizeWithSymbol}
            </SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[2])}
            justifyContent={calcCellAlign(columnConfigs[2].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm" color={sideInfo.color}>
              {baseInfo.executedSizeWithSymbol}
            </SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[3])}
            justifyContent={calcCellAlign(columnConfigs[3].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">
              {baseInfo.avgPriceFormatted}
            </SizableText>
          </XStack>
          <YStack
            {...getColumnStyle(columnConfigs[4])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[4].align)}
          >
            <SizableText size="$bodySm">{baseInfo.runningTimeText}</SizableText>
          </YStack>
          <XStack
            {...getColumnStyle(columnConfigs[5])}
            justifyContent={calcCellAlign(columnConfigs[5].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">{baseInfo.reduceOnlyText}</SizableText>
          </XStack>
          <YStack
            {...getColumnStyle(columnConfigs[6])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[6].align)}
          >
            <SizableText size="$bodySm">{creationTime.inline}</SizableText>
          </YStack>
        </>
      ) : null}
      {shouldRenderRight ? (
        <XStack
          {...getColumnStyle(columnConfigs[7])}
          justifyContent={calcCellAlign(columnConfigs[7].align)}
          alignItems="center"
        >
          <SizableText
            numberOfLines={1}
            ellipsizeMode="tail"
            size="$bodySm"
            color={record.status.status === 'error' ? '$red11' : '$text'}
          >
            {statusText}
          </SizableText>
        </XStack>
      ) : null}
    </XStack>
  );
}

function TwapFillRow({
  record,
  cellMinWidth,
  columnConfigs,
  index,
  renderMode = 'full',
  isHovered,
  onHoverChange,
  spotDisplayMap,
}: {
  record: ITwapSliceFill;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  index: number;
  renderMode?: IRenderMode;
  isHovered?: boolean;
  onHoverChange?: (index: number | null) => void;
  spotDisplayMap: Record<string, string>;
}) {
  const { fill } = record;
  const dateInfo = useMemo(() => formatTwapDateTime(fill.time), [fill.time]);
  const assetSymbol = useMemo(
    () => getTwapAssetDisplayName(fill.coin, spotDisplayMap),
    [fill.coin, spotDisplayMap],
  );
  const directionInfo = useMemo(() => getFillDirectionInfo(fill), [fill]);
  const fillInfo = useMemo(() => {
    const priceBN = new BigNumber(fill.px);
    const sizeBN = new BigNumber(fill.sz);
    const priceFormatted = priceBN.isFinite()
      ? priceBN.toFixed(getValidPriceDecimals(fill.px))
      : fill.px;
    return {
      priceFormatted,
      sizeFormatted: numberFormat(fill.sz, balanceFormatter),
      valueFormatted: numberFormat(
        priceBN.multipliedBy(sizeBN).toFixed(),
        valueFormatter,
      ),
      feeFormatted: numberFormat(fill.fee, valueFormatter),
    };
  }, [fill.fee, fill.px, fill.sz]);
  const bgColor = getTableRowBgColor({ isHovered, index });
  const shouldRenderLeft = renderMode === 'full' || renderMode === 'left';

  return (
    <XStack
      flex={1}
      py="$1.5"
      pl="$5"
      pr="$3"
      alignItems="center"
      backgroundColor={bgColor}
      onHoverIn={() => onHoverChange?.(index)}
      onHoverOut={() => onHoverChange?.(null)}
      minWidth={renderMode === 'full' ? cellMinWidth : undefined}
    >
      {shouldRenderLeft ? (
        <>
          <YStack
            {...getColumnStyle(columnConfigs[0])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[0].align)}
          >
            <SizableText size="$bodySm">{dateInfo.date}</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {dateInfo.time}
            </SizableText>
          </YStack>
          <XStack
            {...getColumnStyle(columnConfigs[1])}
            justifyContent={calcCellAlign(columnConfigs[1].align)}
            alignItems="center"
          >
            <SizableText size="$bodySmMedium">{assetSymbol}</SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[2])}
            justifyContent={calcCellAlign(columnConfigs[2].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm" color={directionInfo.color}>
              {directionInfo.text}
            </SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[3])}
            justifyContent={calcCellAlign(columnConfigs[3].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">{fillInfo.priceFormatted}</SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[4])}
            justifyContent={calcCellAlign(columnConfigs[4].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">{fillInfo.sizeFormatted}</SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[5])}
            justifyContent={calcCellAlign(columnConfigs[5].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">{fillInfo.valueFormatted}</SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[6])}
            justifyContent={calcCellAlign(columnConfigs[6].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm" color="$textSubdued">
              {fillInfo.feeFormatted}
            </SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[7])}
            justifyContent={calcCellAlign(columnConfigs[7].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">#{record.twapId}</SizableText>
          </XStack>
        </>
      ) : null}
    </XStack>
  );
}

function PerpTwapList() {
  const actions = useHyperliquidActions();
  const [
    { accountAddress: activeTwapAccountAddress, twapOrders: rawTwapOrders },
  ] = usePerpsActiveTwapOrdersAtom();
  const [{ accountAddress: historyAccountAddress, history: rawHistory }] =
    usePerpsTwapHistoryAtom();
  const [{ accountAddress: fillsAccountAddress, fills: rawSliceFills }] =
    usePerpsTwapSliceFillsAtom();
  const [currentUser] = usePerpsActiveAccountAtom();
  const [spotDisplayMap] = useSpotPairDisplayMapAtom();
  const [activeTab, setActiveTab] = useState<ITwapPanelTab>('active');
  const [currentListPage, setCurrentListPage] = useState(1);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    void actions.current.loadTwapData();
  }, [actions, currentUser?.accountAddress]);

  useEffect(() => {
    setCurrentListPage(1);
  }, [activeTab]);

  const currentAccountAddress = currentUser?.accountAddress?.toLowerCase();

  const twapOrders = useMemo(() => {
    if (
      !currentAccountAddress ||
      activeTwapAccountAddress?.toLowerCase() !== currentAccountAddress
    ) {
      return [];
    }
    return rawTwapOrders;
  }, [activeTwapAccountAddress, currentAccountAddress, rawTwapOrders]);

  useEffect(() => {
    if (activeTab !== 'active' || twapOrders.length === 0) {
      return undefined;
    }
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [activeTab, twapOrders.length]);

  const historyRows = useMemo(() => {
    if (
      !currentAccountAddress ||
      historyAccountAddress?.toLowerCase() !== currentAccountAddress
    ) {
      return [];
    }
    return rawHistory.filter((record) => record.status.status !== 'activated');
  }, [currentAccountAddress, historyAccountAddress, rawHistory]);

  const sliceFills = useMemo(() => {
    if (
      !currentAccountAddress ||
      fillsAccountAddress?.toLowerCase() !== currentAccountAddress
    ) {
      return [];
    }
    const byKey = new Map<string, ITwapSliceFill>();
    rawSliceFills.forEach((record) => byKey.set(getFillKey(record), record));
    return sortTwapSliceFills(Array.from(byKey.values()));
  }, [currentAccountAddress, fillsAccountAddress, rawSliceFills]);

  const twapColumns: IColumnConfig[] = useMemo(
    () => [
      { key: 'coin', title: 'Coin', minWidth: 120, flex: 1, align: 'left' },
      { key: 'size', title: 'Size', minWidth: 110, flex: 1, align: 'left' },
      {
        key: 'executedSize',
        title: 'Executed Size',
        minWidth: 130,
        flex: 1,
        align: 'left',
      },
      {
        key: 'averagePrice',
        title: 'Average Price',
        minWidth: 140,
        flex: 1,
        align: 'left',
      },
      {
        key: 'runningTime',
        title: 'Running Time / Total',
        minWidth: 170,
        flex: 1,
        align: 'left',
      },
      {
        key: 'reduceOnly',
        title: 'Reduce Only',
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      {
        key: 'creationTime',
        title: 'Creation Time',
        minWidth: 150,
        flex: 1,
        align: 'left',
      },
      {
        key: activeTab === 'active' ? 'terminate' : 'status',
        title: activeTab === 'active' ? 'Terminate' : 'Status',
        minWidth: activeTab === 'active' ? 100 : 130,
        flex: 1,
        align: 'right',
        fixed: true,
      },
    ],
    [activeTab],
  );

  const fillColumns: IColumnConfig[] = useMemo(
    () => [
      { key: 'time', title: 'Time', minWidth: 130, flex: 1, align: 'left' },
      { key: 'coin', title: 'Coin', minWidth: 100, flex: 1, align: 'left' },
      {
        key: 'direction',
        title: 'Direction',
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      { key: 'price', title: 'Price', minWidth: 110, flex: 1, align: 'left' },
      { key: 'size', title: 'Size', minWidth: 110, flex: 1, align: 'left' },
      { key: 'value', title: 'Value', minWidth: 120, flex: 1, align: 'left' },
      { key: 'fee', title: 'Fee', minWidth: 110, flex: 1, align: 'left' },
      {
        key: 'twapId',
        title: 'TWAP ID',
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
    ],
    [],
  );

  const activeMinWidth = useMemo(
    () =>
      twapColumns.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [twapColumns],
  );
  const fillMinWidth = useMemo(
    () =>
      fillColumns.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [fillColumns],
  );

  const handleTerminate = useCallback(
    async (order: IPerpsActiveTwapOrder) => {
      try {
        await actions.current.ensureTradingEnabled();
        const symbolMeta =
          await backgroundApiProxy.serviceHyperliquid.getSymbolMeta({
            coin: order.state.coin,
          });
        if (!symbolMeta) {
          Toast.message({ title: 'Token info not found' });
          return;
        }
        await actions.current
          .cancelTwapOrder({
            assetId: symbolMeta.assetId,
            twapId: order.twapId,
          })
          .catch(() => undefined);
      } catch (error) {
        Toast.error({
          title:
            error instanceof Error
              ? error.message
              : 'Failed to terminate TWAP order',
        });
      }
    },
    [actions],
  );

  const refreshTwapData = useCallback(async () => {
    await actions.current.loadTwapData();
  }, [actions]);

  const trackerProps = useMemo(
    (): IDebugRenderTrackerProps => ({
      name: `PerpTwapList_${activeTab}`,
      position: 'top-left',
    }),
    [activeTab],
  );

  const renderActiveRow = useCallback(
    (
      item: IPerpsActiveTwapOrder,
      index: number,
      renderMode?: IRenderMode,
      isHovered?: boolean,
      onHoverChange?: (index: number | null) => void,
    ) => (
      <TwapActiveRow
        order={item}
        now={now}
        cellMinWidth={activeMinWidth}
        columnConfigs={twapColumns}
        onTerminate={() => void handleTerminate(item)}
        index={index}
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
        spotDisplayMap={spotDisplayMap}
      />
    ),
    [activeMinWidth, handleTerminate, now, spotDisplayMap, twapColumns],
  );

  const renderHistoryRow = useCallback(
    (
      item: ITwapHistoryRecord,
      index: number,
      renderMode?: IRenderMode,
      isHovered?: boolean,
      onHoverChange?: (index: number | null) => void,
    ) => (
      <TwapHistoryRow
        record={item}
        now={now}
        cellMinWidth={activeMinWidth}
        columnConfigs={twapColumns}
        index={index}
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
        spotDisplayMap={spotDisplayMap}
      />
    ),
    [activeMinWidth, now, spotDisplayMap, twapColumns],
  );

  const renderFillRow = useCallback(
    (
      item: ITwapSliceFill,
      index: number,
      renderMode?: IRenderMode,
      isHovered?: boolean,
      onHoverChange?: (index: number | null) => void,
    ) => (
      <TwapFillRow
        record={item}
        cellMinWidth={fillMinWidth}
        columnConfigs={fillColumns}
        index={index}
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
        spotDisplayMap={spotDisplayMap}
      />
    ),
    [fillColumns, fillMinWidth, spotDisplayMap],
  );

  const emptyState = TWAP_EMPTY_STATE_MAP[activeTab];
  const listEmptyComponent = useMemo(
    () => (
      <TwapEmptyState
        title={emptyState.title}
        description={emptyState.description}
      />
    ),
    [emptyState.description, emptyState.title],
  );

  return (
    <YStack flex={1}>
      <OrderInfoSubTabs
        tabs={TWAP_ORDERS_SUB_TABS}
        activeTab={activeTab}
        onChange={setActiveTab}
        variant="underline"
      />
      {activeTab === 'active' ? (
        <CommonTableListView
          onPullToRefresh={refreshTwapData}
          listViewDebugRenderTrackerProps={trackerProps}
          useTabsList
          enablePagination
          pageSize={TWAP_PAGE_SIZE}
          currentListPage={currentListPage}
          setCurrentListPage={setCurrentListPage}
          columns={twapColumns}
          minTableWidth={activeMinWidth}
          data={twapOrders}
          renderRow={renderActiveRow}
          ListEmptyComponent={listEmptyComponent}
          emptyMessage="No TWAPs Yet"
          emptySubMessage=""
        />
      ) : null}
      {activeTab === 'history' ? (
        <CommonTableListView
          onPullToRefresh={refreshTwapData}
          listViewDebugRenderTrackerProps={trackerProps}
          useTabsList
          enablePagination
          pageSize={TWAP_PAGE_SIZE}
          currentListPage={currentListPage}
          setCurrentListPage={setCurrentListPage}
          columns={twapColumns}
          minTableWidth={activeMinWidth}
          data={historyRows}
          renderRow={renderHistoryRow}
          ListEmptyComponent={listEmptyComponent}
          emptyMessage="No TWAP History Yet"
          emptySubMessage=""
        />
      ) : null}
      {activeTab === 'fills' ? (
        <CommonTableListView
          onPullToRefresh={refreshTwapData}
          listViewDebugRenderTrackerProps={trackerProps}
          useTabsList
          enablePagination
          pageSize={TWAP_PAGE_SIZE}
          currentListPage={currentListPage}
          setCurrentListPage={setCurrentListPage}
          columns={fillColumns}
          minTableWidth={fillMinWidth}
          data={sliceFills}
          renderRow={renderFillRow}
          ListEmptyComponent={listEmptyComponent}
          emptyMessage="No TWAP Fills Yet"
          emptySubMessage=""
        />
      ) : null}
    </YStack>
  );
}

export { PerpTwapList };
