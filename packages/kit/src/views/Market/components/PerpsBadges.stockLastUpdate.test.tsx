/** @jest-environment jsdom */
import type { MouseEventHandler, PropsWithChildren } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

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

jest.mock('@onekeyhq/kit/src/hooks/useFormatDate', () => ({
  __esModule: true,
  default: () => ({
    formatDate: () => '',
    formatDuration: () => 'opens in 6h',
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

  it('opens trading hours after loading without opening the parent token selector', async () => {
    mockResolveVariant.mockReturnValue(EUSMarketStatusVariant.Closed);
    const openTokenSelector = jest.fn();
    const { rerender } = render(
      <div
        role="button"
        tabIndex={0}
        onKeyDown={openTokenSelector}
        onClick={openTokenSelector}
      >
        <StockMarketStatusBadge stock={stock} />
      </div>,
    );

    fireEvent.click(
      screen.getByText(ETranslations.trading_hours_market_closed),
    );
    expect(openTokenSelector).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(mockShowTradingHoursDialog).toHaveBeenCalledTimes(1),
    );

    rerender(
      <div
        role="button"
        tabIndex={0}
        onKeyDown={openTokenSelector}
        onClick={openTokenSelector}
      >
        <StockMarketStatusBadge stock={{ ...stock, isOpen: true }} />
      </div>,
    );
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
