import type { ReactNode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { HomeHeaderContainer } from './HomeHeaderContainer';

import type { IHomeDisplayModel } from '../model/policies/homeDisplayModelPolicy';

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
    XStack: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('XStack', props, children),
    YStack: ({ children, ...props }: { children?: ReactNode }) =>
      React.createElement('YStack', props, children),
    Skeleton: (props: Record<string, unknown>) =>
      React.createElement('Skeleton', props),
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

let mockDisplayModel: IHomeDisplayModel = {
  actions: {
    kind: 'zero',
    items: ['addMoney', 'receive', 'more'],
  },
  balance: {
    kind: 'ready',
    authority: 'live',
    balance: { amount: '0', currency: 'usd' },
    revision: 'revision-zero',
  },
  banner: { kind: 'hidden' },
  body: { kind: 'portfolio' },
  fundingVerdict: 'zero',
  navigation: { kind: 'default' },
};
let mockBanners: unknown[] = [];

jest.mock('../../../hooks/useHomeBalanceState', () => ({
  useHomeDisplayModel: () => mockDisplayModel,
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

const mockRefreshAllSections = jest.fn();
jest.mock('../model/react/useHomeRefreshIntents', () => ({
  useHomeRefreshIntents: () => ({
    refreshAllSections: mockRefreshAllSections,
  }),
}));

jest.mock('../components/WalletActions', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    WalletActions: ({ actionFamily }: { actionFamily: 'funded' | 'zero' }) =>
      React.createElement('View', {
        actionFamily,
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
      balancePresentation?: IHomeDisplayModel['balance'];
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
  mockDisplayModel = {
    actions: {
      kind: 'zero',
      items: ['addMoney', 'receive', 'more'],
    },
    balance: {
      kind: 'ready',
      authority: 'live',
      balance: { amount: '0', currency: 'usd' },
      revision: 'revision-zero',
    },
    banner: { kind: 'hidden' },
    body: { kind: 'portfolio' },
    fundingVerdict: 'zero',
    navigation: { kind: 'default' },
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
    ).toEqual(mockDisplayModel.balance);

    act(() => {
      view.update(<HomeHeaderContainer variant="normal" />);
    });
    const normalRefreshOwners = view.root.findAllByProps({
      testID: 'header-scroll-gesture',
    });
    expect(normalRefreshOwners).toHaveLength(2);
    normalRefreshOwners.forEach((owner) => {
      expect(owner.props.onRefresh).toBe(mockRefreshAllSections);
    });
  });

  it('consumes independent balance, action, and banner presentations', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(<HomeHeaderContainer variant="normal" />);
    });
    expect(
      view.root.findByProps({ testID: 'wallet-actions' }).props.actionFamily,
    ).toBe(mockDisplayModel.actions.kind);
    expect(
      view.root.findByProps({ testID: 'home-overview' }).props
        .balancePresentation,
    ).toBe(mockDisplayModel.balance);
    expect(view.root.findByProps({ testID: 'wallet-banner' }).props).toEqual(
      expect.objectContaining({ hidden: true }),
    );
    expect(view.root.findAllByProps({ minHeight: 182 }).length).toBeGreaterThan(
      0,
    );

    mockDisplayModel = {
      actions: {
        kind: 'funded',
        items: ['send', 'receive', 'swap'],
      },
      balance: {
        kind: 'ready',
        authority: 'live',
        balance: { amount: '12', currency: 'usd' },
        revision: 'revision-funded',
      },
      banner: { kind: 'eligible' },
      body: { kind: 'portfolio' },
      fundingVerdict: 'funded',
      navigation: { kind: 'default' },
    };
    mockBanners = [
      {
        _id: 'banner-1',
        id: 'banner-1',
        src: '',
        title: 'Banner',
        description: '',
        button: '',
        hrefType: null,
        href: null,
        mode: null,
        payload: null,
        rank: 1,
        closeable: true,
        closeForever: false,
        useSystemBrowser: false,
        theme: 'light',
        position: 'home',
        networkId: null,
        networkIds: [],
        icon: null,
      },
    ];
    act(() => {
      view.unmount();
      view = create(<HomeHeaderContainer variant="normal" />);
    });
    expect(
      view.root.findByProps({ testID: 'wallet-actions' }).props.actionFamily,
    ).toBe(mockDisplayModel.actions.kind);
    expect(
      view.root.findByProps({ testID: 'home-overview' }).props
        .balancePresentation,
    ).toBe(mockDisplayModel.balance);
    expect(view.root.findByProps({ testID: 'wallet-banner' }).props).toEqual(
      expect.objectContaining({ hidden: false }),
    );
    expect(view.root.findAllByProps({ minHeight: 292 }).length).toBeGreaterThan(
      0,
    );
  });

  it('keeps the action skeleton independent from a provisional amount', () => {
    mockDisplayModel = {
      actions: { kind: 'loading' },
      balance: {
        authority: 'provisional',
        balance: { amount: '0', currency: 'usd' },
        kind: 'ready',
        revision: 'revision-provisional',
      },
      banner: { kind: 'pending' },
      body: { kind: 'portfolio' },
      fundingVerdict: 'unknown',
      navigation: { kind: 'default' },
    };

    let view!: ReactTestRenderer;
    act(() => {
      view = create(<HomeHeaderContainer variant="normal" />);
    });

    expect(
      view.root.findByProps({ testID: 'home-wallet-actions-skeleton' }).props.w,
    ).toBe('100%');
    for (let index = 0; index < 4; index += 1) {
      expect(
        view.root.findAllByProps({
          testID: `home-wallet-actions-skeleton-item-${index}`,
        }).length,
      ).toBeGreaterThan(0);
    }
    expect(view.root.findAllByProps({ testID: 'wallet-actions' })).toHaveLength(
      0,
    );
    expect(view.root.findAllByProps({ minHeight: 182 }).length).toBeGreaterThan(
      0,
    );
  });
});
