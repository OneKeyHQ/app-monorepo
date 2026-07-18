import type { ReactNode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { HomeHeaderContainer } from './HomeHeaderContainer';

const mockTestGlobal = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HeaderScrollGestureWrapper: ({
      children,
      onRefresh,
    }: {
      children?: ReactNode;
      onRefresh?: () => void;
    }) =>
      React.createElement(
        'View',
        { testID: 'header-scroll-gesture', onRefresh },
        children,
      ),
    Stack: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('View', props, children),
    YStack: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('View', props, children),
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    account: { wallet: { homePageViewed: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

jest.mock('../../../hooks/useHomeBalanceState', () => ({
  useHomeBalanceState: () => 'zero',
}));

jest.mock('../../../states/jotai/contexts/accountOverview', () => ({
  useWalletTopBannersAtom: () => [{ banners: [] }],
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      wallet: { id: 'hd-1', type: 'hd', backuped: false },
      account: { id: 'account-1' },
      network: { id: 'network-1' },
      vaultSettings: {},
    },
  }),
}));

jest.mock(
  '../components/HomeTokenListProvider/HomeTokenListProviderMirror',
  () => ({
    HomeTokenListProviderMirror: ({ children }: { children?: ReactNode }) =>
      children,
  }),
);

jest.mock('../components/PullToRefresh', () => ({
  onHomePageRefresh: jest.fn(),
}));

const { onHomePageRefresh: mockOnHomePageRefresh } = jest.requireMock<{
  onHomePageRefresh: jest.Mock;
}>('../components/PullToRefresh');

jest.mock('../components/WalletActions', () => ({
  WalletActions: () => null,
}));

jest.mock('../components/WalletBanner', () => () => null);

jest.mock('./HomeOverviewContainer', () => ({
  HomeOverviewContainer: () => null,
}));

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterAll(() => {
  delete mockTestGlobal.IS_REACT_ACT_ENVIRONMENT;
});

describe('HomeHeaderContainer refresh ownership', () => {
  it('keeps refresh gestures out of the not-backed-up page only', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<HomeHeaderContainer variant="notBackedUp" />);
    });
    expect(
      view.root.findAllByProps({ testID: 'header-scroll-gesture' }),
    ).toHaveLength(0);

    act(() => {
      view.update(<HomeHeaderContainer variant="normal" />);
    });
    const normalRefreshOwners = view.root.findAllByProps({
      testID: 'header-scroll-gesture',
    });
    expect(normalRefreshOwners).toHaveLength(2);
    normalRefreshOwners.forEach((owner) => {
      expect(owner.props.onRefresh).toBe(mockOnHomePageRefresh);
    });
  });
});
