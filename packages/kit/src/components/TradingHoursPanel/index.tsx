import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  Icon,
  IconButton,
  Popover,
  SizableText,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
  useMedia,
} from '@onekeyhq/components';
import type { IKeyOfIcons } from '@onekeyhq/components';
import { useUSMarketStatus } from '@onekeyhq/kit/src/hooks/useUSMarketStatus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import {
  EUSMarketSessionKey,
  formatInstantAsLocalHHmm,
  formatSegmentLocalRange,
  getDeviceUtcOffsetLabel,
  getUSMarketTradingHours,
  isOndoUSMarketStock,
  resolveUSTradingHoursActiveRow,
} from '@onekeyhq/shared/src/utils/tradingHoursUtils';
import type { IUSTradingHoursRow } from '@onekeyhq/shared/src/utils/tradingHoursUtils';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

type ILiquidityLevel = 'high' | 'moderate' | 'low' | 'none';

const LIQUIDITY_LABELS: Record<ILiquidityLevel, ETranslations> = {
  high: ETranslations.kyt_risk_level_high__title,
  moderate: ETranslations.kyt_risk_level_moderate__title,
  low: ETranslations.kyt_risk_level_low__title,
  none: ETranslations.kyt_risk_level_none__title,
};

const LIQUIDITY_FILLED_BARS: Record<ILiquidityLevel, number> = {
  high: 4,
  moderate: 2,
  low: 1,
  none: 0,
};

const ROW_META: Array<{
  row: IUSTradingHoursRow;
  icon: IKeyOfIcons;
  titleId: ETranslations;
  liquidity: ILiquidityLevel;
}> = [
  {
    row: EUSMarketSessionKey.PreMarket,
    icon: 'SunriseOutline',
    titleId: ETranslations.trading_hours_pre_market,
    liquidity: 'moderate',
  },
  {
    row: EUSMarketSessionKey.Regular,
    icon: 'SunOutline',
    titleId: ETranslations.trading_hours_regular_market,
    liquidity: 'high',
  },
  {
    row: EUSMarketSessionKey.PostMarket,
    icon: 'SunDownOutline',
    titleId: ETranslations.trading_hours_post_market,
    liquidity: 'moderate',
  },
  {
    row: EUSMarketSessionKey.Overnight,
    icon: 'MoonOutline',
    titleId: ETranslations.trading_hours_overnight,
    liquidity: 'moderate',
  },
  {
    row: 'closed',
    icon: 'ClockSnoozeOutline',
    titleId: ETranslations.trading_hours_market_closed,
    liquidity: 'low',
  },
  {
    row: 'halts',
    icon: 'PauseOutline',
    titleId: ETranslations.trading_hours_trading_halts,
    liquidity: 'none',
  },
];

function LiquidityIndicator({
  level,
  isActive,
  dense,
}: {
  level: ILiquidityLevel;
  isActive: boolean;
  dense?: boolean;
}) {
  const intl = useIntl();
  const filled = LIQUIDITY_FILLED_BARS[level];
  const filledColor = isActive ? '$iconSuccess' : '$iconSubdued';
  return (
    <XStack gap="$1.5" alignItems="center">
      <SizableText size="$bodySm" color="$textDisabled">
        {intl.formatMessage({ id: LIQUIDITY_LABELS[level] })}
      </SizableText>
      <XStack gap={2} alignItems="center">
        {[0, 1, 2, 3].map((i) => (
          <Stack
            key={i}
            w={3}
            h={dense ? 8 : 10}
            borderRadius={1}
            bg={i < filled ? filledColor : '$neutral5'}
          />
        ))}
      </XStack>
    </XStack>
  );
}

function TradingHoursTimeline({
  segments,
  nowRatio,
  activeSessionKey,
  dimmed,
}: {
  segments: Array<{ key: EUSMarketSessionKey; ratio: number }>;
  nowRatio: number;
  activeSessionKey: EUSMarketSessionKey | undefined;
  dimmed: boolean;
}) {
  return (
    <Stack h={12} justifyContent="center">
      <XStack gap={2} alignItems="center">
        {segments.map((segment) => {
          const isActive = !dimmed && segment.key === activeSessionKey;
          return (
            <Stack
              key={segment.key}
              flexGrow={segment.ratio}
              flexBasis={0}
              h={isActive ? 6 : 4}
              borderRadius="$full"
              bg={isActive ? '$iconSuccess' : '$neutral5'}
            />
          );
        })}
      </XStack>
      {dimmed ? null : (
        <Stack
          position="absolute"
          left={`${nowRatio * 100}%`}
          ml={-6}
          w={12}
          h={12}
          borderRadius="$full"
          bg="$bg"
          borderWidth={2}
          borderColor="$iconSuccess"
        />
      )}
    </Stack>
  );
}

function SessionRow({
  icon,
  title,
  isActive,
  liquidity,
  dense,
  children,
}: {
  icon: IKeyOfIcons;
  title: string;
  isActive: boolean;
  liquidity: ILiquidityLevel;
  dense?: boolean;
  children: ReactNode;
}) {
  const intl = useIntl();
  return (
    <XStack
      gap={dense ? '$2' : '$2.5'}
      px={dense ? '$2.5' : '$3'}
      py={dense ? '$2' : '$2.5'}
      borderRadius={dense ? 10 : '$3'}
      bg={isActive ? '$bgSuccess' : undefined}
      alignItems="flex-start"
      w="100%"
    >
      <Stack
        w={dense ? '$4' : '$5'}
        h={dense ? '$5' : '$6'}
        alignItems="center"
        justifyContent="center"
      >
        <Icon name={icon} size={dense ? '$4' : '$5'} color="$icon" />
      </Stack>
      <YStack gap="$0.5" flex={1}>
        <XStack alignItems="center" justifyContent="space-between">
          <XStack gap="$1.5" alignItems="center">
            <SizableText size={dense ? '$bodyMdMedium' : '$bodyLgMedium'}>
              {title}
            </SizableText>
            {isActive ? (
              <Stack
                bg="$iconSuccess"
                borderRadius="$full"
                px={dense ? '$1' : '$1.5'}
                py={dense ? 1 : '$0.5'}
              >
                <SizableText
                  size={dense ? '$bodyXsMedium' : '$bodySmMedium'}
                  color="$textInverse"
                >
                  {intl.formatMessage({
                    id: ETranslations.trading_hours_regular_market_now,
                  })}
                </SizableText>
              </Stack>
            ) : null}
          </XStack>
          <LiquidityIndicator
            level={liquidity}
            isActive={isActive}
            dense={dense}
          />
        </XStack>
        {children}
      </YStack>
    </XStack>
  );
}

// Same title treatment on every surface (headingXl with the TZ chip right
// next to it) — only the list density differs between desktop and mobile.
function TradingHoursTitle() {
  const intl = useIntl();
  return (
    <XStack gap="$2" alignItems="center">
      <SizableText size="$headingXl">
        {intl.formatMessage({ id: ETranslations.trading_hours_title })}
      </SizableText>
      <Stack bg="$bgStrong" borderRadius={6} px="$2" py={3}>
        <SizableText size="$bodySm" color="$textSubdued">
          {getDeviceUtcOffsetLabel()}
        </SizableText>
      </Stack>
    </XStack>
  );
}

function TradingHoursContent({
  stock,
  showInlineHeader,
  dense,
}: {
  stock: IMarketStockInfo;
  // The desktop floating popover has no header of its own, so the panel
  // renders one inline; the mobile dialog brings its own header instead.
  showInlineHeader?: boolean;
  // Desktop popover uses the design's compact density (one type size down)
  dense?: boolean;
}) {
  const intl = useIntl();
  const marketStatus = useUSMarketStatus();
  const pagePx = dense ? '$4' : '$5';
  const detailTextSize = dense ? '$bodySm' : '$bodyMd';

  // Re-anchor all clock-derived values every minute while the panel is open.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(
      () => setNow(new Date()),
      timerUtils.getTimeDurationMs({ minute: 1 }),
    );
    return () => clearInterval(timer);
  }, []);

  const tradingHours = useMemo(() => getUSMarketTradingHours(now), [now]);

  const activeRow = resolveUSTradingHoursActiveRow({
    isOpen: stock.isOpen,
    isPaused: stock.isPaused,
    status: marketStatus,
    clockSessionKey: tradingHours.currentSessionKey,
  });
  const dimmed = activeRow === 'closed' || activeRow === 'halts';
  // 7×24 instrument while the market is closed: the subtitle switches to the
  // dedicated 24/7 copy, which also makes the generic risk notice redundant.
  const isClosedTradable = activeRow === 'closed' && stock.isOpen === true;

  const segmentByKey = useMemo(
    () =>
      new Map(tradingHours.segments.map((segment) => [segment.key, segment])),
    [tradingHours],
  );

  const weekendSpanText = useMemo(() => {
    const formatWeekendBoundary = (instant: number) =>
      intl.formatDate(new Date(instant), {
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
    return intl.formatMessage(
      { id: ETranslations.trading_hours_market_closed_time },
      {
        start: formatWeekendBoundary(tradingHours.weekendStartInstant),
        end: formatWeekendBoundary(tradingHours.weekendEndInstant),
      },
    );
  }, [intl, tradingHours]);

  return (
    <YStack pb={dense ? '$4' : '$5'} testID="trading-hours-panel">
      {showInlineHeader ? (
        <YStack px={pagePx} pt={dense ? '$4' : '$5'}>
          <TradingHoursTitle />
        </YStack>
      ) : null}
      <YStack px={pagePx} pt="$1">
        <SizableText size={detailTextSize} color="$textSubdued">
          {intl.formatMessage({
            id: isClosedTradable
              ? ETranslations.trading_hours_closed_tradable_description
              : ETranslations.trading_hours_description,
          })}
        </SizableText>
      </YStack>

      {/* The whole timeline is meaningless while closed/halted — hide it. */}
      {dimmed ? null : (
        <YStack px={pagePx} pt={dense ? '$3' : '$4'} pb="$1" gap="$1.5">
          <TradingHoursTimeline
            segments={tradingHours.segments}
            nowRatio={tradingHours.nowRatio}
            activeSessionKey={
              typeof activeRow === 'string' ? undefined : activeRow
            }
            dimmed={dimmed}
          />
          <Stack h={16}>
            {tradingHours.segments.map((segment) => {
              const leftRatio =
                (segment.startInstant - tradingHours.cycleStartInstant) /
                (tradingHours.cycleEndInstant - tradingHours.cycleStartInstant);
              return (
                <SizableText
                  key={segment.key}
                  position="absolute"
                  left={`${leftRatio * 100}%`}
                  size="$bodySm"
                  color="$textDisabled"
                >
                  {formatInstantAsLocalHHmm(segment.startInstant)}
                </SizableText>
              );
            })}
            <SizableText
              position="absolute"
              right={0}
              size="$bodySm"
              color="$textDisabled"
            >
              {formatInstantAsLocalHHmm(tradingHours.cycleEndInstant - 60_000)}
            </SizableText>
          </Stack>
        </YStack>
      )}

      <YStack px={dense ? '$1.5' : '$2'} pt="$1">
        {ROW_META.map(({ row, icon, titleId, liquidity }) => {
          const isActive = row === activeRow;
          const title = intl.formatMessage({ id: titleId });
          let detail: ReactNode;
          if (row === 'closed') {
            detail = (
              <SizableText size={detailTextSize} color="$textDisabled">
                {weekendSpanText}
              </SizableText>
            );
          } else if (row === 'halts') {
            detail = (
              <SizableText size={detailTextSize} color="$textDisabled">
                {intl.formatMessage({
                  id: ETranslations.trading_hours_trading_halts_description,
                })}
              </SizableText>
            );
          } else {
            const segment = segmentByKey.get(row);
            detail = (
              <SizableText size={detailTextSize} color="$textSubdued">
                {segment ? formatSegmentLocalRange(segment) : ''}
              </SizableText>
            );
          }
          return (
            <SessionRow
              key={row}
              icon={icon}
              title={title}
              isActive={isActive}
              liquidity={liquidity}
              dense={dense}
            >
              {detail}
            </SessionRow>
          );
        })}
      </YStack>

      {isClosedTradable ? null : (
        <YStack px={pagePx} pt="$2">
          <SizableText size="$bodySm" color="$textDisabled">
            {intl.formatMessage({
              id: ETranslations.trading_hours_risk_notice,
            })}
          </SizableText>
        </YStack>
      )}
    </YStack>
  );
}

function TradingHoursDialogHeader() {
  const dialogInstance = useDialogInstance();
  return (
    <XStack
      px="$5"
      pt="$5"
      pb="$1"
      alignItems="center"
      justifyContent="space-between"
    >
      <TradingHoursTitle />
      <IconButton
        icon="CrossedSmallOutline"
        size="small"
        variant="tertiary"
        onPress={() => {
          void dialogInstance.close();
        }}
        testID="trading-hours-dialog-close"
      />
    </XStack>
  );
}

function showTradingHoursDialog(stock: IMarketStockInfo) {
  Dialog.show({
    showHeader: false,
    showFooter: false,
    contentContainerProps: { px: '$0', pb: '$0' },
    renderContent: (
      <YStack>
        <TradingHoursDialogHeader />
        <TradingHoursContent stock={stock} />
      </YStack>
    ),
  });
}

/**
 * Trading-hours info panel (OK-58043): a floating popover on wide screens and
 * an edge-to-edge bottom-sheet dialog on native/small screens (the Popover's
 * own sheet form is an inset floating card, which does not match the design).
 * Wrap a trigger (usually the stock market-status chip) and it handles the
 * rest — session math, timezone conversion and refresh are all internal.
 */
export function TradingHoursTrigger({
  stock,
  renderTrigger,
}: {
  stock: IMarketStockInfo;
  renderTrigger: ReactNode;
}) {
  const media = useMedia();
  const useSheetDialog = platformEnv.isNative || media.md;

  // Trading hours only apply to Ondo's US-session model — other issuers
  // (xStocks etc.) run 7×24, so their badge stays a plain, non-tappable one.
  if (!isOndoUSMarketStock(stock.source)) {
    return <>{renderTrigger}</>;
  }

  if (useSheetDialog) {
    return (
      <Stack
        cursor="pointer"
        onPress={(e) => {
          // The chip often sits inside a pressable header row (which opens the
          // token selector) — keep this tap to ourselves.
          e.stopPropagation();
          showTradingHoursDialog(stock);
        }}
      >
        {renderTrigger}
      </Stack>
    );
  }

  return (
    <Popover
      title={<TradingHoursTitle />}
      renderTrigger={renderTrigger}
      renderContent={
        <TradingHoursContent stock={stock} showInlineHeader dense />
      }
      floatingPanelProps={{ w: 360 }}
    />
  );
}
