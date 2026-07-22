import type { ReactNode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { HomeHeaderContainer } from './HomeHeaderContainer';

import type { IHomeBalancePresentation } from '../../../hooks/useHomeBalanceState';

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
      React.createElement('YStack', props, children),
  };
});

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    account: { wallet: { homePageViewed: jest.fn() } },
    wallet: { homeUi: { homeHeaderDecision: jest.fn() } },
  },
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));

let mockBalancePresentation: IHomeBalancePresentation = {
  balanceState: 'zero',
  correlated: {
    kind: 'ready',
    balance: { amount: '0', currency: 'usd' },
    balanceState: 'zero',
    revision: 'revision-zero',
    showPositiveBanner: false,
  },
};
let mockBanners: unknown[] = [];

jest.mock('../../../hooks/useHomeBalanceState', () => ({
  useHomeBalancePresentation: () => mockBalancePresentation,
}));

jest.mock('../../../states/jotai/contexts/home', () => ({
  useHomeResource: () => ({
    kind: 'ready',
    data: {
      banners: mockBanners,
      referralEligibility: null,
      tronResource: null,
      isBotWalletReceiveBlocked: false,
    },
  }),
}));

jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: {
      network: { id: 'all-network', isAllNetworks: true },
      wallet: { id: 'hd-1', type: 'hd', backuped: false },
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

jest.mock('../components/WalletActions', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    WalletActions: ({
      balancePresentation,
    }: {
      balancePresentation: IHomeBalancePresentation;
    }) =>
      React.createElement('View', {
        balancePresentation,
        testID: 'wallet-actions',
      }),
  };
});

jest.mock('../components/WalletBanner', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return ({ hidden }: { hidden: boolean }) =>
    React.createElement('View', { hidden, testID: 'wallet-banner' });
});

jest.mock('./HomeOverviewContainer', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    HomeOverviewContainer: ({
      balancePresentation,
    }: {
      balancePresentation?: IHomeBalancePresentation['correlated'];
    }) =>
      React.createElement('View', {
        balancePresentation,
        testID: 'home-overview',
      }),
  };
});

beforeAll(() => {
  mockTestGlobal.IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(() => {
  mockBalancePresentation = {
    balanceState: 'zero',
    correlated: {
      kind: 'ready',
      balance: { amount: '0', currency: 'usd' },
      balanceState: 'zero',
      revision: 'revision-zero',
      showPositiveBanner: false,
    },
  };
  mockBanners = [];
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
    expect(
      view.root.findByProps({ testID: 'home-overview' }).props
        .balancePresentation,
    ).toEqual(mockBalancePresentation.correlated);

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

  it('passes one correlated balance decision to actions, banner, and height', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<HomeHeaderContainer variant="normal" />);
    });
    expect(
      view.root.findByProps({ testID: 'wallet-actions' }).props
        .balancePresentation,
    ).toBe(mockBalancePresentation);
    expect(
      view.root.findByProps({ testID: 'home-overview' }).props
        .balancePresentation,
    ).toBe(mockBalancePresentation.correlated);
    expect(view.root.findByProps({ testID: 'wallet-banner' }).props).toEqual(
      expect.objectContaining({ hidden: true }),
    );
    expect(view.root.findAllByProps({ minHeight: 182 }).length).toBeGreaterThan(
      0,
    );

    mockBalancePresentation = {
      balanceState: 'positive',
      correlated: {
        kind: 'ready',
        balance: { amount: '12', currency: 'usd' },
        balanceState: 'positive',
        revision: 'revision-funded',
        showPositiveBanner: true,
      },
    };
    mockBanners = [{ id: 'banner-1' }];
    act(() => {
      view.unmount();
      view = create(<HomeHeaderContainer variant="normal" />);
    });
    expect(
      view.root.findByProps({ testID: 'wallet-actions' }).props
        .balancePresentation,
    ).toBe(mockBalancePresentation);
    expect(
      view.root.findByProps({ testID: 'home-overview' }).props
        .balancePresentation,
    ).toBe(mockBalancePresentation.correlated);
    expect(view.root.findByProps({ testID: 'wallet-banner' }).props).toEqual(
      expect.objectContaining({ hidden: false }),
    );
    expect(view.root.findAllByProps({ minHeight: 292 }).length).toBeGreaterThan(
      0,
    );
  });
});
