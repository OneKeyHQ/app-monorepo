import { useCallback, useEffect, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { type IntlShape, useIntl } from 'react-intl';

import {
  Button,
  DashText,
  Divider,
  type IDebugRenderTrackerProps,
  Icon,
  Illustration,
  Popover,
  SizableText,
  Toast,
  Tooltip,
  XStack,
  YStack,
  useMedia,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
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
  useSpotPairDisplayNameMapAtom,
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

import { usePerpTwapHistoryViewAllUrl } from '../../../hooks/usePerpOrderInfoPanel';
import { PerpTestIDs } from '../../../testIDs';
import { buildHelpUrl, openGuideUrl } from '../../Guide/perpGuideData';
import { OrderInfoSubTabs } from '../Components/OrderInfoSubTabs';
import {
  calcCellAlign,
  getColumnStyle,
  getFillDirectionDisplayInfo,
  getOrderAssetDisplayName,
  getOrderSizeDisplayName,
  getTwapHistoryEventTimeMs,
  normalizeEpochMs,
} from '../utils';

import {
  CommonTableListView,
  type IColumnConfig,
  type IRenderMode,
} from './CommonTableListView';

const TWAP_PAGE_SIZE = 20;
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
    inline: `${date} ${time}`,
  };
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

function getTwapHistoryStatusText(
  status: ITwapHistoryRecord['status']['status'],
  intl: IntlShape,
) {
  const statusTextMap: Record<
    ITwapHistoryRecord['status']['status'],
    ETranslations
  > = {
    activated: ETranslations.perp_twap_status_activated__title,
    error: ETranslations.perp_twap_status_error__title,
    finished: ETranslations.perp_twap_status_finished__title,
    terminated: ETranslations.perp_twap_status_terminated__title,
  };
  return intl.formatMessage({ id: statusTextMap[status] });
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
  spotPairDisplayNameMap,
  intl,
}: {
  state: ITwapState;
  now: number;
  endTime?: number;
  spotDisplayMap: Record<string, string>;
  spotPairDisplayNameMap: Record<string, string>;
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
  const assetSymbol = getOrderAssetDisplayName(
    state.coin,
    spotDisplayMap,
    spotPairDisplayNameMap,
  );
  const sizeSymbol = getOrderSizeDisplayName(state.coin, spotDisplayMap);
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
    sizeWithSymbol: `${sizeFormatted} ${sizeSymbol}`,
    executedSizeWithSymbol: `${executedSizeFormatted} ${sizeSymbol}`,
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
    randomizeText: state.randomize
      ? intl.formatMessage({ id: ETranslations.perp_yes__title })
      : intl.formatMessage({ id: ETranslations.perp_no__title }),
  };
}

function MobileTwapHistoryInfoRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <XStack width="100%" alignItems="center" justifyContent="space-between">
      <SizableText size="$bodySm" color="$textSubdued">
        {label}
      </SizableText>
      <SizableText
        size="$bodySm"
        color={valueColor}
        numberOfLines={1}
        ellipsizeMode="tail"
        textAlign="right"
        maxWidth="60%"
      >
        {value}
      </SizableText>
    </XStack>
  );
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
  return getFillDirectionDisplayInfo({ fill, intl });
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
  const handleGuidePress = useCallback(() => {
    openGuideUrl(buildHelpUrl('articles/15442238'));
  }, []);

  if (isMobile) {
    return (
      <YStack flex={1} alignItems="center" p="$6">
        <SizableText size="$bodyMd" color="$textSubdued" textAlign="center">
          {intl.formatMessage({ id: titleId })}
        </SizableText>
        {description ? (
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            textAlign="center"
            mt="$2"
          >
            {description}
          </SizableText>
        ) : null}
        <SizableText
          testID={PerpTestIDs.TwapEmptyGuideButton}
          size="$bodySm"
          color="$textSubdued"
          textAlign="center"
          textDecorationLine="underline"
          mt="$2"
          onPress={handleGuidePress}
        >
          {intl.formatMessage({
            id: ETranslations.perp_twap_trading_guide__action,
          })}
        </SizableText>
      </YStack>
    );
  }

  const guideButton = (
    <Button
      testID={PerpTestIDs.TwapEmptyGuideButton}
      width={180}
      borderRadius="$full"
      size="small"
      h={28}
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
  spotPairDisplayNameMap,
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
  spotPairDisplayNameMap: Record<string, string>;
}) {
  const intl = useIntl();
  const { state } = order;
  const sideInfo = useMemo(() => getTwapSideInfo(state, intl), [intl, state]);
  const baseInfo = useMemo(
    () =>
      getTwapBaseInfo({
        state,
        now,
        spotDisplayMap,
        spotPairDisplayNameMap,
        intl,
      }),
    [intl, now, spotDisplayMap, spotPairDisplayNameMap, state],
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
          <XStack
            {...getColumnStyle(columnConfigs[6])}
            justifyContent={calcCellAlign(columnConfigs[6].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">{baseInfo.randomizeText}</SizableText>
          </XStack>
          <YStack
            {...getColumnStyle(columnConfigs[7])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[7].align)}
          >
            <SizableText size="$bodySm">{creationTime.inline}</SizableText>
          </YStack>
        </>
      ) : null}
      {shouldRenderRight ? (
        <XStack
          {...getColumnStyle(columnConfigs[8])}
          justifyContent={calcCellAlign(columnConfigs[8].align)}
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
  spotPairDisplayNameMap,
  isMobile,
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
  spotPairDisplayNameMap: Record<string, string>;
  isMobile?: boolean;
}) {
  const intl = useIntl();
  const { state } = record;
  const isActivated = record.status.status === 'activated';
  const endTime = isActivated ? undefined : normalizeEpochMs(record.time);
  const sideInfo = useMemo(() => getTwapSideInfo(state, intl), [intl, state]);
  const baseInfo = useMemo(
    () =>
      getTwapBaseInfo({
        state,
        now,
        endTime,
        spotDisplayMap,
        spotPairDisplayNameMap,
        intl,
      }),
    [endTime, intl, now, spotDisplayMap, spotPairDisplayNameMap, state],
  );
  const historyTime = useMemo(
    () => formatTwapDateTime(getTwapHistoryEventTimeMs(record)),
    [record],
  );
  const historyDisplayInfo = useMemo(
    () => ({
      executedSize: isActivated ? '--' : baseInfo.executedSizeWithSymbol,
      averagePrice: isActivated ? '--' : baseInfo.avgPriceFormatted,
      totalRuntime: formatTotalDuration(state.minutes, intl),
    }),
    [
      baseInfo.avgPriceFormatted,
      baseInfo.executedSizeWithSymbol,
      intl,
      isActivated,
      state.minutes,
    ],
  );
  const statusText = useMemo(() => {
    const statusDescription =
      record.status.status === 'error' ? record.status.description : undefined;
    const translatedStatus = getTwapHistoryStatusText(
      record.status.status,
      intl,
    );
    if (statusDescription) {
      return `${translatedStatus}: ${statusDescription}`;
    }
    return translatedStatus;
  }, [intl, record.status]);
  const bgColor = getTableRowBgColor({ isHovered, index });
  const shouldRenderLeft = renderMode === 'full' || renderMode === 'left';
  const shouldRenderRight = renderMode === 'full' || renderMode === 'right';

  if (isMobile) {
    let statusColor = '$textSubdued';
    if (record.status.status === 'error') {
      statusColor = '$red11';
    } else if (record.status.status === 'finished') {
      statusColor = '$green11';
    }

    return (
      <ListItem
        mx="$5"
        my="$2"
        p="$0"
        backgroundColor="$bgSubdued"
        flexDirection="column"
        alignItems="flex-start"
        borderRadius="$3"
      >
        <XStack
          px="$3"
          pt="$3"
          pb="$1"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
          gap="$3"
        >
          <YStack flex={1} gap="$1">
            <XStack gap="$2" alignItems="center" flexWrap="wrap">
              <SizableText size="$bodyMdMedium" numberOfLines={1}>
                {baseInfo.assetSymbol}
              </SizableText>
              <SizableText
                size="$bodySm"
                color={sideInfo.color}
                numberOfLines={1}
                ellipsizeMode="tail"
              >
                {sideInfo.text}
              </SizableText>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {historyTime.inline}
            </SizableText>
          </YStack>
          <YStack
            alignItems="flex-end"
            justifyContent="center"
            gap="$1"
            minWidth={72}
            maxWidth="42%"
          >
            <SizableText size="$bodySm" color="$textSubdued" textAlign="right">
              {intl.formatMessage({ id: ETranslations.global_status })}
            </SizableText>
            <SizableText
              size="$bodySmMedium"
              color={statusColor}
              numberOfLines={2}
              ellipsizeMode="tail"
              textAlign="right"
            >
              {statusText}
            </SizableText>
          </YStack>
        </XStack>
        <YStack
          px="$3"
          pt="$2.5"
          pb="$3"
          width="100%"
          gap="$2"
          borderTopWidth="$px"
          borderTopColor="$borderSubdued"
        >
          <MobileTwapHistoryInfoRow
            label={intl.formatMessage({
              id: ETranslations.defi_total_size,
            })}
            value={baseInfo.sizeWithSymbol}
          />
          <MobileTwapHistoryInfoRow
            label={intl.formatMessage({
              id: ETranslations.perp_executed_size__title,
            })}
            value={historyDisplayInfo.executedSize}
          />
          <MobileTwapHistoryInfoRow
            label={intl.formatMessage({
              id: ETranslations.perp_average_price__title,
            })}
            value={historyDisplayInfo.averagePrice}
          />
          <MobileTwapHistoryInfoRow
            label={intl.formatMessage({
              id: ETranslations.perp_twap_running_time__title,
            })}
            value={historyDisplayInfo.totalRuntime}
          />
          <MobileTwapHistoryInfoRow
            label={intl.formatMessage({ id: ETranslations.perps_reduce_only })}
            value={baseInfo.reduceOnlyText}
          />
          <MobileTwapHistoryInfoRow
            label={intl.formatMessage({
              id: ETranslations.perp_twap_random__title,
            })}
            value={baseInfo.randomizeText}
          />
        </YStack>
      </ListItem>
    );
  }

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
            <SizableText size="$bodySm">{historyTime.date}</SizableText>
            <SizableText size="$bodySm" color="$textSubdued">
              {historyTime.time}
            </SizableText>
          </YStack>
          <YStack
            {...getColumnStyle(columnConfigs[1])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[1].align)}
          >
            <SizableText size="$bodySmMedium" color={sideInfo.color}>
              {baseInfo.assetSymbol}
            </SizableText>
          </YStack>
          <XStack
            {...getColumnStyle(columnConfigs[2])}
            justifyContent={calcCellAlign(columnConfigs[2].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm" color={sideInfo.color}>
              {baseInfo.sizeWithSymbol}
            </SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[3])}
            justifyContent={calcCellAlign(columnConfigs[3].align)}
            alignItems="center"
          >
            <SizableText
              size="$bodySm"
              color={isActivated ? undefined : sideInfo.color}
            >
              {historyDisplayInfo.executedSize}
            </SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[4])}
            justifyContent={calcCellAlign(columnConfigs[4].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">
              {historyDisplayInfo.averagePrice}
            </SizableText>
          </XStack>
          <YStack
            {...getColumnStyle(columnConfigs[5])}
            justifyContent="center"
            alignItems={calcCellAlign(columnConfigs[5].align)}
          >
            <SizableText size="$bodySm">
              {historyDisplayInfo.totalRuntime}
            </SizableText>
          </YStack>
          <XStack
            {...getColumnStyle(columnConfigs[6])}
            justifyContent={calcCellAlign(columnConfigs[6].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">{baseInfo.reduceOnlyText}</SizableText>
          </XStack>
          <XStack
            {...getColumnStyle(columnConfigs[7])}
            justifyContent={calcCellAlign(columnConfigs[7].align)}
            alignItems="center"
          >
            <SizableText size="$bodySm">{baseInfo.randomizeText}</SizableText>
          </XStack>
        </>
      ) : null}
      {shouldRenderRight ? (
        <XStack
          {...getColumnStyle(columnConfigs[8])}
          justifyContent={calcCellAlign(columnConfigs[8].align)}
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
  spotPairDisplayNameMap,
  builderFeeRate,
  isMobile,
}: {
  record: ITwapSliceFill;
  cellMinWidth: number;
  columnConfigs: IColumnConfig[];
  index: number;
  renderMode?: IRenderMode;
  isHovered?: boolean;
  onHoverChange?: (index: number | null) => void;
  spotDisplayMap: Record<string, string>;
  spotPairDisplayNameMap: Record<string, string>;
  builderFeeRate?: number;
  isMobile?: boolean;
}) {
  const intl = useIntl();
  const { fill } = record;
  const dateInfo = useMemo(() => formatTwapDateTime(fill.time), [fill.time]);
  const assetSymbol = useMemo(
    () =>
      getOrderAssetDisplayName(
        fill.coin,
        spotDisplayMap,
        spotPairDisplayNameMap,
      ),
    [fill.coin, spotDisplayMap, spotPairDisplayNameMap],
  );
  const directionInfo = useMemo(
    () => getFillDirectionInfo(fill, intl),
    [fill, intl],
  );
  const fillInfo = useMemo(() => {
    const priceBN = new BigNumber(fill.px);
    const sizeBN = new BigNumber(fill.sz);
    const closePnlBN = new BigNumber(fill.closedPnl).minus(
      new BigNumber(fill.fee),
    );
    const closePnlColor = closePnlBN.lt(0) ? '$red11' : '$green11';
    const closePnlPlusOrMinus = closePnlBN.lt(0) ? '-' : '';
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
      closePnlFormatted: numberFormat(closePnlBN.abs().toFixed(), {
        formatter: 'value',
        formatterOptions: {
          currency: '$',
        },
      }),
      closePnlColor,
      closePnlPlusOrMinus,
    };
  }, [fill.closedPnl, fill.fee, fill.px, fill.sz]);
  const feeTooltipContent = useMemo(() => {
    const feeRatePercentage =
      builderFeeRate !== undefined
        ? `${(builderFeeRate / 1000).toFixed(2)}%`
        : '-';
    return (
      <YStack gap="$3">
        <YStack gap="$1.5">
          <SizableText size="$bodySm">
            {intl.formatMessage({ id: ETranslations.perps_fee_title })}
            {feeRatePercentage}
          </SizableText>
          <SizableText size="$bodySm">
            {intl.formatMessage({ id: ETranslations.perps_fee_total })}
            {fillInfo.feeFormatted}
          </SizableText>
        </YStack>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.perps_fee_desc })}
        </SizableText>
      </YStack>
    );
  }, [builderFeeRate, fillInfo.feeFormatted, intl]);
  const bgColor = getTableRowBgColor({ isHovered, index });
  const shouldRenderLeft = renderMode === 'full' || renderMode === 'left';
  const shouldRenderRight = renderMode === 'full' || renderMode === 'right';

  if (isMobile) {
    return (
      <ListItem
        mx="$5"
        my="$2"
        p="$0"
        backgroundColor="$bgSubdued"
        flexDirection="column"
        alignItems="flex-start"
        borderRadius="$3"
      >
        <XStack
          px="$3"
          pt="$3"
          justifyContent="space-between"
          alignItems="center"
          width="100%"
        >
          <YStack gap="$1">
            <XStack gap="$2" alignItems="center">
              <SizableText size="$bodyMdMedium">{assetSymbol}</SizableText>
              <SizableText size="$bodySm" color={directionInfo.color}>
                {directionInfo.text}
              </SizableText>
            </XStack>
            <SizableText size="$bodySm" color="$textSubdued">
              {dateInfo.date} {dateInfo.time}
            </SizableText>
          </YStack>
          <YStack gap="$1" alignItems="flex-end">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trades_close_pnl,
              })}
            </SizableText>
            <SizableText size="$bodySm" color={fillInfo.closePnlColor}>
              {`${fillInfo.closePnlPlusOrMinus}${fillInfo.closePnlFormatted}`}
            </SizableText>
          </YStack>
        </XStack>
        <Divider width="100%" borderColor="$borderSubdued" />
        <XStack
          px="$3"
          pt="$1"
          pb="$3"
          width="100%"
          alignItems="flex-start"
          justifyContent="space-around"
        >
          <YStack gap="$1" flex={1} alignItems="flex-start">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trades_history_price,
              })}
            </SizableText>
            <SizableText size="$bodySm">{fillInfo.priceFormatted}</SizableText>
          </YStack>
          <YStack gap="$1" flex={1} alignItems="flex-start">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_position_position_size,
              })}
            </SizableText>
            <SizableText size="$bodySm">{fillInfo.sizeFormatted}</SizableText>
          </YStack>
          <YStack gap="$1" flex={1} alignItems="flex-start">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trades_history_trade_value,
              })}
            </SizableText>
            <SizableText size="$bodySm">{fillInfo.valueFormatted}</SizableText>
          </YStack>
          <YStack gap="$1" flex={1} alignItems="flex-end">
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.perp_trades_history_fee,
              })}
            </SizableText>
            <Popover
              title={intl.formatMessage({
                id: ETranslations.perp_trades_history_fee,
              })}
              placement="top"
              renderTrigger={
                <DashText
                  size="$bodySm"
                  color="$textSubdued"
                  dashThickness={0.3}
                >
                  {fillInfo.feeFormatted}
                </DashText>
              }
              renderContent={() => (
                <YStack px="$5" pb="$4">
                  {feeTooltipContent}
                </YStack>
              )}
            />
          </YStack>
        </XStack>
      </ListItem>
    );
  }

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
            <Tooltip
              placement="top"
              renderTrigger={
                <DashText
                  size="$bodySm"
                  color="$textSubdued"
                  dashThickness={0.3}
                >
                  {fillInfo.feeFormatted}
                </DashText>
              }
              renderContent={feeTooltipContent}
            />
          </XStack>
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
            color={fillInfo.closePnlColor}
          >
            {`${fillInfo.closePnlPlusOrMinus}${fillInfo.closePnlFormatted}`}
          </SizableText>
        </XStack>
      ) : null}
    </XStack>
  );
}

interface IPerpTwapListProps {
  isMobile?: boolean;
  useTabsList?: boolean;
  disableListScroll?: boolean;
  initialTab?: ITwapPanelTab;
  enabledTabs?: ITwapPanelTab[];
}

function PerpTwapList({
  isMobile,
  useTabsList,
  disableListScroll,
  initialTab = 'active',
  enabledTabs,
}: IPerpTwapListProps) {
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
  const [spotPairDisplayNameMap] = useSpotPairDisplayNameMapAtom();
  const [activeTab, setActiveTab] = useState<ITwapPanelTab>(initialTab);
  const [currentListPage, setCurrentListPage] = useState(1);
  const [now, setNow] = useState(Date.now());
  const [builderFeeRate, setBuilderFeeRate] = useState<number | undefined>();
  const { onViewAllUrl } = usePerpTwapHistoryViewAllUrl();
  const enabledTabsSet = useMemo(
    () => new Set(enabledTabs ?? TWAP_ORDERS_SUB_TABS.map((tab) => tab.key)),
    [enabledTabs],
  );

  useEffect(() => {
    void backgroundApiProxy.simpleDb.perp
      .getExpectMaxBuilderFee()
      .then((fee) => {
        setBuilderFeeRate(fee);
      });
  }, []);

  useEffect(() => {
    void actions.current.loadTwapData();
  }, [actions, currentUser?.accountAddress]);

  useEffect(() => {
    if (!enabledTabsSet.has(activeTab)) {
      const firstEnabledTab = TWAP_ORDERS_SUB_TABS.find((tab) =>
        enabledTabsSet.has(tab.key),
      );
      if (firstEnabledTab) {
        setActiveTab(firstEnabledTab.key);
      }
    }
  }, [activeTab, enabledTabsSet]);

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
    return rawHistory;
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

  const twapBaseColumns: IColumnConfig[] = useMemo(
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
        key: 'randomize',
        title: intl.formatMessage({
          id: ETranslations.perp_twap_random__title,
        }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
    ],
    [intl],
  );

  const creationTimeColumn: IColumnConfig = useMemo(
    () => ({
      key: 'creationTime',
      title: intl.formatMessage({
        id: ETranslations.perp_creation_time__title,
      }),
      minWidth: 150,
      flex: 1,
      align: 'left',
    }),
    [intl],
  );

  const historyTimeColumn: IColumnConfig = useMemo(
    () => ({
      key: 'time',
      title: intl.formatMessage({ id: ETranslations.global_time }),
      minWidth: 130,
      flex: 1,
      align: 'left',
    }),
    [intl],
  );

  const activeColumns: IColumnConfig[] = useMemo(
    () => [
      ...twapBaseColumns,
      creationTimeColumn,
      {
        key: 'terminate',
        title: intl.formatMessage({
          id: ETranslations.perp_twap_terminate__action,
        }),
        minWidth: 100,
        flex: 1,
        align: 'right',
        fixed: true,
      },
    ],
    [creationTimeColumn, intl, twapBaseColumns],
  );

  const historyColumns: IColumnConfig[] = useMemo(
    () => [
      historyTimeColumn,
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
        key: 'sz',
        title: intl.formatMessage({
          id: ETranslations.defi_total_size,
        }),
        minWidth: 110,
        flex: 1,
        align: 'left',
      },
      {
        key: 'executedSz',
        title: intl.formatMessage({
          id: ETranslations.perp_executed_size__title,
        }),
        minWidth: 130,
        flex: 1,
        align: 'left',
      },
      {
        key: 'avgPx',
        title: intl.formatMessage({
          id: ETranslations.perp_average_price__title,
        }),
        minWidth: 140,
        flex: 1,
        align: 'left',
      },
      {
        key: 'totalRuntime',
        title: intl.formatMessage({
          id: ETranslations.perp_twap_running_time__title,
        }),
        minWidth: 140,
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
        key: 'randomize',
        title: intl.formatMessage({
          id: ETranslations.perp_twap_randomize__title,
        }),
        minWidth: 100,
        flex: 1,
        align: 'left',
      },
      {
        key: 'status',
        title: intl.formatMessage({ id: ETranslations.global_status }),
        minWidth: 130,
        flex: 1,
        align: 'right',
        fixed: true,
      },
    ],
    [historyTimeColumn, intl],
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
        title: intl.formatMessage({
          id: ETranslations.perp_trades_history_fee,
        }),
        minWidth: 110,
        flex: 1,
        align: 'left',
      },
      {
        key: 'closePnl',
        title: intl.formatMessage({ id: ETranslations.perp_trades_close_pnl }),
        minWidth: 100,
        flex: 1,
        align: 'right',
        fixed: true,
      },
    ],
    [intl],
  );

  const activeMinWidth = useMemo(
    () =>
      activeColumns.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [activeColumns],
  );
  const historyMinWidth = useMemo(
    () =>
      historyColumns.reduce(
        (sum, col) => sum + (col.width || col.minWidth || 0),
        0,
      ),
    [historyColumns],
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
        columnConfigs={activeColumns}
        onTerminate={() => void handleTerminate(item)}
        index={index}
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
        spotDisplayMap={spotDisplayMap}
        spotPairDisplayNameMap={spotPairDisplayNameMap}
      />
    ),
    [
      activeColumns,
      activeMinWidth,
      handleTerminate,
      now,
      spotDisplayMap,
      spotPairDisplayNameMap,
    ],
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
        cellMinWidth={historyMinWidth}
        columnConfigs={historyColumns}
        index={index}
        renderMode={renderMode}
        isHovered={isHovered}
        onHoverChange={onHoverChange}
        spotDisplayMap={spotDisplayMap}
        spotPairDisplayNameMap={spotPairDisplayNameMap}
        isMobile={isMobile}
      />
    ),
    [
      historyColumns,
      historyMinWidth,
      isMobile,
      now,
      spotDisplayMap,
      spotPairDisplayNameMap,
    ],
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
        spotPairDisplayNameMap={spotPairDisplayNameMap}
        builderFeeRate={builderFeeRate}
        isMobile={isMobile}
      />
    ),
    [
      builderFeeRate,
      fillColumns,
      fillMinWidth,
      isMobile,
      spotDisplayMap,
      spotPairDisplayNameMap,
    ],
  );

  const emptyState = TWAP_EMPTY_STATE_MAP[activeTab];
  const twapOrderSubTabs = useMemo(
    () =>
      TWAP_ORDERS_SUB_TABS.filter((tab) => enabledTabsSet.has(tab.key)).map(
        (tab) => ({
          key: tab.key,
          label: intl.formatMessage({ id: tab.labelId }),
        }),
      ),
    [enabledTabsSet, intl],
  );
  const historyViewAll = historyRows.length > 0 ? onViewAllUrl : undefined;
  const fillsViewAll =
    sliceFills.length > TWAP_PAGE_SIZE ? onViewAllUrl : undefined;

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
      {twapOrderSubTabs.length > 1 ? (
        <OrderInfoSubTabs
          tabs={twapOrderSubTabs}
          activeTab={activeTab}
          onChange={setActiveTab}
          variant="pill"
        />
      ) : null}
      {activeTab === 'active' ? (
        <CommonTableListView
          onPullToRefresh={refreshTwapData}
          listViewDebugRenderTrackerProps={trackerProps}
          useTabsList={useTabsList}
          disableListScroll={disableListScroll}
          enablePagination={false}
          columns={activeColumns}
          minTableWidth={activeMinWidth}
          data={twapOrders}
          isMobile={isMobile}
          paginationToBottom={isMobile}
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
          useTabsList={useTabsList}
          disableListScroll={disableListScroll}
          enablePagination
          pageSize={TWAP_PAGE_SIZE}
          currentListPage={currentListPage}
          setCurrentListPage={setCurrentListPage}
          columns={historyColumns}
          minTableWidth={historyMinWidth}
          data={historyRows}
          isMobile={isMobile}
          paginationToBottom={isMobile}
          renderRow={renderHistoryRow}
          onViewAll={historyViewAll}
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
          useTabsList={useTabsList}
          disableListScroll={disableListScroll}
          enablePagination
          pageSize={TWAP_PAGE_SIZE}
          currentListPage={currentListPage}
          setCurrentListPage={setCurrentListPage}
          columns={fillColumns}
          minTableWidth={fillMinWidth}
          data={sliceFills}
          isMobile={isMobile}
          paginationToBottom={isMobile}
          renderRow={renderFillRow}
          onViewAll={fillsViewAll}
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
