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
      getDevSetting: jest.fn(),
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
