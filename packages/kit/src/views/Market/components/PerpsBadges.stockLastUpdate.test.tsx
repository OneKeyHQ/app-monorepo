/** @jest-environment jsdom */
import type { MouseEventHandler, PropsWithChildren } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { resolveUSMarketStatusVariant } from '@onekeyhq/shared/src/utils/tradingHoursUtils';
import { EUSMarketStatusVariant } from '@onekeyhq/shared/src/utils/tradingHoursUtils';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import { StockIsOpenBadge, StockMarketStatusBadge } from './PerpsBadges';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

const mockShowTradingHoursDialog = jest.fn();

jest.mock('@onekeyhq/components', () => ({
  Dialog: {
    show: (...args: unknown[]) => {
      mockShowTradingHoursDialog(...args);
    },
  },
  Icon: () => null,
  Image: () => null,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  Stack: ({
    children,
    onPress,
  }: PropsWithChildren<{ onPress?: MouseEventHandler<HTMLButtonElement> }>) => (
    <button type="button" onClick={onPress}>
      {children}
    </button>
  ),
  XStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  YStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  useMedia: () => ({ md: true }),
  LazyTooltip: () => null,
  LazyPopover: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useInterval', () => ({
  useInterval: () => undefined,
}));

const mockFormatDuration = jest.fn((_duration: unknown) => 'opens in 6h');

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({
    formatDate: () => '',
    formatDuration: (duration: unknown) => mockFormatDuration(duration),
  }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useUSMarketStatus', () => ({
  useUSMarketStatus: () => undefined,
}));

const mockResolveVariant = jest.fn<
  EUSMarketStatusVariant | undefined,
  [Parameters<typeof resolveUSMarketStatusVariant>[0]]
>();

jest.mock('@onekeyhq/shared/src/utils/tradingHoursUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/tradingHoursUtils')
  >('@onekeyhq/shared/src/utils/tradingHoursUtils');
  return {
    ...actual,
    resolveUSMarketStatusVariant: (
      params: Parameters<typeof actual.resolveUSMarketStatusVariant>[0],
    ) => mockResolveVariant(params),
  };
});

jest.mock('../utils/stockLastUpdate', () => ({
  formatStockLastUpdateTime: (value?: string) =>
    value ? '07:58 UTC+8' : undefined,
}));

const stock: IMarketStockInfo = {
  title: 'AAPL',
  subtitle: 'Apple',
  sourceLogoUri: '',
  source: 'ondo',
  isOpen: false,
  priceUpdatedAt: '2026-09-15T23:58:00.007Z',
  // A closed market also counts down to the next open; both segments share the
  // row, the last update first.
  nextOpenMinutes: 360,
};

function renderBadge(overrides?: Partial<IMarketStockInfo>) {
  return render(
    <StockIsOpenBadge
      stock={{ ...stock, ...overrides }}
      disableTooltip
      variant="inline"
    />,
  );
}

describe('StockIsOpenBadge last update segment', () => {
  afterEach(() => {
    mockResolveVariant.mockReset();
    jest.useRealTimers();
  });

  it('consumes loading presses once and cancels them when the stock changes', async () => {
    mockResolveVariant.mockReturnValue(EUSMarketStatusVariant.Closed);
    const openTokenSelector = jest.fn();
    const badges = (first?: IMarketStockInfo, second?: IMarketStockInfo) => (
      <div
        role="button"
        tabIndex={0}
        onKeyDown={openTokenSelector}
        onClick={openTokenSelector}
      >
        <StockMarketStatusBadge stock={first} />
        <StockMarketStatusBadge stock={second} />
      </div>
    );
    const { rerender } = render(badges(stock, stock));
    screen
      .getAllByText(ETranslations.trading_hours_market_closed)
      .forEach((badge) => {
        fireEvent.click(badge);
      });
    expect(openTokenSelector).not.toHaveBeenCalled();

    const replacement = { ...stock, title: 'TSLA', subtitle: 'Tesla' };
    rerender(badges({ ...stock, isOpen: true }, replacement));
    await act(async () => {
      await import('@onekeyhq/kit/src/components/TradingHoursPanel');
    });
    expect(mockShowTradingHoursDialog).toHaveBeenCalledTimes(1);
    expect(mockShowTradingHoursDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        renderContent: expect.objectContaining({
          props: expect.objectContaining({
            stock: expect.objectContaining({ title: stock.title }),
          }),
        }),
      }),
    );

    rerender(badges(undefined, replacement));
    rerender(badges(stock, replacement));
    rerender(badges({ ...stock, isUSListing: false }, replacement));
    rerender(badges(stock, replacement));
    expect(mockShowTradingHoursDialog).toHaveBeenCalledTimes(1);
  });

  it.each(['ondo', 'xstock', 'bstock'])(
    'shows the underlying market status for %s',
    (source) => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-15T15:00:00Z'));
      const actual = jest.requireActual<
        typeof import('@onekeyhq/shared/src/utils/tradingHoursUtils')
      >('@onekeyhq/shared/src/utils/tradingHoursUtils');
      mockResolveVariant.mockImplementation(
        actual.resolveUSMarketStatusVariant,
      );

      renderBadge({ source, isOpen: true });

      expect(screen.getByText('trading_hours.regular_market')).toBeTruthy();
    },
  );

  it.each([
    EUSMarketStatusVariant.Closed,
    EUSMarketStatusVariant.Overnight,
    EUSMarketStatusVariant.Halted,
  ])('shows the last update while the market is %s', (variant) => {
    mockResolveVariant.mockReturnValue(variant);

    renderBadge();

    expect(screen.getByText('market.last_updated 07:58 UTC+8')).toBeTruthy();
  });

  it('leaves the timestamp out for the token price, which trades live', () => {
    mockResolveVariant.mockReturnValue(EUSMarketStatusVariant.Closed);

    render(
      <StockIsOpenBadge
        stock={stock}
        disableTooltip
        variant="inline"
        showLastUpdate={false}
      />,
    );

    expect(screen.queryByText(/market.last_updated/)).toBeNull();
  });

  it.each([
    EUSMarketStatusVariant.Open,
    EUSMarketStatusVariant.PreMarket,
    EUSMarketStatusVariant.PostMarket,
  ])('leaves the quote timestamp out while the market is %s', (variant) => {
    mockResolveVariant.mockReturnValue(variant);

    renderBadge();

    expect(screen.queryByText('market.last_updated 07:58 UTC+8')).toBeNull();
  });

  it('renders nothing extra when the feed carries no price timestamp', () => {
    mockResolveVariant.mockReturnValue(EUSMarketStatusVariant.Closed);

    renderBadge({ priceUpdatedAt: undefined });

    expect(screen.queryByText(/market.last_updated/)).toBeNull();
  });

  it('keeps the badge variant free of the timestamp', () => {
    mockResolveVariant.mockReturnValue(EUSMarketStatusVariant.Closed);

    render(<StockIsOpenBadge stock={stock} disableTooltip variant="badge" />);

    expect(screen.queryByText(/market.last_updated/)).toBeNull();
  });
});

describe('StockMarketStatusBadge token price mode', () => {
  afterEach(() => {
    mockResolveVariant.mockReset();
    mockShowTradingHoursDialog.mockReset();
  });

  it('reports a 7×24 token as trading and explains it on press', () => {
    // The listing itself is closed; the token chip must not follow it.
    mockResolveVariant.mockReturnValue(EUSMarketStatusVariant.Closed);
    render(
      <StockMarketStatusBadge
        stock={stock}
        variant="inline"
        showLastUpdate
        tokenTrading={{
          tradingHours: { days: '7 × 24', isMarketOpen: true },
          isTradable: true,
          isStale: false,
        }}
      />,
    );
    expect(
      screen.getByText(ETranslations.market_token_trading__title),
    ).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.trading_hours_market_closed),
    ).toBeNull();
    // A tradable token's quote is live, so no last update is shown.
    expect(screen.queryByText(/07:58 UTC\+8/)).toBeNull();

    fireEvent.click(
      screen.getByText(ETranslations.market_token_trading__title),
    );
    expect(mockShowTradingHoursDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: ETranslations.market_token_trading__title,
        description: ETranslations.market_token_trading_24_7__desc,
      }),
    );
  });

  it('reports a closed 24/5 token with a countdown but no last update', () => {
    mockResolveVariant.mockReturnValue(EUSMarketStatusVariant.Open);
    render(
      <StockMarketStatusBadge
        stock={{ ...stock, isOpen: true }}
        variant="inline"
        showLastUpdate
        tokenTrading={{
          tradingHours: { days: '5 × 24', isMarketOpen: false },
          isTradable: true,
          isStale: false,
        }}
      />,
    );
    expect(
      screen.getByText(ETranslations.trading_hours_market_closed),
    ).toBeTruthy();
    // The token price keeps moving while closed, so the share's last move
    // must not be reported against it.
    expect(screen.queryByText(/07:58 UTC\+8/)).toBeNull();
    expect(screen.getByText(ETranslations.market_opens_in)).toBeTruthy();
  });

  it('reports a paused token as halted', () => {
    render(
      <StockMarketStatusBadge
        stock={stock}
        variant="inline"
        tokenTrading={{
          tradingHours: { days: '7 × 24', isMarketOpen: true, isPaused: true },
          isTradable: false,
          isStale: false,
        }}
      />,
    );
    expect(
      screen.getByText(ETranslations.trading_hours_trading_halts),
    ).toBeTruthy();
  });

  it('reports a disabled 7×24 token as halted instead of trading', () => {
    render(
      <StockMarketStatusBadge
        stock={stock}
        variant="inline"
        tokenTrading={{
          tradingHours: { days: '7 × 24', isMarketOpen: true },
          isTradable: false,
          isStale: false,
        }}
      />,
    );
    expect(
      screen.getByText(ETranslations.trading_hours_trading_halts),
    ).toBeTruthy();
    expect(
      screen.queryByText(ETranslations.market_token_trading__title),
    ).toBeNull();
  });

  it('ignores a cached open flag after the token list fails to refresh', () => {
    jest.useFakeTimers();
    // Saturday noon New York: the US market is closed for the weekend.
    jest.setSystemTime(new Date('2026-01-17T17:00:00Z'));
    render(
      <StockMarketStatusBadge
        stock={stock}
        variant="inline"
        tokenTrading={{
          tradingHours: { days: '5 × 24', isMarketOpen: true },
          isTradable: true,
          isStale: true,
        }}
      />,
    );
    expect(
      screen.getByText(ETranslations.trading_hours_market_closed),
    ).toBeTruthy();
    jest.useRealTimers();
  });

  it("counts down with the token's own next open, not the listing's", () => {
    mockFormatDuration.mockClear();
    render(
      <StockMarketStatusBadge
        stock={{
          ...stock,
          nextOpenMinutes: undefined,
          // The listing reopens much later than the token.
          nextOpenTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        }}
        variant="inline"
        tokenTrading={{
          tradingHours: {
            days: '5 × 24',
            isMarketOpen: false,
            nextOpenMinutes: 60,
          },
          isTradable: true,
          isStale: false,
        }}
      />,
    );
    expect(mockFormatDuration).toHaveBeenLastCalledWith({
      hours: 1,
      minutes: 0,
    });
  });

  it('keeps a closed token out of the listing trading-hours panel', async () => {
    mockResolveVariant.mockReturnValue(EUSMarketStatusVariant.Open);
    render(
      <StockMarketStatusBadge
        stock={{ ...stock, isOpen: true }}
        variant="inline"
        tokenTrading={{
          tradingHours: { days: '5 × 24', isMarketOpen: false },
          isTradable: true,
          isStale: false,
        }}
      />,
    );
    fireEvent.click(
      screen.getByText(ETranslations.trading_hours_market_closed),
    );
    await act(async () => {
      await import('@onekeyhq/kit/src/components/TradingHoursPanel');
    });
    expect(mockShowTradingHoursDialog).not.toHaveBeenCalled();
  });
});
