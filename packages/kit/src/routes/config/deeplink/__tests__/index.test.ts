import { reportInstallAttribution } from '@onekeyhq/kit/src/components/LastActivityTracker/installAttribution';
import { perpsCommonConfigPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
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

jest.mock('../../../../views/Earn/earnUtils', () => ({
  EarnNavigation: {
    pushToEarnProtocolDetailsShare: jest.fn(),
  },
}));

jest.mock('../../../../views/WebView/utils/webViewNavigation', () => ({
  openWebView: jest.fn(),
}));

jest.mock(
  '@onekeyhq/kit/src/components/LastActivityTracker/installAttribution',
  () => ({
    reportInstallAttribution: jest.fn(async () => {}),
  }),
);

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
    'https://app.onekey.so/clip/market?click_id=0123456789ABCDEFGHIJKL',
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

  it('opens a same-domain App Clip web campaign in the full-app WebView', async () => {
    const { openWebView } = jest.requireMock(
      '../../../../views/WebView/utils/webViewNavigation',
    );
    const webUrl = 'https://app.onekey.so/campaign/summer?source=app-clip';
    handleDeepLinkUrl({
      url: `https://app.onekey.so/clip/web/summer?web_url=${encodeURIComponent(
        webUrl,
      )}`,
    });
    await flushAsyncTasks();

    expect(openWebView).toHaveBeenCalledWith({
      source: 'deeplink',
      url: webUrl,
    });
  });

  it('routes an App Clip selection to the existing market detail page', async () => {
    handleDeepLinkUrl({
      url: 'https://app.onekey.so/clip/market?network=eth&address=0x1234&is_native=false',
    });
    await flushAsyncTasks();

    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params: {
          tokenAddress: '0x1234',
          network: 'eth',
          isNative: false,
        },
      },
    });
  });

  it('unwraps a validated App Clip custom-scheme market handoff', async () => {
    const originalIsNativeIOS = platformEnv.isNativeIOS;
    platformEnv.isNativeIOS = true;
    const canonicalUrl =
      'https://app.onekey.so/clip/market?network=evm--56&address=0x1234&is_native=false&symbol=QUQ&click_id=0123456789ABCDEFGHIJKL';
    try {
      handleDeepLinkUrl({
        url: `onekey-wallet://app-clip?url=${encodeURIComponent(canonicalUrl)}`,
      });
      await flushAsyncTasks();

      expect(reportInstallAttribution).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
        screen: ETabRoutes.Market,
        params: {
          screen: ETabMarketRoutes.MarketDetailV2,
          params: {
            tokenAddress: '0x1234',
            network: 'evm--56',
            isNative: false,
          },
        },
      });
    } finally {
      platformEnv.isNativeIOS = originalIsNativeIOS;
    }
  });

  it('preserves an empty native-token address in an App Clip handoff', async () => {
    const canonicalUrl =
      'https://app.onekey.so/clip/market?network=btc--0&address=&is_native=true&symbol=BTC';
    handleDeepLinkUrl({
      url: `onekey-wallet://app-clip?url=${encodeURIComponent(canonicalUrl)}`,
    });
    await flushAsyncTasks();

    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.MarketDetailV2,
        params: {
          tokenAddress: '',
          network: 'btc--0',
          isNative: true,
        },
      },
    });
  });

  it('unwraps a validated App Clip web handoff', async () => {
    const { openWebView } = jest.requireMock(
      '../../../../views/WebView/utils/webViewNavigation',
    );
    const webUrl = 'https://app.onekey.so/campaign/autumn?source=app-clip';
    const canonicalUrl = `https://app.onekey.so/clip/web?web_url=${encodeURIComponent(
      webUrl,
    )}&utm_campaign=autumn`;
    handleDeepLinkUrl({
      url: `onekey-wallet://app-clip?url=${encodeURIComponent(canonicalUrl)}`,
    });
    await flushAsyncTasks();

    expect(openWebView).toHaveBeenCalledWith({
      source: 'deeplink',
      url: webUrl,
    });
  });

  it.each([
    'https://evil.example/clip/market?network=eth&address=0x1234',
    'https://app.onekey.so/settings',
    'not-a-url',
  ])(
    'rejects an invalid App Clip custom-scheme handoff: %s',
    async (canonicalUrl) => {
      const { openWebView } = jest.requireMock(
        '../../../../views/WebView/utils/webViewNavigation',
      );
      handleDeepLinkUrl({
        url: `onekey-wallet://app-clip?url=${encodeURIComponent(canonicalUrl)}`,
      });
      await flushAsyncTasks();

      expect(navigate).not.toHaveBeenCalled();
      expect(openWebView).not.toHaveBeenCalled();
    },
  );

  it('does not consume App Clip attribution for an invalid custom-scheme handoff', async () => {
    const originalIsNativeIOS = platformEnv.isNativeIOS;
    platformEnv.isNativeIOS = true;
    try {
      const canonicalUrl =
        'https://evil.example/clip/market?network=eth&address=0x1234';
      handleDeepLinkUrl({
        url: `onekey-wallet://app-clip?url=${encodeURIComponent(canonicalUrl)}`,
      });
      await flushAsyncTasks();

      expect(reportInstallAttribution).not.toHaveBeenCalled();
    } finally {
      platformEnv.isNativeIOS = originalIsNativeIOS;
    }
  });

  it('falls back to market home for invalid App Clip market detail params', async () => {
    handleDeepLinkUrl({
      url: 'https://app.onekey.so/clip/market?network=eth&address=https%3A%2F%2Fevil.example',
    });
    await flushAsyncTasks();

    expect(navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Market,
      params: {
        screen: ETabMarketRoutes.TabMarket,
      },
    });
  });

  it.each([
    'http://app.onekey.so/campaign',
    'https://evil.example/campaign',
    'https://user:secret@app.onekey.so/campaign',
  ])('rejects an unsafe App Clip web campaign URL: %s', async (webUrl) => {
    const { openWebView } = jest.requireMock(
      '../../../../views/WebView/utils/webViewNavigation',
    );
    handleDeepLinkUrl({
      url: `https://app.onekey.so/clip/web?web_url=${encodeURIComponent(
        webUrl,
      )}`,
    });
    await flushAsyncTasks();

    expect(openWebView).not.toHaveBeenCalled();
  });

  it('routes earn detail universal link to EarnProtocolDetailsShare with vault', async () => {
    const { EarnNavigation } = jest.requireMock(
      '../../../../views/Earn/earnUtils',
    );
    handleDeepLinkUrl({
      url: 'https://app.onekeytest.com/earn/ethereum/USDT/spark?vault=0xe2e7a17dff93280dec073c995595155283e3c372',
    });
    await flushAsyncTasks();

    expect(EarnNavigation.pushToEarnProtocolDetailsShare).toHaveBeenCalledWith(
      expect.anything(),
      {
        network: 'ethereum',
        symbol: 'USDT',
        provider: 'spark',
        vault: '0xe2e7a17dff93280dec073c995595155283e3c372',
      },
    );
  });

  it('routes earn detail universal link without vault', async () => {
    const { EarnNavigation } = jest.requireMock(
      '../../../../views/Earn/earnUtils',
    );
    handleDeepLinkUrl({
      url: 'https://app.onekey.so/earn/ethereum/USDC/spark',
    });
    await flushAsyncTasks();

    expect(EarnNavigation.pushToEarnProtocolDetailsShare).toHaveBeenCalledWith(
      expect.anything(),
      {
        network: 'ethereum',
        symbol: 'USDC',
        provider: 'spark',
        vault: undefined,
      },
    );
  });

  it('ignores incomplete earn universal link', async () => {
    const { EarnNavigation } = jest.requireMock(
      '../../../../views/Earn/earnUtils',
    );
    handleDeepLinkUrl({ url: 'https://app.onekey.so/earn/ethereum' });
    await flushAsyncTasks();

    expect(
      EarnNavigation.pushToEarnProtocolDetailsShare,
    ).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
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
