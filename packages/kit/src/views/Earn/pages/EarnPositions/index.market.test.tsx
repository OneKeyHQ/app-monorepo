/** @jest-environment jsdom */

import EarnPositions from '.';

import { render, screen } from '@testing-library/react';

let mockRouteParams: { focusMarket?: string; focusAt?: number } | undefined;
let mockWide = false;

jest.mock('@react-navigation/elements', () => ({ useHeaderHeight: () => 0 }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  const Page = Object.assign(Container, {
    Header: () => null,
    Body: Container,
  });
  return {
    Page,
    ScrollView: Container,
    YStack: Container,
    RefreshControl: () => null,
    useMedia: () => ({ gtMd: mockWide }),
    useScrollContentTabBarOffset: () => 0,
  };
});
jest.mock('@onekeyhq/kit/src/components/AccountSelector', () => ({
  AccountSelectorProviderMirror: ({
    children,
  }: {
    children: React.ReactNode;
  }) => children,
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({ params: mockRouteParams }),
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { earn: 'earn' },
}));
jest.mock('../../EarnProviderMirror', () => ({
  EarnProviderMirror: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../components/PortfolioTabContent', () => ({
  PortfolioTabContent: () => <div>Previous portfolio</div>,
}));
jest.mock('../../components/EarnPortfolioSettings', () => ({
  EarnPortfolioSettingsTrigger: () => null,
}));
jest.mock('../../components/ScopedEarnWindowReturn', () => ({
  ScopedEarnWindowReturn: () => null,
}));
jest.mock('../../hooks/useEarnHideSmallAssets', () => ({
  useEarnHideSmallAssets: () => ({ hideSmallAssets: false }),
}));
jest.mock('../../hooks/useEarnPortfolio', () => ({
  useEarnPortfolio: () => ({ refresh: jest.fn() }),
}));
jest.mock('../../hooks/useHeaderHeightCacheKey', () => ({
  useHeaderHeightCacheKey: () => '',
}));
jest.mock('../../hooks/useNativeStackHeaderHeightEstimate', () => ({
  useNativeStackHeaderHeightEstimate: () => 0,
}));
jest.mock('../../hooks/useSettledHeaderHeight', () => ({
  useSettledHeaderHeight: () => ({ paddingTop: 0, isSettled: true }),
}));
jest.mock('../../hooks/useStakingPendingTxs', () => ({
  useStakingPendingTxsByInfo: () => undefined,
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: () => 'Portfolio' }),
}));
jest.mock('./mobile/useMyPortfolioLayout', () => ({
  useMyPortfolioLayout: () => false,
}));
jest.mock('./mobile/MyPortfolioPage', () => ({
  MyPortfolioPage: ({
    marketRequest,
    tableLayout,
  }: {
    marketRequest?: { marketKey: string; at: number };
    tableLayout: boolean;
  }) => (
    <div>
      {marketRequest?.marketKey} {tableLayout ? 'wide' : 'narrow'}
    </div>
  ),
}));

beforeEach(() => {
  mockWide = false;
  mockRouteParams = undefined;
});

it('opens the market controls on a narrow non-native layout and keeps the ordinary portfolio', () => {
  const view = render(<EarnPositions />);
  expect(screen.getByText('Previous portfolio')).toBeTruthy();

  mockRouteParams = { focusMarket: 'aave:evm--1:market', focusAt: 123 };
  view.rerender(<EarnPositions />);
  expect(screen.getByText('aave:evm--1:market narrow')).toBeTruthy();
  expect(screen.queryByText('Previous portfolio')).toBeNull();
});
