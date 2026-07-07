import { switchTabAsync } from '@onekeyhq/components';
import { parseOneKeyAppLinkTarget } from '@onekeyhq/kit/src/utils/oneKeyAppLinkNavigation';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import {
  ERootRoutes,
  ETabRoutes,
  ETabSwapRoutes,
} from '@onekeyhq/shared/src/routes';

import { handleDeepLinkUrl } from '..';
import {
  handleReferralLandingUrl,
  navigateToReferralLanding,
} from '../referralLandingLink';

jest.mock('@onekeyhq/components', () => ({
  switchTabAsync: jest.fn(async () => undefined),
}));

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
      getDevSetting: jest.fn(async () => ({
        settings: {
          enableTestEndpoint: false,
        },
      })),
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
const mockedSwitchTabAsync = switchTabAsync as jest.MockedFunction<
  typeof switchTabAsync
>;

const mockNavigation = {
  navigate: jest.fn(),
};

async function flushAsyncTasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('handleDeepLinkUrl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    appGlobals.$rootAppNavigation = mockNavigation as never;
  });

  afterEach(() => {
    appGlobals.$rootAppNavigation = undefined;
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

  it.each([
    ['https://app.onekey.so/swap?tab=stock', 'stock'],
    ['https://app.onekeytest.com/swap?tab=stock', 'stock'],
    ['https://app.onekey.so/perps', 'perps'],
    ['https://app.onekeytest.com/perps', 'perps'],
  ] as const)('parses supported OneKey app link: %s', (url, target) => {
    expect(parseOneKeyAppLinkTarget(url)).toBe(target);
  });

  it.each([
    'https://app.onekey.so/swap',
    'https://app.onekey.so/swap?tab=swap',
    'https://app.onekey.so/market',
    'https://stocks.onekey.so',
    'https://perps.onekey.so',
    'onekey-wallet://perps',
  ])('rejects unsupported OneKey app link: %s', (url) => {
    expect(parseOneKeyAppLinkTarget(url)).toBeUndefined();
  });

  it('routes stock app links to the Swap stock tab', async () => {
    handleDeepLinkUrl({
      url: 'https://app.onekey.so/swap?tab=stock',
    });
    await flushAsyncTasks();

    expect(mockedSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.Swap);
    expect(mockNavigation.navigate).toHaveBeenCalledWith(ERootRoutes.Main, {
      screen: ETabRoutes.Swap,
      params: {
        screen: ETabSwapRoutes.TabSwap,
        params: {
          tab: 'stock',
        },
      },
    });
  });

  it('routes perps app links to the Perps tab', async () => {
    handleDeepLinkUrl({
      url: 'https://app.onekey.so/perps',
    });
    await flushAsyncTasks();

    expect(mockedSwitchTabAsync).toHaveBeenCalledWith(ETabRoutes.Perp);
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });

  it('does not route business redirect domains directly in app', async () => {
    handleDeepLinkUrl({
      url: 'https://perps.onekey.so',
    });
    await flushAsyncTasks();

    expect(mockedSwitchTabAsync).not.toHaveBeenCalled();
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
  });
});
