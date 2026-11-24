/** @jest-environment jsdom */
import { createContext, useContext, useMemo } from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import { TradingHoursTrigger } from '.';

import { fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IFetchUSMarketStatusResult } from '@onekeyhq/shared/types/swap/types';

let mockStatus: IFetchUSMarketStatusResult | undefined;

jest.mock('@onekeyhq/kit/src/hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en',
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
    formatDate: () => 'time',
  }),
}));
jest.mock('react-native', () => ({
  StyleSheet: { hairlineWidth: 1 },
  useWindowDimensions: () => ({ width: 1280, height: 800 }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useInterval', () => ({
  useInterval: () => undefined,
}));
jest.mock('@onekeyhq/kit/src/hooks/useUSMarketStatus', () => ({
  useUSMarketStatus: () => mockStatus,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));
jest.mock('@onekeyhq/components', () => {
  const Frame = ({
    children,
    bg,
    testID,
    onPress,
  }: PropsWithChildren<{
    bg?: string;
    testID?: string;
    onPress?: (event: unknown) => void;
  }>) =>
    onPress ? (
      <button type="button" data-bg={bg} data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-bg={bg} data-testid={testID}>
        {children}
      </div>
    );
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
    useMedia: () => ({ md: false }),
  };
});

afterEach(() => {
  jest.useRealTimers();
  mockStatus = undefined;
});

const CLOSED_NOTE = 'Closed on weekends and US market holidays.';
const FOOTNOTE =
  'Hours shown are for the underlying stock market. Stock tokens may trade 24/7 or on a different schedule.';

const sessionRowBg = () =>
  screen
    .getByTestId('trading-hours-session-row-content')
    .getAttribute('data-bg');

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
    expect(screen.queryByTestId('trading-hours-now-line')).toBeNull();
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
  expect(screen.getByText(ETranslations.trading_hours_overnight)).toBeTruthy();
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
  expect(screen.queryByTestId('trading-hours-now-line')).toBeNull();
  expect(sessionRowBg()).toBe('$bgSubdued');
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
