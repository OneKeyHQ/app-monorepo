/** @jest-environment jsdom */
import type { ReactNode } from 'react';

import { render } from '@testing-library/react';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ETabRoutes } from '@onekeyhq/shared/src/routes/tab';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { HeaderRight } from './HeaderRight';

let mockDesktop = true;
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    get isDesktop() {
      return mockDesktop;
    },
    isNative: false,
  },
}));
jest.mock('@onekeyhq/components', () => ({
  Spinner: () => null,
  useMedia: () => ({ md: true }),
}));
jest.mock('@onekeyhq/components/src/layouts/Navigation/Header', () => ({
  HeaderButtonGroup: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));
jest.mock(
  '@onekeyhq/kit/src/components/AccountSelector/NetworkSelectorTrigger',
  () => ({ NetworkSelectorTriggerHome: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/components/TabPageHeader/LegacyUniversalSearchInput',
  () => ({ LegacyUniversalSearchInput: () => null }),
);
jest.mock('../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: {} }),
  useIsAccountSelectorSyncLoading: () => false,
}));
jest.mock(
  '../../views/Discovery/components/MobileBrowser/TabCountButton',
  () => ({ __esModule: true, default: () => null }),
);
jest.mock('../../views/Discovery/pages/components/HistoryIconButton', () => ({
  HistoryIconButton: () => <button>History</button>,
}));
jest.mock('../AccountSelector/LazyAllNetworksManagerTrigger', () => ({
  LazyAllNetworksManagerTrigger: () => null,
}));
jest.mock('../MoreActionButton/LazyMoreActionButton', () => ({
  LazyMoreActionButton: () => null,
}));
jest.mock('./components', () => ({
  HeaderUpdateButton: () =>
    mockDesktop ? <button data-testid="update">Update</button> : null,
  HeaderNotificationIconButton: () => null,
  GiftAction: () => <button>Gift</button>,
  WalletConnectionForWeb: () => <button>Connect</button>,
}));

afterEach(() => {
  mockDesktop = true;
});

test.each([
  {
    tabRoute: ETabRoutes.Discovery,
    selectedHeaderTab: ETranslations.global_earn,
    action: 'Gift',
  },
  {
    tabRoute: ETabRoutes.Discovery,
    selectedHeaderTab: ETranslations.global_market,
    action: undefined,
  },
  {
    tabRoute: ETabRoutes.Discovery,
    selectedHeaderTab: undefined,
    action: 'History',
  },
  {
    tabRoute: ETabRoutes.WebviewPerpTrade,
    selectedHeaderTab: undefined,
    action: 'Connect',
  },
  {
    tabRoute: ETabRoutes.Swap,
    selectedHeaderTab: undefined,
    action: undefined,
  },
])(
  'compact desktop $tabRoute/$selectedHeaderTab retains update and its action',
  ({ tabRoute, selectedHeaderTab, action }) => {
    const view = render(
      <HeaderRight
        tabRoute={tabRoute}
        selectedHeaderTab={selectedHeaderTab}
        sceneName={EAccountSelectorSceneName.home}
      />,
    );
    expect(view.getAllByTestId('update')).toHaveLength(1);
    if (action) expect(view.getByText(action)).toBeTruthy();
  },
);

test('compact Perps custom controls retain exactly one update entry', () => {
  const view = render(
    <HeaderRight
      tabRoute={ETabRoutes.Perp}
      sceneName={EAccountSelectorSceneName.home}
      customHeaderRightItems={<button>Perps settings</button>}
    />,
  );
  expect(view.getAllByTestId('update')).toHaveLength(1);
  expect(view.getByText('Perps settings')).toBeTruthy();
});

test('non-desktop custom controls keep their existing content', () => {
  mockDesktop = false;
  const view = render(
    <HeaderRight
      tabRoute={ETabRoutes.Perp}
      sceneName={EAccountSelectorSceneName.home}
      customHeaderRightItems={<button>Perps settings</button>}
    />,
  );
  expect(view.queryByTestId('update')).toBeNull();
  expect(view.getByText('Perps settings')).toBeTruthy();
});
