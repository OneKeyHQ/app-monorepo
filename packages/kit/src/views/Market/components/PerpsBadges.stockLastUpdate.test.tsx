/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { EUSMarketStatusVariant } from '@onekeyhq/shared/src/utils/tradingHoursUtils';
import type { IMarketStockInfo } from '@onekeyhq/shared/types/marketV2';

import { StockIsOpenBadge } from './PerpsBadges';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  Image: () => null,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  Stack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  XStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  YStack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  useMedia: () => ({ gtMd: true }),
  LazyTooltip: () => null,
  LazyPopover: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/TradingHoursPanel', () => ({
  TradingHoursTrigger: () => null,
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

const mockResolveVariant = jest.fn<EUSMarketStatusVariant | undefined, []>();

jest.mock('@onekeyhq/shared/src/utils/tradingHoursUtils', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/utils/tradingHoursUtils')
  >('@onekeyhq/shared/src/utils/tradingHoursUtils');
  return {
    ...actual,
    isOndoUSMarketStock: () => true,
    resolveUSMarketStatusVariant: () => mockResolveVariant(),
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
  });

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
