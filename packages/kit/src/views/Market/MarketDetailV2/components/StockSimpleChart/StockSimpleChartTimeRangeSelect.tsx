import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Select,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons, ISelectSection } from '@onekeyhq/components';
import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IStockSimpleChartRange,
  type IStockSimpleChartSelection,
  type IStockSimpleChartSession,
  STOCK_SHARE_SIMPLE_CHART_RANGES,
  STOCK_SIMPLE_CHART_DEFAULT_SELECTION,
  STOCK_SIMPLE_CHART_SESSIONS,
  resolveStockSimpleChartRangeForPriceMode,
} from './stockSimpleChartData';

const SESSION_LABEL_IDS: Record<IStockSimpleChartSession, ETranslations> = {
  preMarket: ETranslations.trading_hours_pre_market,
  regular: ETranslations.trading_hours_regular_market,
  postMarket: ETranslations.trading_hours_post_market,
  fullHours: ETranslations.market_chart_all_sessions__title,
};

// The list spells each range out; the toolbar buttons keep the short form.
const RANGE_LONG_LABELS: Record<
  (typeof STOCK_SHARE_SIMPLE_CHART_RANGES)[number],
  { id: ETranslations; count: number }
> = {
  '1H': { id: ETranslations.market_chart_range_hours__title, count: 1 },
  '1D': { id: ETranslations.market_chart_range_days__title, count: 1 },
  '1W': { id: ETranslations.market_chart_range_weeks__title, count: 1 },
  '1M': { id: ETranslations.market_chart_range_months__title, count: 1 },
  '1Y': { id: ETranslations.market_chart_range_years__title, count: 1 },
  '5Y': { id: ETranslations.market_chart_range_years__title, count: 5 },
};

// US listing hours in Eastern Time, which is how the sessions are defined.
const SESSION_HOURS: Record<IStockSimpleChartSession, string> = {
  preMarket: '04:00 – 09:30 ET',
  regular: '09:30 – 16:00 ET',
  postMarket: '16:00 – 20:00 ET',
  fullHours: '04:00 – 20:00 ET',
};

// The first three match the market status badge, so a session reads the same
// here as it does beside the quote.
const SESSION_ICONS: Record<IStockSimpleChartSession, IKeyOfIcons> = {
  preMarket: 'SunriseOutline',
  regular: 'SunOutline',
  postMarket: 'SunDownOutline',
  fullHours: 'ClockTimeHistoryOutline',
};

const TIME_RANGE_PANEL_PROPS = { pt: '$1' } as const;

const SESSION_VALUE_PREFIX = 'session:';
const RANGE_VALUE_PREFIX = 'range:';

function isStockSimpleChartSession(
  value: string,
): value is IStockSimpleChartSession {
  return (STOCK_SIMPLE_CHART_SESSIONS as readonly string[]).includes(value);
}

function isStockShareSimpleChartRange(
  value: string,
): value is (typeof STOCK_SHARE_SIMPLE_CHART_RANGES)[number] {
  return (STOCK_SHARE_SIMPLE_CHART_RANGES as readonly string[]).includes(value);
}

/**
 * The range toolbar's one selection, shared by every surface that draws the
 * stock simple chart. Sessions only exist on the share quote, so the token
 * price mode reads the selection as its plain range.
 */
export function useStockSimpleChartSelection(priceMode: IMarketPriceSource) {
  const [selection, setSelection] = useState<IStockSimpleChartSelection>(
    STOCK_SIMPLE_CHART_DEFAULT_SELECTION,
  );
  const session = priceMode === 'share' ? selection.session : undefined;
  const range = resolveStockSimpleChartRangeForPriceMode({
    priceMode,
    range: selection.range,
  });
  const selectRange = useCallback((next: IStockSimpleChartRange) => {
    setSelection((prev) => ({ range: next, lastSession: prev.lastSession }));
  }, []);
  const selectSession = useCallback((next: IStockSimpleChartSession) => {
    setSelection({ range: '1D', session: next, lastSession: next });
  }, []);
  return {
    range,
    session,
    // What the capsule names, drawn or not.
    capsuleSession: selection.lastSession,
    // The quick range buttons stay unselected while a session is drawn.
    selectedRange: session ? undefined : range,
    selectRange,
    selectSession,
  };
}

export function StockSimpleChartTimeRangeSelect({
  activateOnPress = false,
  capsuleSession,
  height,
  range,
  session,
  testID,
  onRangeChange,
  onSessionChange,
}: {
  // On a touch toolbar the capsule doubles as a range button: a press while a
  // range is drawn returns to its session, and only a press while it is
  // already active opens the list.
  activateOnPress?: boolean;
  // The session the capsule names while a range is drawn.
  capsuleSession: IStockSimpleChartSession;
  height: number;
  range: IStockSimpleChartRange;
  session?: IStockSimpleChartSession;
  testID: string;
  onRangeChange: (range: IStockSimpleChartRange) => void;
  onSessionChange: (session: IStockSimpleChartSession) => void;
}) {
  const intl = useIntl();
  const getSessionLabel = useCallback(
    (item: IStockSimpleChartSession) =>
      intl.formatMessage({ id: SESSION_LABEL_IDS[item] }),
    [intl],
  );
  const sections = useMemo<ISelectSection[]>(
    () => [
      {
        title: intl.formatMessage({ id: ETranslations.trading_hours_title }),
        titleColor: '$textDisabled',
        data: STOCK_SIMPLE_CHART_SESSIONS.map((item) => {
          const label = getSessionLabel(item);
          return {
            label,
            // The hours ride inside the label so both lines take the sizes
            // this list calls for rather than the Select defaults.
            labelComponent: (
              <YStack>
                <SizableText size="$bodyMdMedium">{label}</SizableText>
                <SizableText size="$bodySm" color="$textSubdued">
                  {SESSION_HOURS[item]}
                </SizableText>
              </YStack>
            ),
            leading: (
              <Icon name={SESSION_ICONS[item]} size="$5" color="$iconSubdued" />
            ),
            value: `${SESSION_VALUE_PREFIX}${item}`,
          };
        }),
      },
      {
        title: intl.formatMessage({
          id: ETranslations.market_chart_range__title,
        }),
        titleColor: '$textDisabled',
        data: STOCK_SHARE_SIMPLE_CHART_RANGES.map((item) => {
          const { id, count } = RANGE_LONG_LABELS[item];
          const label = intl.formatMessage({ id }, { count });
          return {
            label,
            labelComponent: (
              <SizableText size="$bodyMdMedium">{label}</SizableText>
            ),
            value: `${RANGE_VALUE_PREFIX}${item}`,
          };
        }),
      },
    ],
    [getSessionLabel, intl],
  );
  const handleChange = useCallback(
    (value: string) => {
      if (value.startsWith(SESSION_VALUE_PREFIX)) {
        const next = value.slice(SESSION_VALUE_PREFIX.length);
        if (isStockSimpleChartSession(next)) {
          onSessionChange(next);
        }
        return;
      }
      const next = value.slice(RANGE_VALUE_PREFIX.length);
      if (isStockShareSimpleChartRange(next)) {
        onRangeChange(next);
      }
    },
    [onRangeChange, onSessionChange],
  );

  // Select opens from its trigger wrapper as well as from the trigger's own
  // press, so the open request itself is what gets redirected.
  const [isOpen, setIsOpen] = useState(false);
  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen && activateOnPress && !session) {
        onSessionChange(capsuleSession);
        return;
      }
      setIsOpen(nextOpen);
    },
    [activateOnPress, capsuleSession, onSessionChange, session],
  );

  return (
    <Select
      testID={testID}
      open={isOpen}
      onOpenChange={handleOpenChange}
      title={intl.formatMessage({ id: ETranslations.global_time_range })}
      sections={sections}
      value={
        session
          ? `${SESSION_VALUE_PREFIX}${session}`
          : `${RANGE_VALUE_PREFIX}${range}`
      }
      onChange={handleChange}
      placement="top-start"
      // A little air above the first section title on the desktop panel.
      floatingPanelProps={TIME_RANGE_PANEL_PROPS}
      // The sheet opens on a section title, which pads itself.
      sheetListPaddingTop="$0"
      renderTrigger={({ onPress }) => (
        <Button
          testID={`${testID}-trigger`}
          height={height}
          m="$0"
          pl="$2.5"
          pr="$2"
          borderWidth={0}
          size="small"
          // With a range picked the capsule drops its fill and reads as
          // unselected, like the quick range buttons beside it.
          variant={session ? 'secondary' : 'tertiary'}
          borderRadius="$full"
          iconAfter="ChevronDownSmallOutline"
          onPress={onPress}
        >
          {getSessionLabel(session ?? capsuleSession)}
        </Button>
      )}
    />
  );
}
