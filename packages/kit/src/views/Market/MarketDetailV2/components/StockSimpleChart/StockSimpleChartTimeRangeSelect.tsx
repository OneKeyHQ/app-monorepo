import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Icon,
  Select,
  SizableText,
  YStack,
} from '@onekeyhq/components';
import type { IKeyOfIcons, ISelectItem } from '@onekeyhq/components';
import type { IMarketPriceSource } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  type IStockSimpleChartRange,
  type IStockSimpleChartSelection,
  type IStockSimpleChartSession,
  STOCK_SHARE_SIMPLE_CHART_RANGES,
  STOCK_SHARE_TRADING_DAY_SIMPLE_CHART_RANGES,
  STOCK_SIMPLE_CHART_SESSIONS,
  TOKEN_SIMPLE_CHART_RANGES,
  resolveStockSimpleChartDefaultSelection,
  resolveStockSimpleChartRangeForPriceMode,
} from './stockSimpleChartData';

const SESSION_LABEL_IDS: Record<IStockSimpleChartSession, ETranslations> = {
  preMarket: ETranslations.trading_hours_pre_market,
  regular: ETranslations.trading_hours_regular_market,
  postMarket: ETranslations.trading_hours_post_market,
  fullHours: ETranslations.market_chart_all_sessions__title,
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

// A listing without sessions opens on its trading-day 1D, as before sessions.
const STOCK_SIMPLE_CHART_TRADING_DAY_SELECTION: IStockSimpleChartSelection = {
  range: '1D',
  lastSession: 'fullHours',
};

function isStockSimpleChartSession(
  value: string,
): value is IStockSimpleChartSession {
  return (STOCK_SIMPLE_CHART_SESSIONS as readonly string[]).includes(value);
}

/**
 * The range toolbar's one selection, shared by every surface that draws the
 * stock simple chart. Sessions only exist on the share quote, so the token
 * price mode reads the selection as its plain range.
 */
export function useStockSimpleChartSelection(
  priceMode: IMarketPriceSource,
  // The raw backend enum on the quote's market status, e.g. `PRE_MARKET`.
  marketSession?: string,
  // Whether the listing has trading sessions (US listings only so far).
  sessionsSupported = true,
) {
  const showsSessions = priceMode === 'share' && sessionsSupported;
  // Unset until the user picks: the default then follows the market, so a page
  // left open across the regular open moves on from pre-market by itself.
  const [pickedSelection, setPickedSelection] =
    useState<IStockSimpleChartSelection>();
  // The default follows the listing, not the price mode: a range picked on the
  // token price still carries the session the share price would open on.
  const selection =
    pickedSelection ??
    (sessionsSupported
      ? resolveStockSimpleChartDefaultSelection({ marketSession })
      : STOCK_SIMPLE_CHART_TRADING_DAY_SELECTION);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;
  // Token All maps to share 5Y first. Only a range the share chart has no
  // counterpart for (1H) returns to the capsule's session there.
  const modeRange = resolveStockSimpleChartRangeForPriceMode({
    priceMode,
    range: selection.range,
  });
  const isShareWithoutRange =
    showsSessions &&
    !selection.session &&
    !(STOCK_SHARE_SIMPLE_CHART_RANGES as readonly string[]).includes(modeRange);
  const session = showsSessions
    ? (selection.session ??
      (isShareWithoutRange ? selection.lastSession : undefined))
    : undefined;
  const range = isShareWithoutRange ? '1D' : modeRange;
  const selectRange = useCallback((next: IStockSimpleChartRange) => {
    setPickedSelection({
      range: next,
      lastSession: selectionRef.current.lastSession,
    });
  }, []);
  const selectSession = useCallback((next: IStockSimpleChartSession) => {
    setPickedSelection({ range: '1D', session: next, lastSession: next });
  }, []);
  let chartRanges: readonly IStockSimpleChartRange[] =
    TOKEN_SIMPLE_CHART_RANGES;
  if (priceMode === 'share') {
    chartRanges = showsSessions
      ? STOCK_SHARE_SIMPLE_CHART_RANGES
      : STOCK_SHARE_TRADING_DAY_SIMPLE_CHART_RANGES;
  }
  return {
    range,
    session,
    // The capsule and its sessions; ranges only otherwise.
    showsSessions,
    chartRanges,
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
  session,
  testID,
  onSessionChange,
}: {
  // On a touch toolbar the capsule doubles as a range button: a press while a
  // range is drawn returns to its session, and only a press while it is
  // already active opens the list.
  activateOnPress?: boolean;
  // The session the capsule names while a range is drawn.
  capsuleSession: IStockSimpleChartSession;
  height: number;
  session?: IStockSimpleChartSession;
  testID: string;
  onSessionChange: (session: IStockSimpleChartSession) => void;
}) {
  const intl = useIntl();
  const getSessionLabel = useCallback(
    (item: IStockSimpleChartSession) =>
      intl.formatMessage({ id: SESSION_LABEL_IDS[item] }),
    [intl],
  );
  // The ranges sit on the toolbar itself, so the list holds only sessions.
  const items = useMemo<ISelectItem[]>(
    () =>
      STOCK_SIMPLE_CHART_SESSIONS.map((item) => {
        const label = getSessionLabel(item);
        return {
          label,
          // The hours ride inside the label so both lines take the sizes this
          // list calls for rather than the Select defaults.
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
          value: item,
        };
      }),
    [getSessionLabel],
  );
  const handleChange = useCallback(
    (value: string) => {
      if (isStockSimpleChartSession(value)) {
        onSessionChange(value);
      }
    },
    [onSessionChange],
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
      title={intl.formatMessage({ id: ETranslations.trading_hours_title })}
      items={items}
      // Nothing is checked while a range is drawn.
      value={session}
      onChange={handleChange}
      // Commit the pick before the list closes, so a range pressed right after
      // cannot be overwritten by a session change that lands later.
      waitForChangeBeforeClose
      placement="top-start"
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
