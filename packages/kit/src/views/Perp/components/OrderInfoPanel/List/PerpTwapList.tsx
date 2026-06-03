import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  type IDebugRenderTrackerProps,
  Icon,
  Illustration,
  SizableText,
  Toast,
  XStack,
  YStack,
  useMedia,
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
import { ETranslations } from '@onekeyhq/shared/src/locale';
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

import { PerpTestIDs } from '../../../testIDs';
import { buildHelpUrl, openGuideUrl } from '../../Guide/perpGuideData';
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
const TWAP_TABLE_ROW_MIN_HEIGHT = 48;

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

const TWAP_ORDERS_SUB_TABS: Array<{
  key: ITwapPanelTab;
  labelId: ETranslations;
}> = [
  { key: 'active', labelId: ETranslations.perp_twap_active__title },
  { key: 'history', labelId: ETranslations.perp_twap_history__title },
  { key: 'fills', labelId: ETranslations.perp_twap_fill_history__title },
];

const TWAP_EMPTY_STATE_MAP: Record<
  ITwapPanelTab,
  { titleId: ETranslations; description?: string }
> = {
  active: {
    titleId: ETranslations.perp_no_active_twap__title,
  },
  history: {
    titleId: ETranslations.perp_no_twap_history__title,
  },
  fills: {
    titleId: ETranslations.perp_no_twap_fill_history__title,
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

function formatTotalDuration(minutes: number, intl: IntlShape) {
  const minuteUnit = intl
    .formatMessage({ id: ETranslations.Limit_expire_minutes })
    .toLowerCase();
  const hourUnit = intl
    .formatMessage({ id: ETranslations.Limit_expire_hour })
    .toLowerCase();

  if (minutes < 60) {
    return `${minutes} ${minuteUnit}`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const hourText = `${hours} ${hourUnit}`;
  if (remainingMinutes === 0) {
    return hourText;
  }
  return `${hourText} ${remainingMinutes} ${minuteUnit}`;
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

function getTwapSideInfo(state: ITwapState, intl: IntlShape) {
  if (state.side === 'B') {
    return {
      text: state.reduceOnly
        ? intl.formatMessage({ id: ETranslations.perp_order_close_short })
        : intl.formatMessage({ id: ETranslations.perp_long }),
      color: '$green11',
    };
  }
  return {
    text: state.reduceOnly
      ? intl.formatMessage({ id: ETranslations.perp_order_close_long })
      : intl.formatMessage({ id: ETranslations.perp_short }),
    color: '$red11',
  };
}

function getTwapBaseInfo({
  state,
  now,
  endTime,
  spotDisplayMap,
  intl,
}: {
  state: ITwapState;
  now: number;
  endTime?: number;
  spotDisplayMap: Record<string, string>;
  intl: IntlShape;
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
      intl,
    )}`,
    reduceOnlyText: state.reduceOnly
      ? intl.formatMessage({ id: ETranslations.perp_yes__title })
      : intl.formatMessage({ id: ETranslations.perp_no__title }),
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

function getFillDirectionInfo(fill: IFill, intl: IntlShape) {
  let color = fill.side === 'B' ? '$green11' : '$red11';
  const directionType = getPerpFillDirectionType(fill.dir);
  let text = fill.dir;

  if (directionType === 'openLong') {
    text = intl.formatMessage({ id: ETranslations.perp_long });
  } else if (directionType === 'openShort') {
    text = intl.formatMessage({ id: ETranslations.perp_short });
  } else if (directionType === 'closeLong') {
    text = intl.formatMessage({ id: ETranslations.perp_order_close_long });
  } else if (directionType === 'closeShort') {
    text = intl.formatMessage({ id: ETranslations.perp_order_close_short });
  }

  if (fill.side === 'A') {
    color = '$red11';
  }

  return { text, color };
}

function TwapEmptyState({
  titleId,
  description,
}: {
  titleId: ETranslations;
  description?: string;
}) {
  const intl = useIntl();
  const { gtMd } = useMedia();
  const isMobile = !gtMd;
  const buttonHeight = isMobile ? 32 : 28;
  const handleGuidePress = useCallback(() => {
    openGuideUrl(buildHelpUrl('articles/13988742'));
  }, []);
  const guideButton = (
    <Button
      testID={PerpTestIDs.TwapEmptyGuideButton}
      width={180}
      borderRadius="$full"
      size="small"
      h={buttonHeight}
      px="$3"
      variant="secondary"
      onPress={handleGuidePress}
      childrenAsText={false}
    >
      <XStack gap="$1.5" alignItems="center">
        <Icon name="BookOpenOutline" size="$4" />
        <SizableText size="$bodySmMedium">
          {intl.formatMessage({
            id: ETranslations.perp_twap_trading_guide__action,
          })}
        </SizableText>
      </XStack>
    </Button>
  );

  return (
    <YStack
      flex={1}
      alignItems="center"
      justifyContent="center"
      minHeight={240}
      px="$5"
      py="$6"
    >
      <YStack
        width="100%"
        maxWidth={isMobile ? 320 : 420}
        gap="$2"
        alignItems="center"
      >
        <YStack
          h={isMobile ? 72 : 88}
          alignItems="center"
          overflow="visible"
          mb={isMobile ? -4 : -8}
        >
          <Illustration name="Orders" size={isMobile ? 100 : 124} />
        </YStack>
        <SizableText
          size={isMobile ? '$bodyXs' : '$bodySm'}
          color="$textSubdued"
          textAlign="center"
          maxWidth={isMobile ? 280 : 360}
        >
          {intl.formatMessage({ id: titleId })}
        </SizableText>
        {description ? (
          <SizableText
            size={isMobile ? '$bodyXs' : '$bodySm'}
            color="$textSubdued"
            textAlign="center"
            maxWidth={isMobile ? 280 : 360}
          >
            {description}
          </SizableText>
        ) : null}
        {guideButton}
      </YStack>
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
  const intl = useIntl();
  const { state } = order;
  const sideInfo = useMemo(() => getTwapSideInfo(state, intl), [intl, state]);
  const baseInfo = useMemo(
    () => getTwapBaseInfo({ state, now, spotDisplayMap, intl }),
    [intl, now, spotDisplayMap, state],
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
      minHeight={TWAP_TABLE_ROW_MIN_HEIGHT}
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
            {intl.formatMessage({
              id: ETranslations.perp_twap_terminate__action,
            })}
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
  const intl = useIntl();
  const { state } = record;
  const endTime =
    record.status.status === 'activated'
      ? undefined
      : normalizeEpochMs(record.time);
  const sideInfo = useMemo(() => getTwapSideInfo(state, intl), [intl, state]);
  const baseInfo = useMemo(
    () => getTwapBaseInfo({ state, now, endTime, spotDisplayMap, intl }),
    [endTime, intl, now, spotDisplayMap, state],
  );
  const creationTime = useMemo(
    () => formatTwapDateTime(state.timestamp),
    [state.timestamp],
  );
  const statusText = useMemo(() => {
    const statusDescription =
      record.status.status === 'error' ? record.status.description : undefined;
    const statusTextMap: Record<
      ITwapHistoryRecord['status']['status'],
      ETranslations
    > = {
      activated: ETranslations.perp_twap_status_activated__title,
      error: ETranslations.perp_twap_status_error__title,
      finished: ETranslations.perp_twap_status_finished__title,
      terminated: ETranslations.perp_twap_status_terminated__title,
    };
    const translatedStatus = intl.formatMessage({
      id: statusTextMap[record.status.status],
    });
    if (statusDescription) {
      return `${translatedStatus}: ${statusDescription}`;
    }
    return translatedStatus;
  }, [intl, record.status]);
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
      minHeight={TWAP_TABLE_ROW_MIN_HEIGHT}
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
  const intl = useIntl();
  const { fill } = record;
  const dateInfo = useMemo(() => formatTwapDateTime(fill.time), [fill.time]);
  const assetSymbol = useMemo(
    () => getTwapAssetDisplayName(fill.coin, spotDisplayMap),
    [fill.coin, spotDisplayMap],
  );
  const directionInfo = useMemo(
    () => getFillDirectionInfo(fill, intl),
    [fill, intl],
  );
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
      minHeight={TWAP_TABLE_ROW_MIN_HEIGHT}
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
  const intl = useIntl();
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
      {
        key: 'coin',
        title: intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        }),
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      {
        key: 'size',
        title: intl.formatMessage({
          id: ETranslations.perp_position_position_size,
        }),
        minWidth: 110,
        flex: 1,
        align: 'left',
      },
      {
        key: 'executedSize',
        title: intl.formatMessage({
          id: ETranslations.perp_executed_size__title,
        }),
        minWidth: 130,
        flex: 1,
        align: 'left',
      },
      {
        key: 'averagePrice',
        title: intl.formatMessage({
          id: ETranslations.perp_average_price__title,
        }),
        minWidth: 140,
        flex: 1,
        align: 'left',
      },
      {
        key: 'runningTime',
        title: intl.formatMessage({
          id: ETranslations.perp_twap_running_time_total__title,
        }),
        minWidth: 170,
        flex: 1,
        align: 'left',
      },
      {
        key: 'reduceOnly',
        title: intl.formatMessage({
          id: ETranslations.perps_reduce_only,
        }),
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      {
        key: 'creationTime',
        title: intl.formatMessage({
          id: ETranslations.perp_creation_time__title,
        }),
        minWidth: 150,
        flex: 1,
        align: 'left',
      },
      {
        key: activeTab === 'active' ? 'terminate' : 'status',
        title:
          activeTab === 'active'
            ? intl.formatMessage({
                id: ETranslations.perp_twap_terminate__action,
              })
            : intl.formatMessage({ id: ETranslations.global_status }),
        minWidth: activeTab === 'active' ? 100 : 130,
        flex: 1,
        align: 'right',
        fixed: true,
      },
    ],
    [activeTab, intl],
  );

  const fillColumns: IColumnConfig[] = useMemo(
    () => [
      {
        key: 'time',
        title: intl.formatMessage({ id: ETranslations.global_time }),
        minWidth: 130,
        flex: 1,
        align: 'left',
      },
      {
        key: 'coin',
        title: intl.formatMessage({
          id: ETranslations.perp_token_selector_asset,
        }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'direction',
        title: intl.formatMessage({
          id: ETranslations.perp_direction__title,
        }),
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      {
        key: 'price',
        title: intl.formatMessage({ id: ETranslations.global_price }),
        minWidth: 110,
        flex: 1,
        align: 'left',
      },
      {
        key: 'size',
        title: intl.formatMessage({
          id: ETranslations.perp_position_position_size,
        }),
        minWidth: 110,
        flex: 1,
        align: 'left',
      },
      {
        key: 'value',
        title: intl.formatMessage({
          id: ETranslations.perp_trades_history_trade_value,
        }),
        minWidth: 120,
        flex: 1,
        align: 'left',
      },
      {
        key: 'fee',
        title: intl.formatMessage({ id: ETranslations.perp_fee__title }),
        minWidth: 110,
        flex: 1,
        align: 'left',
      },
      {
        key: 'twapId',
        title: intl.formatMessage({ id: ETranslations.perp_twap_id__title }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
    ],
    [intl],
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
          Toast.message({
            title: intl.formatMessage({
              id: ETranslations.perp_token_info_not_found__msg,
            }),
          });
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
              : intl.formatMessage({
                  id: ETranslations.perp_failed_terminate_twap_order__msg,
                }),
        });
      }
    },
    [actions, intl],
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
  const twapOrderSubTabs = useMemo(
    () =>
      TWAP_ORDERS_SUB_TABS.map((tab) => ({
        key: tab.key,
        label: intl.formatMessage({ id: tab.labelId }),
      })),
    [intl],
  );
  const listEmptyComponent = useMemo(
    () => (
      <TwapEmptyState
        titleId={emptyState.titleId}
        description={emptyState.description}
      />
    ),
    [emptyState.description, emptyState.titleId],
  );

  return (
    <YStack flex={1}>
      <OrderInfoSubTabs
        tabs={twapOrderSubTabs}
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
          emptyMessage={intl.formatMessage({
            id: ETranslations.perp_no_active_twap__title,
          })}
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
          emptyMessage={intl.formatMessage({
            id: ETranslations.perp_no_twap_history__title,
          })}
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
          emptyMessage={intl.formatMessage({
            id: ETranslations.perp_no_twap_fill_history__title,
          })}
          emptySubMessage=""
        />
      ) : null}
    </YStack>
  );
}

export { PerpTwapList };
