/** @jest-environment jsdom */

import WebViewModal from '.';

import { act, cleanup, render, waitFor } from '@testing-library/react';

import {
  EWebEmbedPrivateRequestMethod,
  EWebEmbedRoutePath,
} from '@onekeyhq/shared/src/consts/webEmbedConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

const mockPop = jest.fn();
const mockSetWebViewRef = jest.fn();
const mockWebviewRef = { current: null };
const mockFetchPrimeUserInfo = jest.fn<Promise<void>, []>();
const mockTryClaimKytIntro = jest.fn<
  Promise<{
    status: 'claimed';
    claimId: string;
    entryPoint: 'primeSubscribeSuccess';
  }>,
  [unknown]
>();
const mockPurchaseSuccessListener = jest.fn();
let mockCustomReceiveHandler: ((payload: unknown) => void) | undefined;
let mockRouteParams: Record<string, unknown>;

jest.mock('@onekeyfe/onekey-cross-webview', () => ({
  useWebViewBridge: () => ({
    setWebViewRef: mockSetWebViewRef,
    webviewRef: mockWebviewRef,
  }),
}));

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockRouteParams }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native', () => ({
  Share: { share: jest.fn(async () => undefined) },
}));

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual('react') as typeof import('react');
  const Passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  const Page = Object.assign(Passthrough, {
    Body: Passthrough,
    Header: () => null,
  });
  return {
    ActionList: () => null,
    Dialog: { debugMessage: jest.fn() },
    HeaderIconButton: () => null,
    Page,
    Toast: { message: jest.fn() },
    useClipboard: () => ({ copyText: jest.fn() }),
  };
});

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    servicePrime: {
      apiFetchPrimeUserInfo: () => mockFetchPrimeUserInfo(),
    },
    serviceSetting: {
      tryClaimKytIntro: (params: unknown) => mockTryClaimKytIntro(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/components/WebView', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/WebViewWebEmbed', () => ({
  WebViewWebEmbed: (props: {
    customReceiveHandler: (payload: unknown) => void;
  }) => {
    mockCustomReceiveHandler = props.customReceiveHandler;
    return null;
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: mockPop }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useCrossDomainRedirect', () => ({
  useCrossDomainRedirect: () => ({
    onOpenWindow: jest.fn(),
    onShouldStartLoadWithRequest: jest.fn(),
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsFiatPaySiteWhitelistPersistAtom: () => [
    { fiatPaySiteWhitelist: [] },
  ],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isDev: false,
    isNative: false,
    isNativeIOS: false,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    prime: {
      usage: { primeReceiveKytIntroFlowFailed: jest.fn() },
    },
  },
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

function sendPrimePurchaseSuccess(onekeyUserId: string) {
  const receiveHandler = mockCustomReceiveHandler;
  expect(receiveHandler).toBeDefined();
  if (!receiveHandler) {
    return;
  }
  act(() => {
    receiveHandler({
      data: {
        method:
          EWebEmbedPrivateRequestMethod.closeWebViewModalAfterPrimePurchaseSuccess,
        params: { onekeyUserId },
      },
    });
  });
}

describe('WebViewModal Prime purchase callback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCustomReceiveHandler = undefined;
    mockFetchPrimeUserInfo.mockResolvedValue(undefined);
    mockTryClaimKytIntro.mockResolvedValue({
      status: 'claimed',
      claimId: 'purchase-claim',
      entryPoint: 'primeSubscribeSuccess',
    });
    mockRouteParams = {
      hashRoutePath: EWebEmbedRoutePath.primePurchase,
      hashRouteQueryParams: { primeUserId: 'user-a' },
      isWebEmbed: true,
      title: 'Prime',
      url: '',
    };
    appEventBus.on(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      mockPurchaseSuccessListener,
    );
  });

  afterEach(() => {
    appEventBus.off(
      EAppEventBusNames.PrimeSubscriptionPurchaseSuccess,
      mockPurchaseSuccessListener,
    );
    cleanup();
  });

  it('refreshes and emits only for the user that opened the checkout', async () => {
    render(<WebViewModal />);

    sendPrimePurchaseSuccess('user-a');

    expect(mockPop).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(mockFetchPrimeUserInfo).toHaveBeenCalled());
    expect(mockPurchaseSuccessListener).toHaveBeenCalledWith({
      claimId: 'purchase-claim',
      onekeyUserId: 'user-a',
    });
    expect(mockTryClaimKytIntro.mock.invocationCallOrder[0]).toBeLessThan(
      mockPop.mock.invocationCallOrder[0],
    );
    expect(mockTryClaimKytIntro.mock.invocationCallOrder[0]).toBeLessThan(
      mockFetchPrimeUserInfo.mock.invocationCallOrder[0],
    );
  });

  it('closes but rejects a callback for a different user', async () => {
    render(<WebViewModal />);

    sendPrimePurchaseSuccess('user-b');
    await act(async () => Promise.resolve());

    expect(mockPop).toHaveBeenCalledTimes(1);
    expect(mockFetchPrimeUserInfo).not.toHaveBeenCalled();
    expect(mockPurchaseSuccessListener).not.toHaveBeenCalled();
  });

  it('still emits after a best-effort refresh failure', async () => {
    mockFetchPrimeUserInfo.mockRejectedValueOnce(
      new Error('RevenueCat webhook is delayed'),
    );
    render(<WebViewModal />);

    sendPrimePurchaseSuccess('user-a');

    await waitFor(() =>
      expect(mockPurchaseSuccessListener).toHaveBeenCalledWith({
        claimId: 'purchase-claim',
        onekeyUserId: 'user-a',
      }),
    );
  });
});
