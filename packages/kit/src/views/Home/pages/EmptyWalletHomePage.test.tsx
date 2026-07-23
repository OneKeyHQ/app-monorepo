import type { ReactNode } from 'react';

import { type ReactTestRenderer, act, create } from 'react-test-renderer';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HomeTestIDs } from '../testIDs';

import { EmptyWalletHomePage } from './EmptyWalletHomePage';

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const MockView = ({
    children,
    ...props
  }: {
    children?: ReactNode;
    [key: string]: unknown;
  }) => React.createElement('View', props, children);

  function Page({
    children,
    ...props
  }: {
    children?: ReactNode;
    testID?: string;
  }) {
    return <MockView {...props}>{children}</MockView>;
  }
  Page.Body = function PageBody({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  };
  Page.Container = function PageContainer({
    children,
  }: {
    children?: ReactNode;
  }) {
    return <>{children}</>;
  };

  return {
    KEYBOARD_AWARE_SCROLL_BOTTOM_OFFSET: 48,
    Keyboard: {
      AwareScrollView: ({
        children,
        ...props
      }: {
        children?: ReactNode;
        testID?: string;
      }) => <MockView {...props}>{children}</MockView>,
    },
    Page,
    Stack: ({ children }: { children?: ReactNode }) => <>{children}</>,
    YStack: ({ children }: { children?: ReactNode }) => <>{children}</>,
    useScrollContentTabBarOffset: () => 64,
  };
});

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeAndroid: false,
    isNativeIOS: true,
  },
}));

jest.mock('../../../components/TabPageHeader', () => ({
  TabPageHeader: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.createElement('View', {
      testID: 'empty-wallet-tab-page-header',
    });
  },
}));

jest.mock('../components/NotBakcedUp', () => ({
  NotBackedUpEmpty: () => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.createElement(
      'View',
      { testID: 'empty-wallet-not-backed-up-content' },
      React.createElement('View', {
        testID: 'home-not-backed-up-primary-backup',
      }),
      React.createElement('View', {
        testID: 'home-not-backed-up-more-backup-options',
      }),
    );
  },
}));

jest.mock('./HomeHeaderContainer', () => ({
  HomeHeaderContainer: ({ variant }: { variant: string }) => {
    const React = jest.requireActual<typeof import('react')>('react');
    return React.createElement('View', {
      testID: `empty-wallet-header-${variant}`,
    });
  },
}));

describe('EmptyWalletHomePage', () => {
  it('mounts only the lightweight not-backed-up page composition', () => {
    let view!: ReactTestRenderer;
    act(() => {
      view = create(
        <EmptyWalletHomePage
          variant="notBackedUp"
          sceneName={EAccountSelectorSceneName.home}
          tabBarBottomInset={96}
        />,
      );
    });

    const root = view.root;

    expect(
      root.findByProps({ testID: HomeTestIDs.emptyWalletPage }),
    ).toBeTruthy();
    expect(
      root.findAllByProps({
        testID: 'empty-wallet-not-backed-up-content',
      }),
    ).toHaveLength(1);
    expect(
      root.findByProps({
        testID: HomeTestIDs.notBackedUpPrimaryBackup,
      }),
    ).toBeTruthy();
    expect(
      root.findByProps({
        testID: HomeTestIDs.notBackedUpMoreBackupOptions,
      }),
    ).toBeTruthy();
    expect(
      root.findByProps({ testID: 'empty-wallet-header-notBackedUp' }),
    ).toBeTruthy();
    expect(
      root.findByProps({ testID: 'empty-wallet-tab-page-header' }),
    ).toBeTruthy();
    expect(
      root.findByProps({ testID: HomeTestIDs.emptyWalletScroll }).props,
    ).toEqual(
      expect.objectContaining({
        bottomOffset: 48,
        contentContainerStyle: { paddingBottom: 96 },
      }),
    );
    expect(
      root.findByProps({ testID: HomeTestIDs.emptyWalletScroll }).props
        .refreshControl,
    ).toBeUndefined();
    expect(
      root.findByProps({ testID: HomeTestIDs.emptyWalletScroll }).props
        .onRefresh,
    ).toBeUndefined();
    expect(
      root.findAllByProps({ testID: HomeTestIDs.tabPortfolio }),
    ).toHaveLength(0);
    expect(
      root.findAllByProps({ testID: HomeTestIDs.sendButton }),
    ).toHaveLength(0);
    expect(root.findAllByProps({ testID: 'HomeContainer' })).toHaveLength(0);
  });
});
