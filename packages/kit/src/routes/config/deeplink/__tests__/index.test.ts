import {
  closeWcPayDialog,
  getWcPayDialogState,
  openWcPayDialog,
  setWcPayDialogGuarded,
} from '@onekeyhq/kit/src/views/WalletConnectPay/dialog/wcPayDialogStore';
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
    serviceWalletConnectPay: {
      isPaymentLink: jest.fn(async () => false),
      supportsDurableProgress: jest.fn(async () => true),
    },
  },
}));

// keep the components package out of this suite's import graph; only Toast
// is consumed by the deeplink module (explicit pay refusal)
jest.mock('@onekeyhq/components', () => ({
  Toast: {
    error: jest.fn(),
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

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  perpsCommonConfigPersistAtom: {
    get: jest.fn(),
  },
}));

// the pay deep link waits for unlock before opening the dialog; resolved
// immediately by default, individual tests swap in a deferred promise
jest.mock('../../../../utils/passwordUtils', () => ({
  whenAppUnlocked: jest.fn(async () => {}),
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

describe('walletconnect pay deep links', () => {
  // oxlint-disable-next-line @cspell/spellchecker
  const payUrl = 'wc:pay-1@2?relay-protocol=irn&symKey=abc';
  const originalRootAppNavigation = appGlobals.$rootAppNavigation;
  const mockedBackgroundApiProxy = (
    jest.requireMock('../../../../background/instance/backgroundApiProxy') as {
      default: {
        walletConnect: { connectToDapp: jest.Mock };
        serviceWalletConnectPay: {
          isPaymentLink: jest.Mock;
          supportsDurableProgress: jest.Mock;
        };
      };
    }
  ).default;
  const mockedIsPaymentLink =
    mockedBackgroundApiProxy.serviceWalletConnectPay.isPaymentLink;
  const mockedSupportsDurableProgress =
    mockedBackgroundApiProxy.serviceWalletConnectPay.supportsDurableProgress;
  const mockedConnectToDapp =
    mockedBackgroundApiProxy.walletConnect.connectToDapp;
  const mockedWhenAppUnlocked = (
    jest.requireMock('../../../../utils/passwordUtils') as {
      whenAppUnlocked: jest.Mock;
    }
  ).whenAppUnlocked;

  // deep chains of awaits need more microtask turns than flushAsyncTasks runs
  async function flushDeepAsyncTasks() {
    for (let i = 0; i < 10; i += 1) {
      await Promise.resolve();
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedIsPaymentLink.mockResolvedValue(true);
    mockedSupportsDurableProgress.mockResolvedValue(true);
    // clearAllMocks keeps implementations; restore the immediate-unlock
    // default in case a test swapped in a deferred promise
    mockedWhenAppUnlocked.mockImplementation(async () => {});
    appGlobals.$rootAppNavigation = undefined;
    closeWcPayDialog();
  });

  afterEach(() => {
    jest.useRealTimers();
    appGlobals.$rootAppNavigation = originalRootAppNavigation;
    closeWcPayDialog();
  });

  it('opens the pay dialog for a recognized pay link', async () => {
    handleDeepLinkUrl({ url: payUrl });
    await flushDeepAsyncTasks();

    expect(getWcPayDialogState()).toMatchObject({
      isOpen: true,
      paymentLink: payUrl,
    });
  });

  it('opens the pay dialog for a direct https payment link', async () => {
    // not a wc:-scheme URI, so only the bg isPaymentLink verdict routes it
    const httpsPayUrl = 'https://pay.walletconnect.com/?pid=pay_123';

    handleDeepLinkUrl({ url: httpsPayUrl });
    await flushDeepAsyncTasks();

    expect(mockedIsPaymentLink).toHaveBeenCalledWith({ uri: httpsPayUrl });
    expect(getWcPayDialogState()).toMatchObject({
      isOpen: true,
      paymentLink: httpsPayUrl,
    });
  });

  it('refuses the pay link with an explicit toast when durable progress is unsupported', async () => {
    mockedSupportsDurableProgress.mockResolvedValue(false);

    handleDeepLinkUrl({ url: payUrl });
    await flushDeepAsyncTasks();

    expect(getWcPayDialogState().isOpen).toBe(false);
    // the recognized pay URI must be consumed here, never handed to dapp
    // pairing (pair() rejects pay URIs silently)
    expect(mockedConnectToDapp).not.toHaveBeenCalled();
    const { Toast } = jest.requireMock('@onekeyhq/components') as {
      Toast: { error: jest.Mock };
    };
    expect(Toast.error).toHaveBeenCalled();
  });

  it('opens the pay dialog even before root navigation exists (cold start)', async () => {
    // cold start: the link arrives before $rootAppNavigation is assigned.
    // The dialog store holds state, not a navigation call, so nothing is
    // dropped — the container renders from the store once it mounts.
    expect(appGlobals.$rootAppNavigation).toBeUndefined();

    handleDeepLinkUrl({ url: payUrl });
    await flushDeepAsyncTasks();

    expect(getWcPayDialogState()).toMatchObject({
      isOpen: true,
      paymentLink: payUrl,
    });
  });

  it('waits for app unlock before opening the pay dialog', async () => {
    // the dialog is a system sheet that would present ABOVE the RN lock
    // screen, so the link must park until the app is unlocked
    let resolveUnlock: () => void = () => {};
    mockedWhenAppUnlocked.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveUnlock = resolve;
        }),
    );

    handleDeepLinkUrl({ url: payUrl });
    await flushDeepAsyncTasks();
    expect(getWcPayDialogState().isOpen).toBe(false);

    resolveUnlock();
    await flushDeepAsyncTasks();
    expect(getWcPayDialogState()).toMatchObject({
      isOpen: true,
      paymentLink: payUrl,
    });
  });

  it('refuses a second pay link while the flow is entry-guarded', async () => {
    // an in-flight, non-dismissible payment sets the entry guard; a new
    // deep link must not remount the flow, and the refusal is surfaced
    openWcPayDialog({ paymentLink: 'link-in-flight' });
    setWcPayDialogGuarded(true);

    handleDeepLinkUrl({ url: payUrl });
    await flushDeepAsyncTasks();

    expect(getWcPayDialogState()).toMatchObject({
      isOpen: true,
      paymentLink: 'link-in-flight',
    });
    const { Toast } = jest.requireMock('@onekeyhq/components') as {
      Toast: { error: jest.Mock };
    };
    expect(Toast.error).toHaveBeenCalled();
  });
});
