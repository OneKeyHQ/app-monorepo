import { StackActions, StackRouter } from '@react-navigation/native';

import { Toast } from '@onekeyhq/components';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import marketWidget from '@onekeyhq/shared/src/modules/MarketWidget';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import {
  EModalRoutes,
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
} from '@onekeyhq/shared/src/routes';
import { EFullScreenPushRoutes } from '@onekeyhq/shared/src/routes/fullScreenPush';
import { travelModeManager } from '@onekeyhq/shared/src/travelMode';
import type { IMarketAssetDetailData } from '@onekeyhq/shared/types/market';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { whenAppUnlocked } from '../../../utils/passwordUtils';
import { EModalMarketRoutes } from '../../../views/Market/router/types';

import { handleMarketWidgetLink } from './marketWidgetLink';

import type {
  NavigationState,
  StackActionType,
} from '@react-navigation/native';

const mockGetRootState = jest.fn<NavigationState | undefined, []>();
const mockRootDispatch = jest.fn<void, [StackActionType]>();

jest.mock('@react-navigation/native', () =>
  jest.requireActual<typeof import('@react-navigation/routers')>(
    '@react-navigation/routers',
  ),
);
jest.mock('@onekeyhq/components', () => ({
  Toast: { error: jest.fn() },
  rootNavigationRef: {
    current: {
      getRootState: () => mockGetRootState(),
      dispatch: (action: StackActionType) => mockRootDispatch(action),
    },
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNativeAndroid: true },
}));
jest.mock('@onekeyhq/shared/src/modules/MarketWidget', () => ({
  __esModule: true,
  default: {
    supportsSettingsEditing: jest.fn(() => true),
    getEditorState: jest.fn(async () => ({ privacyMasked: false })),
  },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: { app: { error: { log: jest.fn() } } },
}));
jest.mock('@onekeyhq/shared/src/locale/appLocale', () => ({
  appLocale: { intl: { formatMessage: () => 'An error occurred' } },
}));
jest.mock('@onekeyhq/shared/src/travelMode', () => ({
  travelModeManager: { isMaskingDataSync: jest.fn(() => false) },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    getNetworkShortCode: ({ networkId }: { networkId: string }) => networkId,
  },
}));
jest.mock('../../../utils/passwordUtils', () => ({
  whenAppUnlocked: jest.fn(async () => undefined),
}));
jest.mock('../../../views/Market/utils/marketDetailNavigation', () => ({
  prepareMarketDetailTabBarTransition: jest.fn(),
}));
jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceMarket: { fetchMarketAssetDetail: jest.fn() } },
}));

describe('market widget destination mapping', () => {
  const navigate = jest.fn();
  const pushModal = jest.fn();
  const fetchAssetDetail = jest.spyOn(
    backgroundApiProxy.serviceMarket,
    'fetchMarketAssetDetail',
  );

  beforeEach(() => {
    jest.clearAllMocks();
    platformEnv.isNativeAndroid = true;
    platformEnv.isNativeIOS = false;
    jest.mocked(travelModeManager.isMaskingDataSync).mockReturnValue(false);
    jest.mocked(whenAppUnlocked).mockReset().mockResolvedValue(undefined);
    mockGetRootState.mockReset();
    mockRootDispatch.mockReset();
    jest.mocked(marketWidget.supportsSettingsEditing).mockReturnValue(true);
    appGlobals.$rootAppNavigation = {
      navigate,
      pushModal,
    } as unknown as typeof appGlobals.$rootAppNavigation;
    appGlobals.$navigationRef = {
      current: { isReady: () => true },
    } as typeof appGlobals.$navigationRef;
  });

  function setRootStack(
    overlays: Array<{
      name: ERootRoutes;
      screen?: EFullScreenPushRoutes | EModalRoutes;
    }>,
  ) {
    const router = StackRouter({ initialRouteName: ERootRoutes.Main });
    const options = {
      routeNames: [
        ERootRoutes.Main,
        ERootRoutes.FullScreenPush,
        ERootRoutes.Modal,
        ERootRoutes.Onboarding,
      ],
      routeParamList: {},
      routeGetIdList: {},
    };
    let state = router.getInitialState(options);
    for (const overlay of overlays) {
      const next = router.getStateForAction(
        state,
        StackActions.push(overlay.name, { screen: overlay.screen }),
        options,
      );
      if (!next) {
        throw new OneKeyLocalError(
          'Unable to prepare the root navigation stack',
        );
      }
      state = router.getRehydratedState(next, options);
    }
    mockGetRootState.mockImplementation(() => state);
    mockRootDispatch.mockImplementation((action) => {
      const next = router.getStateForAction(state, action, options);
      if (!next) {
        throw new OneKeyLocalError(
          'Unable to handle the root navigation action',
        );
      }
      state = router.getRehydratedState(next, options);
    });
    return { getState: () => state };
  }

  it('opens the underlying stock detail without substituting a chain token', async () => {
    await handleMarketWidgetLink({
      target: { kind: 'stock', stockId: 'NVDA' },
      shouldContinue: () => true,
    });
    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketStockDetail,
        params: { stockId: 'NVDA' },
      },
    });
    expect(fetchAssetDetail).not.toHaveBeenCalled();
  });

  it('dismisses Android More from the root stack before opening widget detail', async () => {
    const { getState } = setRootStack([
      {
        name: ERootRoutes.FullScreenPush,
        screen: EFullScreenPushRoutes.ActionCenter,
      },
    ]);
    const mainKey = getState().routes[0].key;
    await handleMarketWidgetLink({
      target: {
        kind: 'token',
        chainId: 'evm--1',
        contractAddress: '',
        isNative: true,
      },
      shouldContinue: () => true,
    });
    expect(getState().routes.map(({ name }) => name)).toEqual([
      ERootRoutes.Main,
    ]);
    expect(getState().routes[0].key).toBe(mainKey);
    expect(mockRootDispatch).toHaveBeenCalledTimes(1);
    expect(mockRootDispatch.mock.invocationCallOrder[0]).toBeLessThan(
      navigate.mock.invocationCallOrder[0],
    );
  });

  it('preserves other root flows when only the top More page is dismissed', async () => {
    const { getState } = setRootStack([
      { name: ERootRoutes.Modal, screen: EModalRoutes.SendModal },
      {
        name: ERootRoutes.FullScreenPush,
        screen: EFullScreenPushRoutes.ActionCenter,
      },
    ]);
    const preserved = getState().routes.slice(0, 2);
    await handleMarketWidgetLink({
      target: { kind: 'home' },
      shouldContinue: () => true,
    });
    expect(getState().routes).toEqual(preserved);
  });

  it.each([ERootRoutes.Modal, ERootRoutes.Onboarding])(
    'does not dismiss a focused %s flow over More',
    async (name) => {
      const { getState } = setRootStack([
        {
          name: ERootRoutes.FullScreenPush,
          screen: EFullScreenPushRoutes.ActionCenter,
        },
        { name },
      ]);
      const before = getState();
      await handleMarketWidgetLink({
        target: { kind: 'home' },
        shouldContinue: () => true,
      });
      expect(mockRootDispatch).not.toHaveBeenCalled();
      expect(getState()).toBe(before);
    },
  );

  it('does not dismiss More before unlock or for a superseded or masked link', async () => {
    setRootStack([
      {
        name: ERootRoutes.FullScreenPush,
        screen: EFullScreenPushRoutes.ActionCenter,
      },
    ]);
    let unlock: () => void = () => undefined;
    jest.mocked(whenAppUnlocked).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        unlock = resolve;
      }),
    );
    let current = true;
    const pending = handleMarketWidgetLink({
      target: { kind: 'home' },
      shouldContinue: () => current,
    });
    await Promise.resolve();
    expect(mockRootDispatch).not.toHaveBeenCalled();
    current = false;
    unlock();
    await pending;
    expect(mockRootDispatch).not.toHaveBeenCalled();
    jest.mocked(travelModeManager.isMaskingDataSync).mockReturnValue(true);
    await handleMarketWidgetLink({
      target: { kind: 'home' },
      shouldContinue: () => true,
    });
    expect(mockRootDispatch).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps iOS and editor links on their existing navigation path', async () => {
    setRootStack([
      {
        name: ERootRoutes.FullScreenPush,
        screen: EFullScreenPushRoutes.ActionCenter,
      },
    ]);
    platformEnv.isNativeAndroid = false;
    await handleMarketWidgetLink({
      target: { kind: 'home' },
      shouldContinue: () => true,
    });
    expect(mockRootDispatch).not.toHaveBeenCalled();
    platformEnv.isNativeAndroid = false;
    await handleMarketWidgetLink({
      target: { kind: 'editor', widgetKind: 'single' },
      shouldContinue: () => true,
    });
    expect(mockRootDispatch).not.toHaveBeenCalled();
    expect(pushModal).toHaveBeenCalledTimes(1);
  });

  it('opens the bound profile editor without resolving market data', async () => {
    platformEnv.isNativeAndroid = false;
    const profileId = '4bdfeb88-a55d-4a91-bedb-df13acfaea39';
    await handleMarketWidgetLink({
      target: { kind: 'editor', profileId },
      shouldContinue: () => true,
    });
    expect(pushModal).toHaveBeenCalledWith(EModalRoutes.MarketModal, {
      screen: EModalMarketRoutes.MarketWidgetEditor,
      params: { profileId },
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(fetchAssetDetail).not.toHaveBeenCalled();
  });

  it.each(['single', 'list'] as const)(
    'opens %s settings directly without creating or binding a profile',
    async (kind) => {
      platformEnv.isNativeAndroid = false;
      await handleMarketWidgetLink({
        target: { kind: 'editor', widgetKind: kind },
        shouldContinue: () => true,
      });
      expect(pushModal).toHaveBeenCalledWith(EModalRoutes.MarketModal, {
        screen: EModalMarketRoutes.MarketWidgetEditor,
        params: { kind },
      });
    },
  );

  it('validates an Android session before opening the shared editor', async () => {
    const editorSession = '4bdfeb88-a55d-4a91-bedb-df13acfaea39';
    await handleMarketWidgetLink({
      target: { kind: 'editor', editorSession },
      shouldContinue: () => true,
    });
    expect(marketWidget.getEditorState).toHaveBeenCalledWith(editorSession);
    expect(pushModal).toHaveBeenCalledWith(EModalRoutes.MarketModal, {
      screen: EModalMarketRoutes.MarketWidgetEditor,
      params: { editorSession },
    });
  });

  it('rejects Android editor links without a session and invalid native sessions', async () => {
    await handleMarketWidgetLink({
      target: { kind: 'editor', widgetKind: 'list' },
      shouldContinue: () => true,
    });
    jest
      .mocked(marketWidget.getEditorState)
      .mockRejectedValueOnce(new OneKeyLocalError('Expired session'));
    await handleMarketWidgetLink({
      target: {
        kind: 'editor',
        editorSession: '4bdfeb88-a55d-4a91-bedb-df13acfaea39',
      },
      shouldContinue: () => true,
    });
    expect(pushModal).not.toHaveBeenCalled();
    expect(Toast.error).toHaveBeenCalledTimes(2);
  });

  it('does not open the editor on an older native binary', async () => {
    jest.mocked(marketWidget.supportsSettingsEditing).mockReturnValue(false);
    await handleMarketWidgetLink({
      target: { kind: 'editor' },
      shouldContinue: () => true,
    });
    expect(pushModal).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(Toast.error).toHaveBeenCalledTimes(1);
  });

  it('opens native detail for an empty native-token address', async () => {
    await handleMarketWidgetLink({
      target: {
        kind: 'token',
        chainId: 'evm--1',
        contractAddress: '',
        isNative: true,
      },
      shouldContinue: () => true,
    });
    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketNativeDetail,
        params: expect.objectContaining({ network: 'evm--1', isNative: true }),
      },
    });
    expect(fetchAssetDetail).not.toHaveBeenCalled();
  });

  it('preserves the native Move type tag when opening SUI detail', async () => {
    await handleMarketWidgetLink({
      target: {
        kind: 'token',
        chainId: 'sui--mainnet',
        contractAddress: '0x2::sui::SUI',
        isNative: true,
      },
      shouldContinue: () => true,
    });
    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params: expect.objectContaining({
          tokenAddress: '0x2::sui::SUI',
          isNative: true,
        }),
      },
    });
  });

  it('resolves a listing through its selected variant and retains the listing identity', async () => {
    fetchAssetDetail.mockResolvedValue({
      selectedVariant: {
        networkId: 'btc--0',
        tokenAddress: '',
        isNative: true,
        variantId: 'btc-native',
      },
    } as IMarketAssetDetailData);
    await handleMarketWidgetLink({
      target: { kind: 'asset', assetId: 'bitcoin' },
      shouldContinue: () => true,
    });
    expect(fetchAssetDetail).toHaveBeenCalledWith({
      assetId: 'bitcoin',
      currency: 'usd',
      autoHandleError: false,
    });
    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketNativeDetail,
        params: expect.objectContaining({
          network: 'btc--0',
          marketTokenId: 'bitcoin',
          marketVariantId: 'btc-native',
        }),
      },
    });
  });

  it('shows an error instead of opening a wrong coin when listing resolution fails', async () => {
    fetchAssetDetail.mockRejectedValue(new Error('offline'));
    await handleMarketWidgetLink({
      target: { kind: 'asset', assetId: 'bitcoin' },
      shouldContinue: () => true,
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(Toast.error).toHaveBeenCalledTimes(1);
  });
});
