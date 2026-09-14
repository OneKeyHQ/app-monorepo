/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { PerpetualTradingBanner } from './PerpetualTradingBanner';

let mockTicker: string | undefined;
let mockDismissed = false;
jest.mock('../../hooks/useTokenDetail', () => ({
  useTokenDetail: () => ({
    tokenDetail: { symbol: 'AAPL' },
    perpsInfo: mockTicker ? { hlTicker: mockTicker } : undefined,
  }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Trade perpetuals' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ switchTab: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {},
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useBannerClosePersistAtom: () => [
    { ids: mockDismissed ? ['perps-trading-banner'] : [] },
    jest.fn(),
  ],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({ defaultLogger: {} }));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  appEventBus: {},
  EAppEventBusNames: {},
}));
jest.mock('@onekeyhq/shared/src/logger/scopes/perp/perpPageSource', () => ({
  setPerpPageEnterSource: jest.fn(),
  EPerpPageEnterSource: {},
}));
jest.mock('@onekeyhq/components', () => ({
  Icon: () => null,
  IconButton: () => null,
  SizableText: ({ children }: PropsWithChildren) => <span>{children}</span>,
  XStack: ({ children, opacity }: PropsWithChildren<{ opacity?: number }>) => (
    <div aria-hidden={opacity === 0 ? true : undefined}>{children}</div>
  ),
  Stack: () => <div data-testid="banner-space" />,
}));

beforeEach(() => {
  mockTicker = undefined;
  mockDismissed = false;
});

it('does not insert a banner on retry after initial detail failed or had no mapping', () => {
  const { rerender } = render(<PerpetualTradingBanner stableLayout />);
  mockTicker = 'xyz:AAPL';
  rerender(<PerpetualTradingBanner stableLayout />);
  expect(screen.queryByText(/Trade perpetuals/)).toBeNull();
});
it('preserves the slot if a refresh loses an existing mapping', () => {
  mockTicker = 'xyz:AAPL';
  const { rerender } = render(<PerpetualTradingBanner stableLayout />);
  expect(screen.getByText(/Trade perpetuals/)).toBeTruthy();
  mockTicker = undefined;
  rerender(<PerpetualTradingBanner stableLayout />);
  expect(
    screen.getByText(/Trade perpetuals/).closest('[aria-hidden=true]'),
  ).toBeTruthy();
  mockTicker = 'xyz:AAPL';
  rerender(<PerpetualTradingBanner stableLayout />);
  expect(screen.getByText(/Trade perpetuals/)).toBeTruthy();
});
it('does not reserve space for a dismissed banner', () => {
  mockDismissed = true;
  mockTicker = 'xyz:AAPL';
  const { container } = render(<PerpetualTradingBanner stableLayout />);
  expect(container.childElementCount).toBe(0);
});
it('preserves the existing dynamic behavior outside stable native layout', () => {
  const { rerender } = render(<PerpetualTradingBanner />);
  mockTicker = 'xyz:AAPL';
  rerender(<PerpetualTradingBanner />);
  expect(screen.getByText(/Trade perpetuals/)).toBeTruthy();
});

it('does not reserve a stale perpetual slot in a request-skipping detail', () => {
  mockTicker = 'xyz:AAPL';
  const { container, rerender } = render(
    <PerpetualTradingBanner stableLayout disabled />,
  );
  expect(container.childElementCount).toBe(0);
  mockTicker = undefined;
  rerender(<PerpetualTradingBanner stableLayout disabled />);
  expect(container.childElementCount).toBe(0);
});
