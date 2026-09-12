/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { MarketBannerList, MarketBannerProvider } from './MarketBannerList';

import type { useMarketBannerList } from './useMarketBannerList';

let mockState: ReturnType<typeof useMarketBannerList>;
let mockIsSmallScreen = true;
jest.mock('./useMarketBannerList', () => ({
  useMarketBannerList: () => mockState,
}));
jest.mock('./useToMarketBannerDetail', () => ({
  useToMarketBannerDetail: () => jest.fn(),
}));
jest.mock('./MarketBannerItem', () => ({
  MarketBannerItem: ({ item }: { item: { _id: string } }) => (
    <div data-testid="banner">{item._id}</div>
  ),
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
  XStack: ({ children, pt }: PropsWithChildren<{ pt?: string }>) => (
    <div data-testid="reserved-space" data-padding-top={pt}>
      {children}
    </div>
  ),
  useMedia: () => ({ md: mockIsSmallScreen }),
}));

function Page() {
  return (
    <MarketBannerProvider>
      <MarketBannerList />
    </MarketBannerProvider>
  );
}
const populated = (id = 'banner') => ({
  bannerList: [{ _id: id }] as ReturnType<
    typeof useMarketBannerList
  >['bannerList'],
  isLoading: false,
  isFetched: true,
  scope: 'en-US:false',
});

beforeEach(() => {
  mockIsSmallScreen = true;
});

it('keeps native tablet banner padding aligned with the fixed header height', () => {
  mockIsSmallScreen = false;
  mockState = populated();
  render(<Page />);
  expect(screen.getByTestId('reserved-space').dataset.paddingTop).toBe('$2');
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

it('retains the latest successful banners when a refresh removes them', () => {
  mockState = populated('legacy');
  const { rerender } = render(<Page />);
  mockState = populated('modern');
  rerender(<Page />);
  mockState = { ...populated(), bannerList: [] };
  rerender(<Page />);
  expect(screen.getByTestId('banner').textContent).toBe('modern');
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

it('shows the first successful banners after an initial request failure', () => {
  mockState = { ...populated(), bannerList: [], isFetched: false };
  const { rerender } = render(<Page />);
  expect(screen.queryByTestId('banner')).toBeNull();
  mockState = populated();
  rerender(<Page />);
  expect(screen.getByTestId('banner')).toBeTruthy();
  mockState = { ...populated(), bannerList: [] };
  rerender(<Page />);
  expect(
    screen.getByTestId('banner').closest('[aria-hidden=true]'),
  ).toBeTruthy();
});

it('locks an empty header only after a successful retry returns no banners', () => {
  mockState = { ...populated(), bannerList: [], isFetched: false };
  const { rerender } = render(<Page />);
  mockState = { ...populated(), bannerList: [] };
  rerender(<Page />);
  mockState = populated();
  rerender(<Page />);
  expect(screen.queryByTestId('banner')).toBeNull();
});
