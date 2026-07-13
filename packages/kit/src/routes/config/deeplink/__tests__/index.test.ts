import { perpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  ERootRoutes,
  ETabMarketRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';

import { handleDeepLinkUrl } from '..';
import {
  handleReferralLandingUrl,
  navigateToReferralLanding,
} from '../referralLandingLink';

jest.mock('expo-linking', () => ({
  parse: jest.fn((url: string) => {
    const parsedUrl = new URL(url);
    return {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname,
      queryParams: Object.fromEntries(parsedUrl.searchParams.entries()),
      scheme: parsedUrl.protocol.slice(0, -1),
    };
  }),
}));

jest.mock('@onekeyhq/shared/src/utils/cacheUtils', () => ({
  memoizee: (fn: unknown) => fn,
}));

jest.mock('../../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDevSetting: {
      getDevSetting: jest.fn(async () => ({ settings: {} })),
    },
    walletConnect: {
      connectToDapp: jest.fn(),
    },
  },
}));

jest.mock('../../../../views/Home/pages/urlAccount/urlAccountUtils', () => ({
  urlAccountNavigation: {
    pushUrlAccountPageFromDeeplink: jest.fn(),
  },
}));

jest.mock('../../../../views/Market/marketUtils', () => ({
  marketNavigation: {
    pushDetailPageFromDeeplink: jest.fn(),
  },
}));

jest.mock('../../../../views/WebView/utils/webViewNavigation', () => ({
  openWebView: jest.fn(),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsCommonConfigPersistAtom: {
    get: jest.fn(),
  },
}));

jest.mock('../referralLandingLink', () => ({
  handleReferralLandingUrl: jest.fn(async () => false),
  isValidReferralCode: jest.fn(
    (code: unknown) =>
      typeof code === 'string' && /^[a-zA-Z0-9_-]{1,32}$/u.test(code),
  ),
  navigateToReferralLanding: jest.fn(async () => true),
}));

const mockedHandleReferralLandingUrl =
  handleReferralLandingUrl as jest.MockedFunction<
    typeof handleReferralLandingUrl
  >;
const mockedNavigateToReferralLanding =
  navigateToReferralLanding as jest.MockedFunction<
    typeof navigateToReferralLanding
  >;
const mockedPerpsCommonConfigGet =
  perpsCommonConfigPersistAtom.get as jest.MockedFunction<
    typeof perpsCommonConfigPersistAtom.get
  >;

async function flushAsyncTasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('handleDeepLinkUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes invited_by_friend app deep links through the referral request guard immediately', async () => {
    handleDeepLinkUrl({
      url: 'onekey-wallet://invited_by_friend?code=OLD&page=perps',
    });
    handleDeepLinkUrl({
      url: 'onekey-wallet://invited_by_friend?code=NEW&page=perps',
    });
    await flushAsyncTasks();

    expect(mockedHandleReferralLandingUrl).toHaveBeenCalledTimes(2);
    expect(mockedNavigateToReferralLanding).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        code: 'OLD',
        fromDeepLink: true,
        page: 'perps',
      }),
    );
    expect(mockedNavigateToReferralLanding).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        code: 'NEW',
        fromDeepLink: true,
        page: 'perps',
      }),
    );
  });

  it.each([
    'onekey-wallet://invited_by_friend',
    'onekey-wallet://invited_by_friend?code=',
    'onekey-wallet://invited_by_friend?code=INVALID%21',
    `onekey-wallet://invited_by_friend?code=${'A'.repeat(33)}`,
  ])('skips invalid invited_by_friend app deep link code: %s', async (url) => {
    handleDeepLinkUrl({ url });
    await flushAsyncTasks();

    expect(mockedNavigateToReferralLanding).not.toHaveBeenCalled();
  });
});

describe('stocks / perps universal links', () => {
  const navigate = jest.fn();
  const switchTabAsync = jest.fn(async () => {});
  const originalRootAppNavigation = appGlobals.$rootAppNavigation;

  beforeEach(() => {
    jest.clearAllMocks();
    appGlobals.$rootAppNavigation = {
      navigate,
      switchTabAsync,
    } as unknown as typeof appGlobals.$rootAppNavigation;
    mockedPerpsCommonConfigGet.mockResolvedValue({
      perpConfigCommon: {},
      perpConfigLoaded: true,
    });
  });

  afterEach(() => {
    appGlobals.$rootAppNavigation = originalRootAppNavigation;
  });

  it.each([
    'https://stocks.onekey.so/',
    'https://stocks.onekeytest.com/any/path',
    'https://app.onekey.so/swap?tab=stock',
    'https://app.onekeytest.com/swap/?tab=STOCK',
  ])('routes stock universal link to the Swap stock tab: %s', async (url) => {
    handleDeepLinkUrl({ url });
    await flushAsyncTasks();

    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Swap,
      params: {
        screen: ETabSwapRoutes.TabSwap,
        params: {
          tab: 'stock',
        },
      },
    });
    expect(switchTabAsync).not.toHaveBeenCalled();
  });

  it.each([
    'https://perps.onekey.so/',
    'https://perps.onekeytest.com/some/path',
    'https://app.onekey.so/perps',
    'https://app.onekeytest.com/perps/',
  ])('routes perps universal link to the native Perps tab: %s', async (url) => {
    handleDeepLinkUrl({ url });
    await flushAsyncTasks();

    expect(switchTabAsync).toHaveBeenCalledWith(ETabRoutes.Perp);
    expect(navigate).not.toHaveBeenCalled();
  });

  it.each(['https://swap.onekey.so/', 'https://swap.onekey.so/any/path'])(
    'routes swap universal link to the Swap tab home: %s',
    async (url) => {
      handleDeepLinkUrl({ url });
      await flushAsyncTasks();

      expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
        screen: ETabRoutes.Swap,
        params: {
          screen: ETabSwapRoutes.TabSwap,
          params: {
            tab: 'swap',
          },
        },
      });
      expect(switchTabAsync).not.toHaveBeenCalled();
    },
  );

  it.each([
    'https://app.onekey.so/market',
    'https://app.onekeytest.com/market/',
  ])('routes market universal link to the Market tab home: %s', async (url) => {
    handleDeepLinkUrl({ url });
    await flushAsyncTasks();

    // jest runs as web (non-native), which lands on the Market tab directly;
    // the native branch converges into Discovery's market sub tab instead.
    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.TabMarket,
      },
    });
    expect(switchTabAsync).not.toHaveBeenCalled();
  });

  it('routes perps universal link to the web Perps tab when usePerpWeb is on', async () => {
    mockedPerpsCommonConfigGet.mockResolvedValue({
      perpConfigCommon: { usePerpWeb: true },
      perpConfigLoaded: true,
    });

    handleDeepLinkUrl({ url: 'https://perps.onekey.so/?web=1' });
    await flushAsyncTasks();

    expect(switchTabAsync).toHaveBeenCalledWith(ETabRoutes.WebviewPerpTrade);
  });

  it('skips perps navigation when the loaded config disables perps', async () => {
    mockedPerpsCommonConfigGet.mockResolvedValue({
      perpConfigCommon: { disablePerp: true },
      perpConfigLoaded: true,
    });

    handleDeepLinkUrl({ url: 'https://perps.onekeytest.com/?disabled=1' });
    await flushAsyncTasks();

    expect(switchTabAsync).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('still opens perps while the remote config has not loaded', async () => {
    mockedPerpsCommonConfigGet.mockResolvedValue({
      perpConfigCommon: { disablePerp: true },
      perpConfigLoaded: false,
    });

    handleDeepLinkUrl({ url: 'https://perps.onekey.so/?loading=1' });
    await flushAsyncTasks();

    expect(switchTabAsync).toHaveBeenCalledWith(ETabRoutes.Perp);
  });

  it.each([
    'https://app.onekey.so/swap',
    'https://app.onekey.so/swap?tab=bridge',
    'https://app.onekey.so/settings',
    'https://app.onekey.so/market/tokens/btc',
    'https://evil.example/swap?tab=stock',
    'https://stocks.evil.example/',
    'https://swap.onekeytest.com/',
    'http://stocks.onekey.so/',
    'http://swap.onekey.so/',
  ])('ignores non stocks/perps universal link: %s', async (url) => {
    handleDeepLinkUrl({ url });
    await flushAsyncTasks();

    expect(navigate).not.toHaveBeenCalled();
    expect(switchTabAsync).not.toHaveBeenCalled();
  });
});
