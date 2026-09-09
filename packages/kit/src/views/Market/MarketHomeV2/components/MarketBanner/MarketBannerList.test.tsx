/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { MarketBannerList, MarketBannerProvider } from './MarketBannerList';

import type { useMarketBannerList } from './useMarketBannerList';

let mockState: ReturnType<typeof useMarketBannerList>;
jest.mock('./useMarketBannerList', () => ({
  useMarketBannerList: () => mockState,
}));
jest.mock('./useToMarketBannerDetail', () => ({
  useToMarketBannerDetail: () => jest.fn(),
}));
jest.mock('./MarketBannerItem', () => ({
  MarketBannerItem: () => <div data-testid="banner" />,
}));
jest.mock('./MarketBannerItemSkeleton', () => ({
  MarketBannerItemSkeleton: () => <div data-testid="skeleton" />,
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/components', () => ({
  ScrollGuard: ({ children }: PropsWithChildren) => <div>{children}</div>,
  ScrollView: ({
    children,
    opacity,
  }: PropsWithChildren<{ opacity?: number }>) => (
    <div aria-hidden={opacity === 0 ? true : undefined}>{children}</div>
  ),
  XStack: ({ children }: PropsWithChildren) => (
    <div data-testid="reserved-space">{children}</div>
  ),
  useMedia: () => ({ md: true }),
}));

function Page() {
  return (
    <MarketBannerProvider>
      <MarketBannerList />
    </MarketBannerProvider>
  );
}
const populated = () => ({
  bannerList: [{ _id: 'banner' }] as ReturnType<
    typeof useMarketBannerList
  >['bannerList'],
  isLoading: false,
  isFetched: true,
  scope: 'en-US:false',
});

it('does not insert a banner after the native page has started without one', () => {
  mockState = {
    bannerList: [],
    isLoading: false,
    isFetched: true,
    scope: 'en-US:false',
  };
  const { rerender } = render(<Page />);
  mockState = populated();
  rerender(<Page />);
  expect(screen.queryByTestId('banner')).toBeNull();
});

it('keeps the occupied header height when a refresh removes all banners', () => {
  mockState = populated();
  const { rerender } = render(<Page />);
  expect(screen.getByTestId('banner')).toBeTruthy();
  mockState = {
    bannerList: [],
    isLoading: false,
    isFetched: true,
    scope: 'en-US:false',
  };
  rerender(<Page />);
  expect(
    screen.getByTestId('banner').closest('[aria-hidden=true]'),
  ).toBeTruthy();
});

it('reevaluates banner visibility when the locale has cached banners', () => {
  mockState = { ...populated(), bannerList: [] };
  const { rerender } = render(<Page />);
  mockState = { ...populated(), scope: 'zh-CN:false' };
  rerender(<Page />);
  expect(screen.getByTestId('banner')).toBeTruthy();
});
