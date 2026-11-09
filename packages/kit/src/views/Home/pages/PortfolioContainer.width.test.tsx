/**
 * @jest-environment jsdom
 */
/* eslint-disable import/first */

import type { ReactNode } from 'react';

const mockTokenProps: Array<{
  tableLayout?: boolean;
  showRecentHistory?: boolean;
  nativeListSidecar?: ReactNode;
}> = [];
let mockNativeLayout: ((event: LayoutChangeEvent) => void) | undefined;
let mockTokenMounts = 0;

jest.mock('@onekeyhq/components', () => {
  const Box = ({
    children,
    onLayout,
  }: {
    children?: ReactNode;
    onLayout?: (event: LayoutChangeEvent) => void;
  }) => {
    if (onLayout) mockNativeLayout = onLayout;
    return <>{children}</>;
  };
  return {
    Stack: Box,
    YStack: Box,
    useMedia: () => ({ gtMd: false, gtXl: false }),
    useScrollContentTabBarOffset: () => 0,
  };
});
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { earn: 'earn' },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: false },
}));
jest.mock('../../../hooks/useListenTabFocusState', () => ({
  __esModule: true,
  default: () => {},
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: { account: { id: 'account' } } }),
}));
jest.mock('../../../states/jotai/contexts/deFiList', () => ({
  ProviderJotaiContextDeFiList: ({ children }: { children: ReactNode }) =>
    children,
}));
jest.mock('../../../states/jotai/contexts/historyList', () => ({
  ProviderJotaiContextHistoryList: ({ children }: { children: ReactNode }) =>
    children,
}));
jest.mock('../../DAppConnection/hooks/useActiveTabDAppInfo', () => ({
  __esModule: true,
  default: () => ({ result: undefined }),
}));
jest.mock('../../Earn/EarnProviderMirror', () => ({
  EarnProviderMirror: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../components/DeFiListBlock', () => ({
  DeFiListBlock: () => null,
}));
jest.mock('../components/EarnListView', () => ({
  EarnListView: () => null,
}));
jest.mock('../components/HomeScrollView', () => ({
  HomeScrollView: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('../components/HomeStickyHeaderContext', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return { HomeStickyHeaderContext: React.createContext(null) };
});
jest.mock('../components/HomeTokenListProvider', () => ({
  HomeTokenListProviderMirrorWrapper: ({ children }: { children: ReactNode }) =>
    children,
}));
jest.mock('../components/PopularTrading', () => ({
  PopularTrading: () => null,
}));
jest.mock('../components/PullToRefresh', () => ({
  PullToRefresh: () => null,
  onHomePageRefresh: () => {},
}));
jest.mock('../components/RecentHistory', () => ({
  RecentHistory: () => null,
}));
jest.mock('../components/SupportHub', () => ({
  SupportHub: () => null,
}));
jest.mock('../components/TokenListBlock', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    TokenListBlock: (props: (typeof mockTokenProps)[number]) => {
      mockTokenProps.push(props);
      React.useEffect(() => {
        mockTokenMounts += 1;
      }, []);
      return null;
    },
  };
});
jest.mock('../components/Upgrade', () => ({ Upgrade: () => null }));
jest.mock('./defiDesktopStickyDom', () => ({
  findOverflowAncestorFromLocalNode: () => null,
}));
jest.mock('./portfolioSidebarSticky', () => ({
  buildPortfolioSidebarStickyStyle: () => undefined,
}));

import { act, render } from '@testing-library/react';

import { PortfolioContainerWithProvider } from './PortfolioContainer';

import type { LayoutChangeEvent } from 'react-native';

function setWidth(width: number) {
  act(() => {
    mockNativeLayout?.({
      nativeEvent: { layout: { width } },
    } as LayoutChangeEvent);
  });
  return mockTokenProps.at(-1);
}

describe('Home spot list width', () => {
  beforeEach(() => {
    mockTokenProps.length = 0;
    mockNativeLayout = undefined;
    mockTokenMounts = 0;
  });

  it('switches at 768 and subtracts the sidebar without remounting the list', () => {
    render(<PortfolioContainerWithProvider />);

    expect(setWidth(767)?.tableLayout).toBeUndefined();
    expect(setWidth(768)?.tableLayout).toBe(true);
    expect(setWidth(1279)?.tableLayout).toBe(true);

    const withSidebar = setWidth(1280);
    expect(withSidebar?.nativeListSidecar).toBeTruthy();
    expect(withSidebar?.showRecentHistory).toBe(true);
    expect(withSidebar?.tableLayout).toBeUndefined();

    const withoutSidebar = setWidth(1279);
    expect(withoutSidebar?.nativeListSidecar).toBeNull();
    expect(withoutSidebar?.tableLayout).toBe(true);
    expect(mockTokenMounts).toBe(1);
  });
});
