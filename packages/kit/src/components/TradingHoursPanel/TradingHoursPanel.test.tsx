/** @jest-environment jsdom */
import { createContext, useContext, useMemo } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import { TradingHoursTrigger } from '.';

import { act, fireEvent, render, screen, within } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFetchUSMarketStatusResult } from '@onekeyhq/shared/types/swap/types';

let mockStatus: IFetchUSMarketStatusResult | undefined;
let mockMediaMd = false;
let mockDialogContent: ReactNode;

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en',
}));

jest.mock('react-intl', () => {
  // The redesign's own keys render their English source so assertions read
  // like the UI; every other key keeps rendering as its id.
  const enUS: Record<string, string> = jest.requireActual(
    '@onekeyhq/shared/src/locale/json/en_US.json',
  );
  return {
    useIntl: () => ({
      formatMessage: (
        { id }: { id: string },
        values?: Record<string, string | number>,
      ) => {
        if (!id.startsWith('market_trading_hours_')) {
          return id;
        }
        return (enUS[id] ?? id).replace(/\{(\w+)\}/g, (match, name: string) =>
          values && name in values ? String(values[name]) : match,
        );
      },
      formatDate: () => 'time',
    }),
  };
});
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
  useWindowDimensions: () => ({ width: 1280, height: 800 }),
}));
let mockIntervalTick: (() => void) | undefined;
jest.mock('@onekeyhq/kit/src/hooks/useInterval', () => ({
  useInterval: (tick: () => void) => {
    mockIntervalTick = tick;
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useUSMarketStatus', () => ({
  useUSMarketStatus: () => mockStatus,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/components', () => {
  // A frame faded to opacity 0 is on screen for layout only, so the mock
  // leaves its content out and text queries see what a user would.
  const Frame = ({
    children: frameChildren,
    bg,
    left,
    opacity,
    testID,
    onPress,
    role,
    accessible,
    'aria-label': ariaLabel,
    'aria-valuenow': ariaValueNow,
  }: PropsWithChildren<{
    bg?: string;
    left?: string | number;
    role?: string;
    accessible?: boolean;
    'aria-label'?: string;
    'aria-valuenow'?: number;
    opacity?: number;
    testID?: string;
    onPress?: (event: unknown) => void;
  }>) => {
    const children = opacity === 0 ? null : frameChildren;
    return onPress ? (
      <button type="button" data-bg={bg} data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div
        data-bg={bg}
        data-left={left}
        data-testid={testID}
        role={role}
        data-accessible={accessible}
        aria-label={ariaLabel}
        aria-valuenow={ariaValueNow}
      >
        {children}
      </div>
    );
  };
  // Minimal stand-in for the disclosure: one item, a trigger that toggles
  // it, and content that stays mounted.
  const AccordionContext = createContext<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>({});
  const Accordion = ({
    children,
    value,
    onValueChange,
  }: PropsWithChildren<{
    value?: string;
    onValueChange?: (value: string) => void;
  }>) => {
    const context = useMemo(
      () => ({ value, onValueChange }),
      [value, onValueChange],
    );
    return (
      <AccordionContext.Provider value={context}>
        {children}
      </AccordionContext.Provider>
    );
  };
  const AccordionItem = ({ children }: PropsWithChildren) => <>{children}</>;
  const AccordionTrigger = ({
    children,
    testID,
  }: PropsWithChildren<{ testID?: string }>) => {
    const { value, onValueChange } = useContext(AccordionContext);
    return (
      <button
        type="button"
        data-testid={testID}
        aria-expanded={Boolean(value)}
        onClick={() => onValueChange?.(value ? '' : 'schedule')}
      >
        {children}
      </button>
    );
  };
  Accordion.Item = AccordionItem;
  Accordion.Trigger = AccordionTrigger;
  Accordion.Content = Frame;
  return {
    Accordion,
    Stack: Frame,
    XStack: Frame,
    YStack: Frame,
    SizableText: Frame,
    Badge: Frame,
    Divider: () => null,
    HeightTransition: ({
      children,
      hide,
    }: PropsWithChildren<{ hide?: boolean }>) => (hide ? null : children),
    Icon: () => null,
    Popover: ({
      renderContent,
      open,
    }: {
      renderContent: ReactNode;
      open?: boolean;
    }) => (
      <div data-testid="trading-hours-popover" data-open={open}>
        {renderContent}
      </div>
    ),
    Dialog: {
      show: ({ renderContent }: { renderContent: ReactNode }) => {
        mockDialogContent = renderContent;
      },
      Header: ({ children }: PropsWithChildren) => <>{children}</>,
    },
    ScrollView: Frame,
    useMedia: () => ({ md: mockMediaMd }),
  };
});

afterEach(() => {
  jest.useRealTimers();
  mockStatus = undefined;
  mockMediaMd = false;
  mockDialogContent = undefined;
});

const CLOSED_NOTE = 'Closed on weekends and US market holidays.';
const FOOTNOTE =
  'Hours shown are for the underlying stock market. Stock tokens may trade 24/7 or on a different schedule.';

const sessionRowBg = () =>
  screen
    .getByTestId('trading-hours-session-row-content')
    .getAttribute('data-bg');
const timelineLabels = () =>
  within(screen.getByTestId('trading-hours-timeline-labels'))
    .getAllByText(/\S/)
    .map((node) => node.textContent);
const nowLinePercent = () =>
  parseFloat(
    screen.getByTestId('trading-hours-now-line').parentElement?.dataset.left ??
      '',
  );

it.each(['ondo', 'xstock', 'bstock'])(
  'updates %s trading hours when the backend reports a weekday closure',
  (source) => {
    jest.useFakeTimers();
    // Thu 10:00 EST — regular session by the clock
    jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
    const panel = (
      <TradingHoursTrigger
        stock={{
          title: 'AAPL',
          subtitle: 'Apple',
          source,
          sourceLogoUri: '',
          isOpen: true,
        }}
        renderTrigger={<span>status</span>}
      />
    );
    const { rerender } = render(panel);
    expect(
      screen.getByText(ETranslations.trading_hours_regular_market),
    ).toBeTruthy();
    expect(sessionRowBg()).toBe('$bgSuccess');
    expect(screen.getByText('Regular trading ends in')).toBeTruthy();
    expect(screen.getByText('6h')).toBeTruthy();
    expect(screen.getByText(FOOTNOTE)).toBeTruthy();

    mockStatus = { open: false, session: 'CLOSED', reason: 'holiday' };
    rerender(
      <TradingHoursTrigger
        stock={{
          title: 'AAPL',
          subtitle: 'Apple',
          source,
          sourceLogoUri: '',
          isOpen: true,
        }}
        renderTrigger={<span>status</span>}
      />,
    );

    expect(
      screen.getByText(ETranslations.trading_hours_market_closed),
    ).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.trading_hours_regular_market),
    ).toBeNull();
    expect(sessionRowBg()).toBe('$bgSubdued');
    // A weekday closure the clock cannot see has no reopen time to count to.
    expect(screen.queryByTestId('trading-hours-countdown')).toBeNull();
    // A weekday closure with no reopen time names no next session.
    expect(timelineLabels()).toEqual([ETranslations.market_status_closed]);
    expect(
      screen.queryByText(ETranslations.trading_hours_regular_market_now),
    ).toBeNull();
    expect(
      screen.getByText(ETranslations.trading_hours_closed_tradable_description),
    ).toBeTruthy();
    expect(screen.queryByText(FOOTNOTE)).toBeNull();
  },
);

it('keeps the generic copy for a US listing through a closure', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
  mockStatus = { open: false, session: 'CLOSED', reason: 'holiday' };
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'bstock',
        sourceLogoUri: '',
        isUSListing: true,
        isOpen: true,
      }}
      renderTrigger={<span>status</span>}
    />,
  );

  expect(screen.getByText(CLOSED_NOTE)).toBeTruthy();
  expect(screen.getByText(FOOTNOTE)).toBeTruthy();
  expect(
    screen.queryByText(ETranslations.trading_hours_closed_tradable_description),
  ).toBeNull();
});

it('counts down to the backend reopen time through a closure', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
  mockStatus = { open: false, session: 'CLOSED', reason: 'holiday' };
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'bstock',
        sourceLogoUri: '',
        isUSListing: true,
        isOpen: false,
        // Thu 20:05 EST — the overnight session
        nextOpenTime: '2026-11-27T01:05:00Z',
      }}
      renderTrigger={<span>status</span>}
    />,
  );

  expect(screen.getByText('Overnight trading starts in')).toBeTruthy();
  expect(screen.getByText('10h 5m')).toBeTruthy();
  expect(screen.getByText('Next session')).toBeTruthy();
});

it('shows the halt description instead of a countdown', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'ondo',
        sourceLogoUri: '',
        isOpen: true,
        isPaused: true,
      }}
      renderTrigger={<span>status</span>}
    />,
  );

  expect(
    screen.getByText(ETranslations.trading_hours_trading_halts),
  ).toBeTruthy();
  expect(
    screen.getByText(ETranslations.trading_hours_trading_halts_description),
  ).toBeTruthy();
  expect(screen.queryByTestId('trading-hours-countdown')).toBeNull();
  // The halt interrupts the regular session, which stays highlighted.
  expect(sessionRowBg()).toBe('$bgSuccess');
});

it('marks a session gap as awaiting open without a now tag', () => {
  jest.useFakeTimers();
  // Thu 09:30:30 EST — the opening-cross gap before the regular session
  jest.setSystemTime(new Date('2026-11-26T14:30:30Z'));
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'ondo',
        sourceLogoUri: '',
        isOpen: true,
      }}
      renderTrigger={<span>status</span>}
    />,
  );

  expect(
    screen.getByText(ETranslations.label_market_awaiting_open),
  ).toBeTruthy();
  expect(screen.getByText('Regular trading starts in')).toBeTruthy();
  expect(screen.getByText('1m')).toBeTruthy();
  expect(screen.getByText('Next session')).toBeTruthy();
  expect(screen.getByTestId('trading-hours-now-line')).toBeTruthy();
  expect(
    screen.queryByText(ETranslations.trading_hours_regular_market_now),
  ).toBeNull();
});

it('expands the full schedule from the session row', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'ondo',
        sourceLogoUri: '',
        isOpen: true,
      }}
      renderTrigger={<span>status</span>}
    />,
  );

  const trigger = screen.getByTestId('trading-hours-session-row');
  expect(screen.getByText('This session')).toBeTruthy();
  expect(screen.queryByTestId('trading-hours-session-list')).toBeNull();
  expect(trigger.getAttribute('aria-expanded')).toBe('false');

  fireEvent.click(trigger);

  expect(trigger.getAttribute('aria-expanded')).toBe('true');

  expect(screen.getByText('All trading hours')).toBeTruthy();
  expect(screen.queryByText('This session')).toBeNull();
  expect(
    screen
      .getAllByText(ETranslations.trading_hours_regular_market)
      .some((node) => node.closest('[data-bg="$bgSuccess"]')),
  ).toBe(true);
  // Once in the expanded list and once under the timeline, which reuses the
  // same key for its short label.
  expect(
    screen.getAllByText(ETranslations.trading_hours_overnight),
  ).toHaveLength(2);
});

it('shows no now marker for a stale backend session', () => {
  jest.useFakeTimers();
  // Thu 10:00 EST, backend still reporting pre-market
  jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
  mockStatus = { open: true, session: 'PRE_MARKET', reason: null };
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'ondo',
        sourceLogoUri: '',
        isOpen: true,
      }}
      renderTrigger={<span>status</span>}
    />,
  );

  expect(screen.getByText(ETranslations.trading_hours_pre_market)).toBeTruthy();
  expect(screen.queryByTestId('trading-hours-now-line')).toBeNull();
  expect(screen.queryByTestId('trading-hours-countdown')).toBeNull();
});

it('points a halt at no session through a market-wide closure', () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
  mockStatus = { open: false, session: 'CLOSED', reason: 'holiday' };
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'ondo',
        sourceLogoUri: '',
        isOpen: false,
        isPaused: true,
      }}
      renderTrigger={<span>status</span>}
    />,
  );

  expect(
    screen.getByText(ETranslations.trading_hours_trading_halts),
  ).toBeTruthy();
  expect(timelineLabels()).toEqual([ETranslations.market_status_closed]);
  expect(sessionRowBg()).toBe('$bgSubdued');
});

const renderClosedUSListing = (nextOpenTime?: string) =>
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'bstock',
        sourceLogoUri: '',
        isUSListing: true,
        isOpen: false,
        nextOpenTime,
      }}
      renderTrigger={<span>status</span>}
    />,
  );

describe('closed timeline', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockStatus = { open: false, session: 'CLOSED', reason: 'holiday' };
  });

  it('falls back to the cycle without naming a next session', () => {
    // Thu 10:00 EST, no reopen time: 5h59m into the 04:01 → 03:56 cycle
    jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
    renderClosedUSListing();

    expect(timelineLabels()).toEqual([ETranslations.market_status_closed]);
    expect(nowLinePercent()).toBeCloseTo((359 / 1435) * 100, 6);
    expect(
      screen.queryByText(ETranslations.trading_hours_regular_market_now),
    ).toBeNull();
    // The cycle position is no closure progress: the bar stays indeterminate.
    expect(
      screen
        .getByRole('progressbar', { name: ETranslations.market_status_closed })
        .hasAttribute('aria-valuenow'),
    ).toBe(false);
  });

  it('runs a holiday to the next pre-market', () => {
    // Thu 10:00 EST; reopens Fri 04:01 EST — 5h59m of 24h
    jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
    renderClosedUSListing('2026-11-27T09:01:00Z');

    expect(timelineLabels()).toEqual([
      ETranslations.market_status_closed,
      'Pre',
    ]);
    expect(nowLinePercent()).toBeCloseTo((359 / 1440) * 100, 6);
    const progress = screen.getByRole('progressbar', {
      name: ETranslations.market_status_closed,
    });
    expect(progress.getAttribute('aria-valuenow')).toBe('25');
    expect(progress.getAttribute('data-accessible')).toBe('true');
  });

  it('updates an open sheet when a refresh brings the reopen time', () => {
    mockMediaMd = true;
    // Thu 10:00 EST, weekday closure with no reopen time yet
    jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
    const stock = {
      title: 'AAPL',
      subtitle: 'Apple',
      source: 'bstock',
      sourceLogoUri: '',
      isUSListing: true,
      isOpen: false,
    };
    const { rerender } = render(
      <TradingHoursTrigger stock={stock} renderTrigger={<span>status</span>} />,
    );
    // The sheet trigger is the only button before the sheet mounts.
    fireEvent.click(screen.getByRole('button'));
    render(<>{mockDialogContent}</>);
    expect(timelineLabels()).toEqual([ETranslations.market_status_closed]);

    act(() => {
      rerender(
        <TradingHoursTrigger
          stock={{ ...stock, nextOpenTime: '2026-11-27T09:01:00Z' }}
          renderTrigger={<span>status</span>}
        />,
      );
    });
    expect(timelineLabels()).toEqual([
      ETranslations.market_status_closed,
      'Pre',
    ]);
    expect(screen.getByText('Pre-market starts in')).toBeTruthy();
  });

  it('runs a holiday to the same evening overnight', () => {
    // Thu 10:00 EST; reopens Thu 20:05 EST — 5h59m of 16h04m
    jest.setSystemTime(new Date('2026-11-26T15:00:00Z'));
    renderClosedUSListing('2026-11-27T01:05:00Z');

    expect(timelineLabels()).toEqual([
      ETranslations.market_status_closed,
      ETranslations.trading_hours_overnight,
    ]);
    expect(nowLinePercent()).toBeCloseTo((359 / 964) * 100, 6);
  });

  it.each([
    // Sat 10:00 EST — 14h into the Fri 20:00 → Sun 20:05 closure
    ['Saturday', '2026-11-28T15:00:00Z', 840],
    // Sun 10:00 EST — 38h in; the cycle rolled over at 04:01, the line not
    ['Sunday', '2026-11-29T15:00:00Z', 2280],
  ])('tracks the whole weekend on %s', (_day, now, elapsedMinutes) => {
    mockStatus = { open: false, session: 'CLOSED', reason: 'weekend' };
    jest.setSystemTime(new Date(now));
    renderClosedUSListing();

    expect(timelineLabels()).toEqual([
      ETranslations.market_status_closed,
      ETranslations.trading_hours_overnight,
    ]);
    expect(nowLinePercent()).toBeCloseTo((elapsedMinutes / 2885) * 100, 6);
  });

  it('keeps the closure start across the 04:01 cycle rollover', () => {
    // Fri 03:59 EST, closed until the Fri 09:31 EST regular open: 23h58m
    // into the closure that started Thu 04:01 (29h30m long)
    jest.setSystemTime(new Date('2026-11-27T08:59:00Z'));
    renderClosedUSListing('2026-11-27T14:31:00Z');
    expect(timelineLabels()).toEqual([
      ETranslations.market_status_closed,
      'Regular',
    ]);
    expect(nowLinePercent()).toBeCloseTo((1438 / 1770) * 100, 6);

    // Fri 04:02 EST: the clock's cycle now starts Fri 04:01, but the marker
    // keeps measuring from Thu 04:01 instead of dropping back to the start.
    act(() => {
      jest.setSystemTime(new Date('2026-11-27T09:02:00Z'));
      mockIntervalTick?.();
    });
    expect(nowLinePercent()).toBeCloseTo((1441 / 1770) * 100, 6);
  });
});

it('counts the cycle-edge gap down to the next pre-market', () => {
  jest.useFakeTimers();
  // Thu 03:58 EST — past the overnight close, before the 04:01 open
  jest.setSystemTime(new Date('2026-11-26T08:58:00Z'));
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'ondo',
        sourceLogoUri: '',
        isOpen: true,
      }}
      renderTrigger={<span>status</span>}
    />,
  );

  expect(screen.getByText('Pre-market starts in')).toBeTruthy();
  expect(screen.getByText('3m')).toBeTruthy();
  expect(screen.getByText('Next session')).toBeTruthy();
  // The row describes the session that opens in 3 minutes, so it is today's
  // and carries no weekday prefix.
  expect(
    screen.getByTestId('trading-hours-session-row-content').textContent,
  ).toMatch(/^Next session\d{2}:\d{2} – \d{2}:\d{2}/);
});

it('opens no US trading hours for a non-US listing', () => {
  render(
    <TradingHoursTrigger
      stock={{
        title: 'TCENT',
        subtitle: 'Tencent',
        source: 'xstock',
        sourceLogoUri: '',
        isUSListing: false,
        isOpen: true,
      }}
      renderTrigger={<span>status</span>}
    />,
  );

  expect(screen.getByText('status')).toBeTruthy();
  expect(screen.queryByTestId('trading-hours-panel')).toBeNull();
});

it('opens the desktop popover for a press received while loading', () => {
  render(
    <TradingHoursTrigger
      stock={{
        title: 'AAPL',
        subtitle: 'Apple',
        source: 'ondo',
        sourceLogoUri: '',
      }}
      renderTrigger={<span>status</span>}
      defaultOpen
    />,
  );

  expect(
    screen.getByTestId('trading-hours-popover').getAttribute('data-open'),
  ).toBe('true');
});
