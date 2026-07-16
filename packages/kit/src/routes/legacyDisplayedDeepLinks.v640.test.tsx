/** @jest-environment jsdom */

import { renderHook } from '@testing-library/react';

import {
  EAppUpdateRoutes,
  EModalReferFriendsRoutes,
  EModalRoutes,
  EModalSignatureConfirmRoutes,
  EModalStakingRoutes,
  EOnboardingPagesV2,
  EOnboardingV2Routes,
  ERootRoutes,
  ETabHomeRoutes,
  ETabMarketRoutes,
  ETabReferFriendsRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';
import { buildAllowList } from '@onekeyhq/shared/src/utils/routeUtils';

import { getStateFromPath } from './config/getStateFromPath';
import { resolveScreens } from './config/resolveScreens';
import { useRootRouter } from './router';

import type { NavigationState, PartialState } from '@react-navigation/routers';

const mockUsePerpTabConfig = jest.fn(() => ({
  perpDisabled: false,
  perpTabShowWeb: false,
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => {
  const actual = jest.requireActual<
    typeof import('@onekeyhq/shared/src/platformEnv')
  >('@onekeyhq/shared/src/platformEnv');
  return {
    __esModule: true,
    default: {
      ...actual.default,
      isDev: false,
      isProduction: true,
      isWeb: true,
      isWebDappMode: false,
      isNative: false,
      isDesktop: false,
      isExtension: false,
      isExtensionUiPopup: false,
      isExtensionUiSidePanel: false,
    },
  };
});

jest.mock('@onekeyhq/components', () => {
  const actual = jest.requireActual<typeof import('@onekeyhq/components')>(
    '@onekeyhq/components',
  );
  return {
    ...actual,
    useMedia: () => ({ gtMd: true, md: false }),
  };
});

jest.mock('@react-navigation/native', () => ({
  CommonActions: { navigate: (payload: unknown) => payload },
}));

jest.mock('../hooks/usePerpTabConfig', () => ({
  usePerpTabConfig: () => mockUsePerpTabConfig(),
}));

jest.mock(
  '../views/DeviceManagement/hooks/useDeviceManagerModalStyle',
  () => ({ useDeviceManagerModalStyle: () => ({ isModalStack: false }) }),
);

jest.mock('@onekeyhq/kit/src/routes/Tab/Navigator', () => ({
  TabNavigator: () => null,
}));

jest.mock('./Tab/RootTabLoadingFallback', () => ({
  __esModule: true,
  default: () => null,
  RootTabLoadingFallback: () => null,
}));

jest.mock('./Tab/Marktet/MarketDetailV2LoadingFallback', () => ({
  MarketDetailV2LoadingFallback: () => null,
}));

jest.mock('../views/Perp/router', () => ({
  perpRouters: [{ name: 'Perp' }],
}));

jest.mock('../views/PerpTrade/router', () => ({
  perpTradeRouters: [{ name: 'WebviewPerpTrade' }],
}));

jest.mock('../views/Home/router', () =>
  jest.requireActual('../views/Home/router/index.web-only'),
);

jest.mock('../views/Home/pages/urlAccount/urlAccountUtils', () => ({
  urlAccountLandingRewrite: '/not-part-of-v6.4-display-contract',
}));

type IPartialNavigationState = PartialState<NavigationState>;

interface ILegacyDisplayedDeepLink {
  path: string;
  routeChain: string[];
  showParams: boolean;
}

// Frozen compatibility contract extracted from v6.4.0 routeUtils.ts. Do not
// update these paths to match a new Router: changing one is a public URL
// compatibility decision and requires an explicit migration review.
const legacyDisplayedDeepLinksV640: ILegacyDisplayedDeepLink[] = [
  {
    path: '/market/tokens/BTC',
    routeChain: [
      ERootRoutes.Main,
      ETabRoutes.Market,
      ETabMarketRoutes.MarketDetail,
    ],
    showParams: true,
  },
  {
    path: '/market/token/evm--1/0x123',
    routeChain: [
      ERootRoutes.Main,
      ETabRoutes.Market,
      ETabMarketRoutes.MarketDetailV2,
    ],
    showParams: true,
  },
  {
    path: '/market/token/evm--1',
    routeChain: [
      ERootRoutes.Main,
      ETabRoutes.Market,
      ETabMarketRoutes.MarketNativeDetail,
    ],
    showParams: true,
  },
  {
    path: '/refer-friends',
    routeChain: [
      ERootRoutes.Main,
      ETabRoutes.ReferFriends,
      ETabReferFriendsRoutes.TabReferAFriend,
    ],
    showParams: false,
  },
  {
    path: '/refer-friends/invite-reward',
    routeChain: [
      ERootRoutes.Main,
      ETabRoutes.ReferFriends,
      ETabReferFriendsRoutes.TabInviteReward,
    ],
    showParams: false,
  },
  {
    path: '/defi',
    routeChain: [ERootRoutes.Main, ETabRoutes.Earn],
    showParams: true,
  },
  {
    path: '/market',
    routeChain: [ERootRoutes.Main, ETabRoutes.Market],
    showParams: true,
  },
  {
    path: '/defi/staking/ETH/lido',
    routeChain: [
      ERootRoutes.Modal,
      EModalRoutes.StakingModal,
      EModalStakingRoutes.ProtocolDetails,
    ],
    showParams: true,
  },
  {
    path: '/defi/staking/v2/ETH/lido',
    routeChain: [
      ERootRoutes.Modal,
      EModalRoutes.StakingModal,
      EModalStakingRoutes.ProtocolDetailsV2,
    ],
    showParams: true,
  },
  {
    path: '/ManagePosition?accountId=legacy-account',
    routeChain: [
      ERootRoutes.Modal,
      EModalRoutes.StakingModal,
      EModalStakingRoutes.ManagePosition,
    ],
    showParams: true,
  },
  {
    path: '/swap',
    routeChain: [ERootRoutes.Main, ETabRoutes.Swap, ETabSwapRoutes.TabSwap],
    showParams: true,
  },
  {
    path: '/onboarding/get-started',
    routeChain: [
      ERootRoutes.Onboarding,
      EOnboardingV2Routes.OnboardingV2,
      EOnboardingPagesV2.GetStarted,
    ],
    showParams: true,
  },
  {
    path: '/modal/ReferFriendsModal/ReferAFriend',
    routeChain: [
      ERootRoutes.Modal,
      EModalRoutes.ReferFriendsModal,
      EModalReferFriendsRoutes.ReferAFriend,
    ],
    showParams: false,
  },
  {
    path: '/modal/SignatureConfirmModal/TxConfirmFromDApp?query=transaction',
    routeChain: [
      ERootRoutes.Modal,
      EModalRoutes.SignatureConfirmModal,
      EModalSignatureConfirmRoutes.TxConfirmFromDApp,
    ],
    showParams: true,
  },
  {
    path: '/modal/SignatureConfirmModal/MessageConfirmFromDApp?query=message',
    routeChain: [
      ERootRoutes.Modal,
      EModalRoutes.SignatureConfirmModal,
      EModalSignatureConfirmRoutes.MessageConfirmFromDApp,
    ],
    showParams: true,
  },
  {
    path: '/modal/update/preview',
    routeChain: [
      ERootRoutes.Modal,
      EModalRoutes.AppUpdateModal,
      EAppUpdateRoutes.UpdatePreview,
    ],
    showParams: true,
  },
  {
    path: '/bulk-send-addresses',
    routeChain: [
      ERootRoutes.Main,
      ETabRoutes.Home,
      ETabHomeRoutes.TabHomeBulkSendAddressesInput,
    ],
    showParams: false,
  },
  {
    path: '/bulk-send-amounts',
    routeChain: [
      ERootRoutes.Main,
      ETabRoutes.Home,
      ETabHomeRoutes.TabHomeBulkSendAmountsInput,
    ],
    showParams: false,
  },
  {
    path: '/redeem-bitcoin-voucher',
    routeChain: [
      ERootRoutes.Main,
      ETabRoutes.Home,
      ETabHomeRoutes.TabHomeRedeemBitcoinVoucher,
    ],
    showParams: true,
  },
  {
    path: '/perps',
    routeChain: [ERootRoutes.Main, ETabRoutes.Perp],
    showParams: true,
  },
];

const getFocusedRouteNames = (
  state: IPartialNavigationState | undefined,
): string[] => {
  const routeNames: string[] = [];
  let currentState = state;
  while (currentState) {
    const route =
      currentState.routes[currentState.index ?? currentState.routes.length - 1];
    if (!route) {
      break;
    }
    routeNames.push(route.name);
    currentState = route.state as IPartialNavigationState | undefined;
  }
  return routeNames;
};

const findDisplayRule = (
  rules: ReturnType<typeof buildAllowList>,
  path: string,
) => {
  const pathWithoutQuery = path.split('?')[0] || '/';
  return (
    rules[pathWithoutQuery] ||
    Object.entries(rules).find(([pattern]) =>
      new RegExp(pattern).test(path),
    )?.[1]
  );
};

describe('v6.4.0 displayed deep-link compatibility', () => {
  beforeEach(() => {
    mockUsePerpTabConfig.mockReturnValue({
      perpDisabled: false,
      perpTabShowWeb: false,
    });
  });

  it.each(legacyDisplayedDeepLinksV640)(
    'keeps $path parseable with the same route chain and display policy',
    ({ path, routeChain, showParams }) => {
      const { result } = renderHook(() => useRootRouter());
      const screens = resolveScreens(result.current);
      expect(screens).toBeDefined();
      if (!screens) {
        return;
      }

      const state = getStateFromPath(path, { screens });
      const focusedRouteNames = getFocusedRouteNames(state);
      expect(focusedRouteNames.slice(0, routeChain.length)).toEqual(routeChain);

      const rules = buildAllowList(screens, false, false);
      expect(findDisplayRule(rules, path)).toMatchObject({
        showUrl: true,
        showParams,
      });
    },
  );

  it('keeps the v6.4.0 WebviewPerpTrade display URL variant', () => {
    mockUsePerpTabConfig.mockReturnValue({
      perpDisabled: false,
      perpTabShowWeb: true,
    });
    const { result } = renderHook(() => useRootRouter());
    const screens = resolveScreens(result.current);
    expect(screens).toBeDefined();
    if (!screens) {
      return;
    }

    const path = '/perps';
    const state = getStateFromPath(path, { screens });
    expect(getFocusedRouteNames(state).slice(0, 2)).toEqual([
      ERootRoutes.Main,
      ETabRoutes.WebviewPerpTrade,
    ]);
    expect(findDisplayRule(buildAllowList(screens, false, true), path)).toMatchObject(
      {
        showUrl: true,
        showParams: true,
      },
    );
  });
});
