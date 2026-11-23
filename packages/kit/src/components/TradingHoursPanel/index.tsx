import type { ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { useWindowDimensions } from 'react-native';

import {
  Badge,
  Dialog,
  Divider,
  HeightTransition,
  Icon,
  IconButton,
  Popover,
  ScrollView,
  SizableText,
  Stack,
  XStack,
  YStack,
  useDialogInstance,
  useMedia,
} from '@onekeyhq/components';
import type { IColorTokens, IKeyOfIcons } from '@onekeyhq/components';
import useFormatDate from '@onekeyhq/kit/src/hooks/useFormatDate';
import { useInterval } from '@onekeyhq/kit/src/hooks/useInterval';
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
  getUSTradingHoursCountdown,
  resolveUSTradingHoursActiveRow,
} from '@onekeyhq/shared/src/utils/tradingHoursUtils';
import type {
  IUSMarketSessionSegment,
  IUSTradingHoursCountdown,
} from '@onekeyhq/shared/src/utils/tradingHoursUtils';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import type { GestureResponderEvent } from 'react-native';

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

// TODO: placeholder copy — replace with ETranslations keys once the final
// wording lands in the i18n source.
const PLACEHOLDER_COPY = {
  scope: 'Underlying stock market',
  sessionStartsIn: {
    [EUSMarketSessionKey.PreMarket]: 'Pre-market starts in',
    [EUSMarketSessionKey.Regular]: 'Regular trading starts in',
    [EUSMarketSessionKey.PostMarket]: 'Post-market starts in',
    [EUSMarketSessionKey.Overnight]: 'Overnight trading starts in',
  },
  regularEndsIn: 'Regular trading ends in',
  marketClosesIn: 'Market closes in',
  todayAt: (time: string) => `today at ${time}`,
  tomorrowAt: (time: string) => `tomorrow at ${time}`,
  weekdayAt: (weekday: string, time: string) => `${weekday} at ${time}`,
  closedNote: 'Closed on weekends and US market holidays.',
  timelineLabel: {
    [EUSMarketSessionKey.PreMarket]: 'Pre',
    [EUSMarketSessionKey.Regular]: 'Regular',
    [EUSMarketSessionKey.PostMarket]: 'Post',
    [EUSMarketSessionKey.Overnight]: 'Overnight',
  },
  thisSession: 'This session',
  nextSession: 'Next session',
  allTradingHours: 'All trading hours',
  footnote: 'Tokens may trade 24/7, depending on the provider.',
  duration: ({
    days,
    hours,
    minutes,
  }: {
    days: number;
    hours: number;
    minutes: number;
  }) => {
    // Two units at most, dropping a trailing zero unit ("6h", not "6h 0m").
    const [major, minor] = days
      ? [`${days}d`, hours ? `${hours}h` : '']
      : [hours ? `${hours}h` : '', hours && !minutes ? '' : `${minutes}m`];
    return [major, minor].filter(Boolean).join(' ');
  },
};

// `accent` / `accentBg` mirror the market-status chip of the same state
// (PerpsBadges STOCK_MARKET_STATUS_CHIPS) so the panel and the chip that
// opens it share one color per session; `solid` is the same hue's step 9,
// for the timeline segment and the "Now" tag.
const SESSION_META: Record<
  EUSMarketSessionKey,
  {
    icon: IKeyOfIcons;
    titleId: ETranslations;
    accent: IColorTokens;
    accentBg: IColorTokens;
    solid: IColorTokens;
  }
> = {
  [EUSMarketSessionKey.PreMarket]: {
    icon: 'SunriseOutline',
    titleId: ETranslations.trading_hours_pre_market,
    accent: '$orange11',
    accentBg: '$orange3',
    solid: '$orange9',
  },
  [EUSMarketSessionKey.Regular]: {
    icon: 'SunOutline',
    titleId: ETranslations.trading_hours_regular_market,
    accent: '$iconSuccess',
    accentBg: '$bgSuccess',
    solid: '$bgSuccessStrong',
  },
  [EUSMarketSessionKey.PostMarket]: {
    icon: 'SunDownOutline',
    titleId: ETranslations.trading_hours_post_market,
    accent: '$iconInfo',
    accentBg: '$bgInfo',
    solid: '$bgInfoStrong',
  },
  [EUSMarketSessionKey.Overnight]: {
    icon: 'MoonOutline',
    titleId: ETranslations.trading_hours_overnight,
    accent: '$purple11',
    accentBg: '$purple3',
    solid: '$purple9',
  },
};

const SESSION_ORDER = [
  EUSMarketSessionKey.PreMarket,
  EUSMarketSessionKey.Regular,
  EUSMarketSessionKey.PostMarket,
  EUSMarketSessionKey.Overnight,
];

const isSameLocalDay = (a: number, b: number) =>
  new Date(a).toDateString() === new Date(b).toDateString();

/** A session whose inclusive display end lands on a later local day. */
const isSegmentCrossingLocalDay = (segment: IUSMarketSessionSegment) =>
  !isSameLocalDay(segment.startInstant, segment.endInstant - MINUTE_MS);

type ITimelineMarker =
  // `fraction` is the position inside the session, 0..1.
  | { type: 'now'; key: EUSMarketSessionKey; fraction: number }
  // Inter-session gap: a bare line right before the upcoming session.
  | { type: 'gap'; key: EUSMarketSessionKey };

const ANIMATE_ONLY_TRANSFORM = ['transform'];

const NOW_LINE_WIDTH = 4;
const NOW_TAG_SPACE = 28;
const NOW_LINE_OVERHANG = 4;

function TradingHoursTimeline({
  segments,
  activeSessionKey,
  marker,
}: {
  segments: IUSMarketSessionSegment[];
  /** Colored segment; none while the market is closed. */
  activeSessionKey?: EUSMarketSessionKey;
  marker?: ITimelineMarker;
}) {
  const intl = useIntl();
  let pt = 0;
  if (marker?.type === 'now') {
    pt = NOW_TAG_SPACE;
  } else if (marker) {
    pt = NOW_LINE_OVERHANG;
  }
  return (
    <YStack gap="$2" pt={pt} testID="trading-hours-timeline">
      <XStack gap={2}>
        {segments.map((segment) => {
          const isActive = segment.key === activeSessionKey;
          const meta = SESSION_META[segment.key];
          const segmentMarker = marker?.key === segment.key ? marker : null;
          return (
            <Stack
              key={segment.key}
              flexGrow={segment.ratio}
              flexBasis={0}
              h="$2"
              borderRadius="$1"
              bg={isActive ? meta.solid : '$bgStrong'}
            >
              {segmentMarker ? (
                // Zero-width anchor at the marker position: the line and the
                // tag center on it without knowing the segment's pixel width.
                <Stack
                  position="absolute"
                  left={
                    segmentMarker.type === 'now'
                      ? `${segmentMarker.fraction * 100}%`
                      : -1
                  }
                  top={-NOW_LINE_OVERHANG}
                  w={0}
                  alignItems="center"
                >
                  {/* 1px surface-colored edges keep the line legible where
                      it crosses the segment. */}
                  <Stack
                    w={NOW_LINE_WIDTH}
                    h="$4"
                    px={1}
                    bg="$bg"
                    testID="trading-hours-now-line"
                  >
                    <Stack
                      flex={1}
                      bg={segmentMarker.type === 'now' ? meta.accent : '$text'}
                    />
                  </Stack>
                  {segmentMarker.type === 'now' ? (
                    <Stack
                      position="absolute"
                      top={NOW_LINE_OVERHANG - NOW_TAG_SPACE}
                      px="$1.5"
                      py="$0.5"
                      borderRadius="$full"
                      bg={meta.solid}
                    >
                      <SizableText
                        size="$bodySmMedium"
                        color="$textInverse"
                        numberOfLines={1}
                      >
                        {intl.formatMessage({
                          id: ETranslations.trading_hours_regular_market_now,
                        })}
                      </SizableText>
                    </Stack>
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          );
        })}
      </XStack>
      <XStack gap={2}>
        {segments.map((segment) => {
          const isActive = segment.key === activeSessionKey;
          return (
            <SizableText
              key={segment.key}
              flexGrow={segment.ratio}
              flexBasis={0}
              textAlign="center"
              numberOfLines={1}
              size={isActive ? '$bodySmMedium' : '$bodySm'}
              color={isActive ? '$text' : '$textSubdued'}
            >
              {PLACEHOLDER_COPY.timelineLabel[segment.key]}
            </SizableText>
          );
        })}
      </XStack>
    </YStack>
  );
}

function SessionRange({
  segment,
  prefix,
  emphasized,
}: {
  segment: IUSMarketSessionSegment;
  /** Weekday shown when the session is not today's. */
  prefix?: string;
  emphasized?: boolean;
}) {
  const range = formatSegmentLocalRange(segment);
  return (
    <XStack gap="$0.5" alignItems="flex-start">
      <SizableText
        size={emphasized ? '$bodyMdMedium' : '$bodySm'}
        color={emphasized ? '$text' : '$textSubdued'}
      >
        {prefix ? `${prefix} ${range}` : range}
      </SizableText>
      {isSegmentCrossingLocalDay(segment) ? (
        <SizableText size="$bodySm" color="$textDisabled">
          +1
        </SizableText>
      ) : null}
    </XStack>
  );
}

type ITradingHoursHeadline = {
  icon: IKeyOfIcons;
  iconColor: IColorTokens;
  title: string;
};

function TradingHoursContent({
  stock,
  headerRight,
  dense,
}: {
  stock: IMarketStockInfo;
  /** Trailing header slot — the mobile dialog puts its close button here. */
  headerRight?: ReactNode;
  // Desktop popover uses the design's compact padding.
  dense?: boolean;
}) {
  const intl = useIntl();
  const { format } = useFormatDate();
  const [isExpanded, setIsExpanded] = useState(false);

  // Re-anchor all clock-derived values every minute while the panel is open.
  const [now, setNow] = useState(() => new Date());
  useInterval(
    () => setNow(new Date()),
    timerUtils.getTimeDurationMs({ minute: 1 }),
  );
  const nowMs = now.getTime();

  const tradingHours = useMemo(() => getUSMarketTradingHours(now), [now]);

  const marketStatus = useUSMarketStatus();
  const activeRow = resolveUSTradingHoursActiveRow({
    status: marketStatus,
    isOpen: stock.isOpen,
    isPaused: stock.isPaused,
    tradingHours,
    now,
  });
  const isInWeekend =
    nowMs >= tradingHours.weekendStartInstant &&
    nowMs < tradingHours.weekendEndInstant;
  // The session the timeline and the row color follow. A halt keeps pointing
  // at the clock session it interrupts; a closure points at none.
  let sessionKey: EUSMarketSessionKey | undefined;
  if (activeRow === 'halts') {
    sessionKey = isInWeekend ? undefined : tradingHours.currentSessionKey;
  } else if (activeRow !== 'closed') {
    sessionKey = activeRow;
  }
  const sessionMeta = sessionKey ? SESSION_META[sessionKey] : undefined;
  const sessionSegment = tradingHours.segments.find(
    (s) => s.key === sessionKey,
  );
  const isAwaitingOpen =
    activeRow !== 'halts' && !!sessionKey && tradingHours.isNowInSessionGap;
  // 7×24 instrument while the market is closed (the "24/7" chip state): the
  // note switches to the dedicated around-the-clock copy, which also makes
  // the generic footnote redundant.
  // A US listing is never 7×24; its `isOpen` only disagrees when stale.
  const is247TradableClosed =
    activeRow === 'closed' && stock.isOpen === true && !stock.isUSListing;

  const countdown = useMemo<IUSTradingHoursCountdown | undefined>(
    () =>
      getUSTradingHoursCountdown({
        activeRow,
        tradingHours,
        nextOpenTime: stock.nextOpenTime,
        now,
      }),
    [activeRow, tradingHours, stock.nextOpenTime, now],
  );

  let headline: ITradingHoursHeadline;
  if (activeRow === 'halts') {
    headline = {
      icon: 'PauseOutline',
      iconColor: '$iconCritical',
      title: intl.formatMessage({
        id: ETranslations.trading_hours_trading_halts,
      }),
    };
  } else if (activeRow === 'closed' || !sessionMeta) {
    headline = {
      icon: 'ClockSnoozeOutline',
      iconColor: '$iconSubdued',
      title: intl.formatMessage({
        id: ETranslations.trading_hours_market_closed,
      }),
    };
  } else if (isAwaitingOpen) {
    headline = {
      icon: 'StopwatchOutline',
      iconColor: '$iconCaution',
      title: intl.formatMessage({
        id: ETranslations.label_market_awaiting_open,
      }),
    };
  } else {
    headline = {
      icon: sessionMeta.icon,
      iconColor: sessionMeta.accent,
      title: intl.formatMessage({ id: sessionMeta.titleId }),
    };
  }

  const countdownView = useMemo(() => {
    if (!countdown) {
      return undefined;
    }
    let label: string;
    if (countdown.kind === 'sessionEnds') {
      label = PLACEHOLDER_COPY.regularEndsIn;
    } else if (countdown.kind === 'marketCloses' || !countdown.segment) {
      label = PLACEHOLDER_COPY.marketClosesIn;
    } else {
      label = PLACEHOLDER_COPY.sessionStartsIn[countdown.segment.key];
    }
    // Round up so the final partial minute reads "1m", never "0m".
    const totalMinutes = Math.max(
      1,
      Math.ceil((countdown.targetInstant - nowMs) / MINUTE_MS),
    );
    // Closing boundaries are exclusive — show the last traded minute, the
    // same way the session ranges do.
    const displayInstant =
      countdown.kind === 'sessionStarts'
        ? countdown.targetInstant
        : countdown.targetInstant - MINUTE_MS;
    const time = formatInstantAsLocalHHmm(displayInstant);
    let at: string;
    if (isSameLocalDay(displayInstant, nowMs)) {
      at = PLACEHOLDER_COPY.todayAt(time);
    } else if (isSameLocalDay(displayInstant, nowMs + DAY_MS)) {
      at = PLACEHOLDER_COPY.tomorrowAt(time);
    } else {
      at = PLACEHOLDER_COPY.weekdayAt(
        format(new Date(displayInstant), 'EEE'),
        time,
      );
    }
    return {
      label,
      value: PLACEHOLDER_COPY.duration({
        days: Math.floor(totalMinutes / (24 * 60)),
        hours: Math.floor((totalMinutes % (24 * 60)) / 60),
        minutes: totalMinutes % 60,
      }),
      at,
    };
  }, [countdown, format, nowMs]);

  // The badge used to surface `stock.description` via a hover tooltip; the
  // panel replaces that tooltip, so re-surface the note here. Only the first
  // line is shown — it carries the localized "Opens in …" countdown, while the
  // remaining lines repeat boilerplate the panel already covers.
  const stockStatusNote = useMemo(
    () => stock.description?.split('\n')[0]?.trim() || undefined,
    [stock.description],
  );
  let note: string | undefined;
  if (activeRow === 'closed') {
    if (is247TradableClosed) {
      note = intl.formatMessage({
        id: ETranslations.trading_hours_closed_tradable_description,
      });
    } else {
      // Without a reopen time of our own (a holiday the clock cannot see),
      // fall back to the backend's countdown line.
      note = countdownView
        ? PLACEHOLDER_COPY.closedNote
        : (stockStatusNote ?? PLACEHOLDER_COPY.closedNote);
    }
  } else if (activeRow !== 'halts' && stock.isOpen === false) {
    // Per-stock closed while the market-wide session is open.
    note = stockStatusNote;
  }

  let marker: ITimelineMarker | undefined;
  if (sessionKey && sessionSegment) {
    if (tradingHours.isNowInSessionGap) {
      marker = { type: 'gap', key: sessionKey };
    } else {
      marker = {
        type: 'now',
        key: sessionKey,
        fraction: Math.min(
          1,
          Math.max(
            0,
            (nowMs - sessionSegment.startInstant) /
              (sessionSegment.endInstant - sessionSegment.startInstant),
          ),
        ),
      };
    }
  }

  // Collapsed row: the running session, or the one that opens next.
  const isUpcomingRow = activeRow === 'closed' || isAwaitingOpen;
  const rowSegment =
    activeRow === 'closed' ? countdown?.segment : sessionSegment;
  const rowPrefix =
    rowSegment && !isSameLocalDay(rowSegment.startInstant, nowMs)
      ? format(new Date(rowSegment.startInstant), 'EEE')
      : undefined;
  const toggleExpanded = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    setIsExpanded((value) => !value);
  }, []);

  const pagePx = dense ? '$4' : '$5';
  return (
    <YStack
      p={pagePx}
      // The sheet's bottom edge sits over the body — keep the footnote clear.
      pb={dense ? pagePx : '$10'}
      gap="$5"
      testID="trading-hours-panel"
    >
      <YStack gap="$3.5">
        <XStack gap="$2" alignItems="center">
          {/* With a trailing slot (the dialog's close button) the time-zone
              badge stays next to the label instead of crowding the button. */}
          <SizableText
            flex={headerRight ? undefined : 1}
            flexShrink={1}
            size="$bodySmMedium"
            color="$textSubdued"
          >
            {PLACEHOLDER_COPY.scope}
          </SizableText>
          <Badge badgeSize="sm">{getDeviceUtcOffsetLabel()}</Badge>
          {headerRight ? (
            <XStack flex={1} justifyContent="flex-end">
              {headerRight}
            </XStack>
          ) : null}
        </XStack>
        <YStack gap="$3">
          <XStack gap="$2" alignItems="center">
            <Icon name={headline.icon} size="$7" color={headline.iconColor} />
            <SizableText flex={1} size="$heading2xl">
              {headline.title}
            </SizableText>
          </XStack>
          <YStack gap="$1">
            {activeRow === 'halts' ? (
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.trading_hours_trading_halts_description,
                })}
              </SizableText>
            ) : null}
            {countdownView ? (
              <>
                <SizableText size="$bodyMdMedium" color="$textSubdued">
                  {countdownView.label}
                </SizableText>
                <XStack
                  gap="$2.5"
                  alignItems="baseline"
                  testID="trading-hours-countdown"
                >
                  <SizableText size="$heading2xl">
                    {countdownView.value}
                  </SizableText>
                  <SizableText size="$bodyMdMedium" color="$textSubdued">
                    {countdownView.at}
                  </SizableText>
                </XStack>
              </>
            ) : null}
            {note ? (
              <SizableText size="$bodySm" color="$textSubdued">
                {note}
              </SizableText>
            ) : null}
          </YStack>
        </YStack>
      </YStack>

      <YStack gap="$3.5">
        <TradingHoursTimeline
          segments={tradingHours.segments}
          activeSessionKey={sessionKey}
          marker={marker}
        />
        <YStack>
          <XStack
            gap="$2"
            py="$2.5"
            pl="$3"
            pr="$2"
            borderRadius="$3"
            alignItems="center"
            bg={
              isExpanded ? undefined : (sessionMeta?.accentBg ?? '$bgSubdued')
            }
            pressStyle={{ opacity: 0.8 }}
            cursor="pointer"
            userSelect="none"
            onPress={toggleExpanded}
            testID="trading-hours-session-row"
          >
            <SizableText flex={1} size="$bodyMdMedium">
              {(() => {
                if (isExpanded) {
                  return PLACEHOLDER_COPY.allTradingHours;
                }
                return isUpcomingRow
                  ? PLACEHOLDER_COPY.nextSession
                  : PLACEHOLDER_COPY.thisSession;
              })()}
            </SizableText>
            {!isExpanded && rowSegment ? (
              <SessionRange
                segment={rowSegment}
                prefix={rowPrefix}
                emphasized
              />
            ) : null}
            <Stack
              transition="popoverQuick"
              animateOnly={ANIMATE_ONLY_TRANSFORM}
              rotate={isExpanded ? '180deg' : '0deg'}
            >
              <Icon
                name="ChevronDownSmallOutline"
                size="$5"
                color="$iconSubdued"
              />
            </Stack>
          </XStack>
          {/* Kept mounted so the height animates both ways, the same way the
              swap quote details expand. */}
          <HeightTransition hide={!isExpanded}>
            <YStack
              testID="trading-hours-session-list"
              pointerEvents={isExpanded ? 'auto' : 'none'}
              aria-hidden={!isExpanded}
              accessibilityElementsHidden={!isExpanded}
              importantForAccessibility={
                isExpanded ? 'auto' : 'no-hide-descendants'
              }
            >
              {SESSION_ORDER.map((key) => {
                const meta = SESSION_META[key];
                const segment = tradingHours.segments.find(
                  (s) => s.key === key,
                );
                const isActive = key === sessionKey;
                return (
                  <XStack
                    key={key}
                    gap="$2.5"
                    px="$3"
                    py="$2"
                    borderRadius="$3"
                    alignItems="center"
                    bg={isActive ? meta.accentBg : undefined}
                  >
                    <Icon
                      name={meta.icon}
                      size="$4"
                      color={isActive ? meta.accent : '$iconSubdued'}
                    />
                    <SizableText flex={1} size="$bodyMdMedium">
                      {intl.formatMessage({ id: meta.titleId })}
                    </SizableText>
                    {segment ? (
                      <SessionRange segment={segment} emphasized={isActive} />
                    ) : null}
                  </XStack>
                );
              })}
            </YStack>
          </HeightTransition>
        </YStack>
        {is247TradableClosed ? null : (
          <>
            <Divider />
            <SizableText size="$bodySm" color="$textSubdued">
              {PLACEHOLDER_COPY.footnote}
            </SizableText>
          </>
        )}
      </YStack>
    </YStack>
  );
}

function TradingHoursDialogCloseButton() {
  const dialogInstance = useDialogInstance();
  return (
    <IconButton
      icon="CrossedSmallOutline"
      size="small"
      variant="tertiary"
      onPress={() => {
        void dialogInstance.close();
      }}
      testID="trading-hours-dialog-close"
    />
  );
}

// Sheet chrome above the scrollable body: grabber + a top gap.
const DIALOG_BODY_RESERVED_HEIGHT = 96;
// Keep a usable body even on absurdly short windows.
const DIALOG_BODY_MIN_HEIGHT = 240;

/**
 * The sheet dialog uses `snapPointsMode="fit"`, so a panel taller than the
 * viewport (extension popup, small phones, the expanded session list —
 * OK-58516) would clip its bottom. Bound the body by the window height and
 * let it scroll; when the content fits, the ScrollView collapses to content
 * height.
 */
function TradingHoursDialogBody({ stock }: { stock: IMarketStockInfo }) {
  const { height: windowHeight } = useWindowDimensions();
  // Window resizes only move the ScrollView bound — keep the panel subtree
  // from re-reconciling on every resize tick.
  const content = useMemo(
    () => (
      <TradingHoursContent
        stock={stock}
        headerRight={<TradingHoursDialogCloseButton />}
      />
    ),
    [stock],
  );
  return (
    <ScrollView
      maxHeight={Math.max(
        DIALOG_BODY_MIN_HEIGHT,
        windowHeight - DIALOG_BODY_RESERVED_HEIGHT,
      )}
      nestedScrollEnabled
    >
      {content}
    </ScrollView>
  );
}

function showTradingHoursDialog(stock: IMarketStockInfo) {
  Dialog.show({
    showHeader: false,
    showFooter: false,
    contentContainerProps: { px: '$0', pb: '$0' },
    renderContent: <TradingHoursDialogBody stock={stock} />,
  });
}

function getNodeRect(node: unknown): DOMRect | null {
  if (
    node &&
    typeof (node as HTMLElement).getBoundingClientRect === 'function'
  ) {
    const rect = (node as HTMLElement).getBoundingClientRect();
    return rect.width > 0 ? rect : null;
  }
  return null;
}

/**
 * Desktop hover-card behavior: dwelling on the badge opens the popover; it
 * stays open while the pointer is inside the badge or the panel and closes
 * shortly after the pointer leaves both. Closing is driven by GEOMETRY (a global
 * mousemove hit-test against both rects) instead of enter/leave events —
 * opening the popover remounts nodes under a stationary cursor, and the
 * resulting synthetic leave/enter storm made event-based closing flicker.
 * Clicking the badge still works via the Popover's own trigger press.
 */
function TradingHoursHoverPopover({
  stock,
  renderTrigger,
  defaultOpen = false,
}: {
  stock: IMarketStockInfo;
  renderTrigger: ReactNode;
  defaultOpen?: boolean;
}) {
  const intl = useIntl();
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const triggerRef = useRef<unknown>(null);
  const contentRef = useRef<unknown>(null);

  // Hover-intent delay (OK-58513): the badge sits inside the token-selector
  // header, so a pointer merely passing through (typically <150 ms) must not
  // open the card. Opening waits for a short dwell; leaving the badge before
  // it elapses cancels the open. Clicking still opens instantly via the
  // Popover's own trigger press.
  const HOVER_OPEN_DELAY_MS = 300;
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelPendingOpen = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);
  const handleHoverIn = useCallback(() => {
    if (openTimerRef.current) {
      return;
    }
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      setIsOpen(true);
    }, HOVER_OPEN_DELAY_MS);
  }, []);
  const handleTriggerPress = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
    setIsOpen(true);
  }, []);
  const handleContentPress = useCallback((event: GestureResponderEvent) => {
    event.stopPropagation();
  }, []);
  useEffect(() => cancelPendingOpen, [cancelPendingOpen]);

  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') {
      return;
    }
    // Bridges the trigger→panel offset gap and forgives 1px jitters.
    const HOVER_MARGIN = 12;
    let closeTimer: ReturnType<typeof setTimeout> | null = null;
    const isInside = (ref: { current: unknown }, x: number, y: number) => {
      const rect = getNodeRect(ref.current);
      return (
        !!rect &&
        x >= rect.left - HOVER_MARGIN &&
        x <= rect.right + HOVER_MARGIN &&
        y >= rect.top - HOVER_MARGIN &&
        y <= rect.bottom + HOVER_MARGIN
      );
    };
    // Coalesce hit-testing to one rect read per frame — mousemove can fire
    // hundreds of times per second and getBoundingClientRect forces layout.
    let frame: number | null = null;
    let lastX = 0;
    let lastY = 0;
    const hitTest = () => {
      frame = null;
      const inside =
        isInside(triggerRef, lastX, lastY) ||
        isInside(contentRef, lastX, lastY);
      if (inside) {
        if (closeTimer) {
          clearTimeout(closeTimer);
          closeTimer = null;
        }
      } else if (!closeTimer) {
        closeTimer = setTimeout(() => setIsOpen(false), 200);
      }
    };
    const handleMove = (e: MouseEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;
      if (frame === null) {
        frame = requestAnimationFrame(hitTest);
      }
    };
    document.addEventListener('mousemove', handleMove);
    return () => {
      document.removeEventListener('mousemove', handleMove);
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
    };
  }, [isOpen]);

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      // Start-aligned: some hosts stretch the trigger to the full column
      // (the inline status row measures that width), and the default
      // `bottom-end` would then float the panel far from the status chip.
      placement="bottom-start"
      title={intl.formatMessage({ id: ETranslations.trading_hours_title })}
      renderTrigger={
        <Stack
          testID="trading-hours-popover-trigger"
          // Keep the arrow over the whole chip; the label text would otherwise
          // show the browser's I-beam.
          cursor="default"
          {...({ ref: triggerRef } as object)}
          onHoverIn={handleHoverIn}
          onHoverOut={cancelPendingOpen}
          onPress={handleTriggerPress}
        >
          {renderTrigger}
        </Stack>
      }
      renderContent={
        <Stack
          testID="trading-hours-popover-content"
          {...({ ref: contentRef } as object)}
          onPress={handleContentPress}
        >
          <TradingHoursContent stock={stock} dense />
        </Stack>
      }
      floatingPanelProps={{ w: 360 }}
    />
  );
}

/**
 * Trading-hours info panel (OK-58043): a hover/click floating popover on wide
 * screens and an edge-to-edge bottom-sheet dialog on native/small screens
 * (the Popover's own sheet form is an inset floating card, which does not
 * match the design). Wrap a trigger (usually the stock market-status chip)
 * and it handles the rest — session math, timezone conversion and refresh
 * are all internal.
 */
export function TradingHoursTrigger({
  stock,
  renderTrigger,
  defaultOpen = false,
  onDefaultOpenConsumed,
}: {
  stock: IMarketStockInfo;
  renderTrigger: ReactNode;
  defaultOpen?: boolean;
  onDefaultOpenConsumed?: () => void;
}) {
  const media = useMedia();
  const useSheetDialog = platformEnv.isNative || media.md;
  const openOnLoad = useRef(defaultOpen);
  useEffect(() => {
    if (openOnLoad.current) {
      openOnLoad.current = false;
      if (useSheetDialog && stock.isUSListing !== false) {
        showTradingHoursDialog(stock);
      }
      onDefaultOpenConsumed?.();
    }
  }, [onDefaultOpenConsumed, stock, useSheetDialog]);

  // US trading hours describe nothing about a non-US listing.
  if (stock.isUSListing === false) {
    return <>{renderTrigger}</>;
  }

  if (useSheetDialog) {
    return (
      <Stack
        cursor="default"
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
    <TradingHoursHoverPopover
      stock={stock}
      renderTrigger={renderTrigger}
      defaultOpen={openOnLoad.current}
    />
  );
}
