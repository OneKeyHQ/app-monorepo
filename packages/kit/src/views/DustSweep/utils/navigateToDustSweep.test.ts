import { createIntl } from 'react-intl';

import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  ERootRoutes,
  ETabHomeRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import type { IDustSweepRouteParams } from '@onekeyhq/shared/types/swap/dustSweep';

import { navigateToDustSweep } from './navigateToDustSweep';

const mockNavigate = jest.fn<void, unknown[]>();
const mockExpand = jest.fn<void, unknown[]>();
const mockDialog = jest.fn<void, unknown[]>();

jest.mock('@onekeyhq/components', () => ({
  Dialog: { show: (...args: unknown[]) => mockDialog(...args) },
  rootNavigationRef: {
    current: { navigate: (...args: unknown[]) => mockNavigate(...args) },
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceApp: {
      openExtensionExpandTab: (...args: unknown[]) => mockExpand(...args),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isExtensionUiPopup: false, isExtensionUiSidePanel: false },
}));
jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {
    isWatchingWallet: ({ walletId }: { walletId: string }) =>
      walletId === 'watching',
    isExternalWallet: ({ walletId }: { walletId: string }) =>
      walletId === 'external',
  },
}));

const messages: Record<string, string> = {
  [ETranslations.title_dust_sweep]: 'Dust Sweep',
  [ETranslations.swap_page_alert_account_does_not_support_swap]:
    'Unsupported account',
  [ETranslations.global_got_it]: 'Got it',
};
const intl = createIntl({ locale: 'en', messages });

const routeParams: IDustSweepRouteParams = {
  walletId: 'wallet',
  accountId: 'account',
  indexedAccountId: 'indexed-account',
  networkId: 'evm--1',
  entry: 'tokenListHeader',
};

beforeEach(() => {
  jest.clearAllMocks();
  platformEnv.isExtensionUiPopup = false;
  platformEnv.isExtensionUiSidePanel = false;
});

it.each(['isExtensionUiPopup', 'isExtensionUiSidePanel'] as const)(
  'expands %s with the original route parameters',
  async (mode) => {
    platformEnv[mode] = true;
    await navigateToDustSweep({
      params: routeParams,
      intl,
    });
    expect(mockExpand).toHaveBeenCalledWith({
      path: '/dust-sweep',
      params: routeParams,
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  },
);

it('opens the Home sub page with its existing pop behavior', async () => {
  await navigateToDustSweep({
    params: routeParams,
    intl,
  });
  expect(mockNavigate).toHaveBeenCalledWith(
    ERootRoutes.Main,
    {
      screen: ETabRoutes.Home,
      params: { screen: ETabHomeRoutes.TabHomeDustSweep, params: routeParams },
    },
    { pop: true },
  );
});

it.each([
  { ...routeParams, walletId: undefined },
  { ...routeParams, accountId: undefined },
  { ...routeParams, walletId: 'watching' },
  { ...routeParams, walletId: 'external' },
])('rejects an unsupported route before navigation: %j', async (params) => {
  await navigateToDustSweep({
    params,
    intl,
  });
  expect(mockDialog).toHaveBeenCalledWith({
    title: 'Dust Sweep',
    description: 'Unsupported account',
    onConfirmText: 'Got it',
    showCancelButton: false,
  });
  expect(mockNavigate).not.toHaveBeenCalled();
  expect(mockExpand).not.toHaveBeenCalled();
});

it('uses the indexed account only when no network is requested', async () => {
  const params = { ...routeParams, accountId: undefined, networkId: undefined };
  await navigateToDustSweep({
    params,
    intl,
  });
  expect(mockNavigate).toHaveBeenCalledWith(
    ERootRoutes.Main,
    {
      screen: ETabRoutes.Home,
      params: {
        screen: ETabHomeRoutes.TabHomeDustSweep,
        params: { ...params, accountId: routeParams.indexedAccountId },
      },
    },
    { pop: true },
  );
  expect(mockDialog).not.toHaveBeenCalled();
});
