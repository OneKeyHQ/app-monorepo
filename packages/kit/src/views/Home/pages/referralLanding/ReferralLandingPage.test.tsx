import type { ReactNode } from 'react';

import { act, cleanup, render } from '@testing-library/react-native';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { createReferralLandingRequestId } from '@onekeyhq/kit/src/routes/config/deeplink/referralLandingRequestGuard';
import type { ISimpleDbPerpData } from '@onekeyhq/kit-bg/src/dbs/simple/entity/SimpleDbEntityPerp';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { openReferralInvitedByFriendModalWithGuard } from './referralLandingModalGuard';
import { ReferralLandingPage } from './ReferralLandingPage';

const mockNavigation = {
  switchTab: jest.fn(),
  pushModal: jest.fn(),
  reset: jest.fn(),
};
type IReferralWebLandingMockProps = {
  onDownload: () => void;
  onScrollToBind: () => void;
  onCopyCode: () => void;
  onBind: () => void;
  onTrade: () => void;
};
let mockReferralWebLandingProps: IReferralWebLandingMockProps | undefined;
let mockIsOneKeyInstalled = false;
const mockBindViaExtension = jest.fn();
let mockRouteParams: {
  code: string;
  page?: string;
  fromDeepLink?: boolean;
  referralRequestId?: number;
};

jest.mock('@react-navigation/native', () => ({
  useFocusEffect: jest.fn(),
}));

jest.mock('@onekeyhq/components', () => {
  function Page({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  }
  Page.Body = function PageBody({ children }: { children?: ReactNode }) {
    return <>{children}</>;
  };

  return {
    Page,
    Spinner: () => null,
    Stack: ({ children }: { children?: ReactNode }) => <>{children}</>,
    YStack: ({ children }: { children?: ReactNode }) => <>{children}</>,
    rootNavigationRef: {
      current: {},
    },
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceReferralCode: {
      getPostConfig: jest.fn(),
    },
    simpleDb: {
      perp: {
        setPerpData: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => mockNavigation,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppRoute', () => ({
  useAppRoute: () => ({
    params: mockRouteParams,
  }),
}));

jest.mock(
  '@onekeyhq/kit/src/hooks/useWebDapp/useOneKeyWalletDetection',
  () => ({
    useOneKeyWalletDetection: () => ({
      isOneKeyInstalled: mockIsOneKeyInstalled,
    }),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/ReferFriends/hooks/useBindReferralViaExtension',
  () => ({
    useBindReferralViaExtension: () => ({
      bindViaExtension: mockBindViaExtension,
    }),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useAppIsLockedAtom: () => [false],
}));

jest.mock('@onekeyhq/shared/src/config/appConfig', () => ({
  ANDROID_PACKAGE_NAME: 'so.onekey.app.wallet',
  APP_STORE_DOWNLOAD_LINK: 'itms-apps://apps.apple.com/app/onekey',
  APP_STORE_DOWNLOAD_WEB_LINK: 'https://apps.apple.com/app/onekey',
  DOWNLOAD_URL: 'https://onekey.so/download',
  PLAY_STORE_LINK: 'https://play.google.com/store/apps/details?id=onekey',
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    HideTabBar: 'HideTabBar',
  },
  appEventBus: {
    emit: jest.fn(),
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    referral: {
      page: {
        enterReferralGuide: jest.fn(),
        enterFromReferralLink: jest.fn(),
        referralPageOpen: jest.fn(),
        clickReferralLandingButton: jest.fn(),
        copyReferralCode: jest.fn(),
      },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/scopes/perp/perpPageSource', () => ({
  EPerpPageEnterSource: {
    Referral: 'Referral',
  },
  setPerpPageEnterSource: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isWeb: false,
    isWebMobileAndroid: false,
    isWebMobileIOS: false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    sleepUntil: jest.fn(async () => undefined),
  },
}));

jest.mock('@onekeyhq/shared/src/utils/uriUtils', () => ({
  __esModule: true,
  default: {
    buildDeepLinkUrl: jest.fn(() => 'onekey-wallet://invited_by_friend'),
  },
}));

jest.mock('../../utils/deepLinkLaunchUtils', () => ({
  openAppViaDeepLink: jest.fn(),
  redirectToStore: jest.fn(),
  scheduleDeepLinkFallbackHint: jest.fn(() => jest.fn()),
}));

jest.mock('@onekeyhq/kit/src/views/Earn/earnUtils', () => ({
  safePushToEarnRoute: jest.fn(),
}));

jest.mock('./components', () => ({
  REFERRAL_STEP2_ANCHOR_ID: 'referral-step-2',
  ReferralWebLanding: (props: IReferralWebLandingMockProps) => {
    mockReferralWebLandingProps = props;
    return null;
  },
}));

jest.mock('./referralLandingModalGuard', () => ({
  openReferralInvitedByFriendModalWithGuard: jest.fn(),
}));

const mockedOpenReferralInvitedByFriendModalWithGuard =
  openReferralInvitedByFriendModalWithGuard as jest.MockedFunction<
    typeof openReferralInvitedByFriendModalWithGuard
  >;
const mockedPlatformEnv = platformEnv as {
  isWeb: boolean;
  isWebMobileAndroid: boolean;
  isWebMobileIOS: boolean;
};
const mockedReferralLogger = defaultLogger.referral.page as unknown as {
  referralPageOpen: jest.Mock;
  enterReferralGuide: jest.Mock;
  enterFromReferralLink: jest.Mock;
  clickReferralLandingButton: jest.Mock;
};
const mockedPerpSimpleDb = backgroundApiProxy.simpleDb.perp as unknown as {
  setPerpData: jest.MockedFunction<
    (
      setFn: (
        prevConfig: ISimpleDbPerpData | null | undefined,
      ) => ISimpleDbPerpData,
    ) => Promise<void>
  >;
};

async function flushAsyncTasks() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('ReferralLandingPage', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockReferralWebLandingProps = undefined;
    mockIsOneKeyInstalled = false;
    mockedPlatformEnv.isWeb = false;
    mockedPlatformEnv.isWebMobileAndroid = false;
    mockedPlatformEnv.isWebMobileIOS = false;
    mockRouteParams = {
      code: 'R7EKUT',
    };
  });

  afterEach(() => {
    cleanup();
    jest.useRealTimers();
  });

  it('logs referral page open once for the same web landing route', async () => {
    mockedPlatformEnv.isWeb = true;
    mockRouteParams = {
      code: 'LI2ZUE',
      page: 'perps',
    };

    const view = render(<ReferralLandingPage />);
    await flushAsyncTasks();

    expect(mockedReferralLogger.referralPageOpen).toHaveBeenCalledTimes(1);
    expect(mockedReferralLogger.referralPageOpen).toHaveBeenCalledWith({
      referralCode: 'LI2ZUE',
      landingPage: '/app/perps',
      pageVariant: 'perps',
    });

    view.rerender(<ReferralLandingPage />);
    await flushAsyncTasks();

    expect(mockedReferralLogger.referralPageOpen).toHaveBeenCalledTimes(1);
  });

  it('deduplicates repeated web enter events with the same source', () => {
    mockedPlatformEnv.isWeb = true;
    mockIsOneKeyInstalled = true;
    mockRouteParams = {
      code: 'LI2ZUE',
      page: 'perps',
    };

    render(<ReferralLandingPage />);

    act(() => {
      mockReferralWebLandingProps?.onBind();
      mockReferralWebLandingProps?.onBind();
    });

    expect(
      mockedReferralLogger.clickReferralLandingButton,
    ).toHaveBeenCalledTimes(2);
    expect(mockedReferralLogger.enterReferralGuide).toHaveBeenCalledTimes(1);
    expect(mockedReferralLogger.enterFromReferralLink).toHaveBeenCalledTimes(1);
    expect(mockedReferralLogger.enterFromReferralLink).toHaveBeenCalledWith({
      referralCode: 'LI2ZUE',
      landingPage: '/app/perps',
      utmSource: 'web_bind_extension',
    });
  });

  it('logs a same-source web enter retry after the dedupe window', () => {
    mockedPlatformEnv.isWeb = true;
    mockIsOneKeyInstalled = true;
    mockRouteParams = {
      code: 'LI2ZUE',
      page: 'perps',
    };

    render(<ReferralLandingPage />);

    act(() => {
      mockReferralWebLandingProps?.onBind();
      jest.advanceTimersByTime(3000);
      mockReferralWebLandingProps?.onBind();
    });

    expect(mockedReferralLogger.enterFromReferralLink).toHaveBeenCalledTimes(2);
    expect(mockedReferralLogger.enterFromReferralLink).toHaveBeenNthCalledWith(
      2,
      {
        referralCode: 'LI2ZUE',
        landingPage: '/app/perps',
        utmSource: 'web_bind_extension',
      },
    );
  });

  it('does not open a stale code-only route after a newer referral request arrives', async () => {
    render(<ReferralLandingPage />);

    await flushAsyncTasks();
    expect(mockNavigation.switchTab).toHaveBeenCalledWith(ETabRoutes.Market);

    createReferralLandingRequestId();
    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(
      mockedOpenReferralInvitedByFriendModalWithGuard,
    ).not.toHaveBeenCalled();
  });

  it('reprocesses when a reused route receives a newer referral request id', async () => {
    const firstReferralRequestId = createReferralLandingRequestId();
    mockRouteParams = {
      code: 'R7EKUT',
      page: 'perps',
      fromDeepLink: true,
      referralRequestId: firstReferralRequestId,
    };
    const view = render(<ReferralLandingPage />);

    await flushAsyncTasks();
    expect(mockNavigation.switchTab).toHaveBeenCalledTimes(1);

    const secondReferralRequestId = createReferralLandingRequestId();
    mockRouteParams = {
      code: 'R7EKUT',
      page: 'perps',
      fromDeepLink: true,
      referralRequestId: secondReferralRequestId,
    };
    view.rerender(<ReferralLandingPage />);
    await flushAsyncTasks();

    expect(mockNavigation.switchTab).toHaveBeenCalledTimes(2);

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(
      mockedOpenReferralInvitedByFriendModalWithGuard,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'R7EKUT',
        page: 'perps',
        navigation: mockNavigation,
      }),
    );
  });

  it('does not save a stale perps referral code from the DB updater', async () => {
    const referralRequestId = createReferralLandingRequestId();
    const previousPerpData = { referralCode: 'EXISTING' };
    mockRouteParams = {
      code: 'OLD',
      page: 'perps',
      fromDeepLink: true,
      referralRequestId,
    };
    mockedPerpSimpleDb.setPerpData.mockImplementationOnce(async (setFn) => {
      createReferralLandingRequestId();
      expect(setFn(previousPerpData)).toBe(previousPerpData);
    });

    render(<ReferralLandingPage />);

    await flushAsyncTasks();

    expect(mockNavigation.switchTab).not.toHaveBeenCalled();
  });

  it('clears existing perps referral code when the latest referral targets another page', async () => {
    const referralRequestId = createReferralLandingRequestId();
    mockRouteParams = {
      code: 'NEW',
      page: 'market',
      fromDeepLink: true,
      referralRequestId,
    };
    mockedPerpSimpleDb.setPerpData.mockImplementationOnce(async (setFn) => {
      expect(
        setFn({
          agentTTL: 3000,
          referralCode: 'OLD',
        }),
      ).toEqual({
        agentTTL: 3000,
      });
    });

    render(<ReferralLandingPage />);

    await flushAsyncTasks();

    expect(mockNavigation.switchTab).toHaveBeenCalledWith(ETabRoutes.Market);
  });
});
