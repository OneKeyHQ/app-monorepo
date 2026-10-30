/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import WebViewModal from '.';

import { act, cleanup, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EModalWebViewRoutes,
  IModalWebViewParamList,
} from '@onekeyhq/shared/src/routes/webView';

type IHeaderProps = {
  headerRight?: () => ReactNode;
  headerShown?: boolean;
};
type IWebViewProps = {
  disableBridge?: boolean;
  onNavigationStateChange: (event: { title: string; url: string }) => void;
  onDidStartNavigation: (event: { url: string; isMainFrame: boolean }) => void;
};

let mockLocked = false;
let mockFocused = true;
let mockUserId: string | null = 'A';
const mockPop = jest.fn();

const mockHeader = jest.fn<null, [IHeaderProps]>(() => null);
const mockWebViewRef = { current: null };
let mockWebViewProps: IWebViewProps;
let mockParams: IModalWebViewParamList[EModalWebViewRoutes.WebView];

jest.mock('@onekeyhq/components', () => {
  const Passthrough = ({ children }: { children?: ReactNode }) => children;
  return {
    Page: Object.assign(Passthrough, {
      Header: (props: IHeaderProps) => mockHeader(props),
      Body: Passthrough,
    }),
    HeaderIconButton: () => null,
    useClipboard: () => ({ copyText: jest.fn() }),
  };
});

jest.mock('@onekeyfe/onekey-cross-webview', () => ({
  useWebViewBridge: () => ({
    webviewRef: mockWebViewRef,
    setWebViewRef: jest.fn(),
  }),
}));

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: mockParams }),
  useIsFocused: () => mockFocused,
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit/src/components/WebView', () => ({
  __esModule: true,
  default: (props: IWebViewProps) => {
    mockWebViewProps = props;
    return <div data-testid="support-webview" />;
  },
}));

jest.mock('@onekeyhq/kit/src/components/WebView/WebViewWithFeatures', () => ({
  WebViewWithFeatures: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/WebViewWebEmbed', () => ({
  WebViewWebEmbed: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ pop: mockPop }),
}));

jest.mock('@onekeyhq/kit/src/hooks/useCrossDomainRedirect', () => ({
  useCrossDomainRedirect: () => ({}),
}));

jest.mock('@onekeyhq/kit/src/routes/config/deeplink', () => ({
  handleDeepLinkUrl: jest.fn(),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Prime/hooks/primeHostedCardCheckout',
  () => ({
    handlePrimeHostedCardCheckoutFallbackRequest: jest.fn(),
  }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Prime/primeSubscriptionPurchaseSuccess',
  () => ({
    handlePrimePurchaseSuccessCloseRequest: jest.fn(),
  }),
);

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/passwordLock', () => ({
  useAppIsLockedAtom: () => [mockLocked],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/prime', () => ({
  usePrimePersistAtom: () => [
    { isLoggedIn: mockUserId !== null, onekeyUserId: mockUserId },
  ],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsFiatPaySiteWhitelistPersistAtom: () => [
    { fiatPaySiteWhitelist: [] },
  ],
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {},
}));

jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isDesktop: false },
}));

const lastHeader = () => mockHeader.mock.calls.at(-1)?.[0];

describe('WebViewModal menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocked = false;
    mockFocused = true;
    mockUserId = 'A';
    Object.assign(platformEnv, { isNative: false, isDesktop: false });
    mockParams = { title: 'WebView', url: '' };
  });

  afterEach(cleanup);

  test.each(['lock', 'switch', 'logout'])(
    'unmounts support on %s and never restores it after invalidation',
    (reason) => {
      mockParams = {
        title: 'Support',
        url: 'https://intercom.onekey.so/?intercom_user_jwt=placeholder',
        hideHeaderRight: true,
        disableBridge: true,
        intercomUserId: 'A',
      };
      const screen = render(<WebViewModal />);
      expect(lastHeader()?.headerRight).toBeUndefined();
      expect(mockWebViewProps.disableBridge).toBe(true);
      expect(screen.queryByTestId('support-webview')).not.toBeNull();
      if (reason === 'lock') mockLocked = true;
      else mockUserId = reason === 'switch' ? 'B' : null;
      mockFocused = false;
      screen.rerender(<WebViewModal />);
      expect(screen.queryByTestId('support-webview')).toBeNull();
      expect(mockPop).not.toHaveBeenCalled();
      mockLocked = false;
      mockUserId = 'A';
      mockFocused = true;
      screen.rerender(<WebViewModal />);
      expect(screen.queryByTestId('support-webview')).toBeNull();
      expect(mockPop).toHaveBeenCalledTimes(1);
    },
  );

  test('does not load a support URL if it arrives after lock or identity change', () => {
    mockParams = {
      title: 'Support',
      url: 'https://intercom.onekey.so/',
      intercomUserId: 'B',
    };
    const screen = render(<WebViewModal />);
    expect(screen.queryByTestId('support-webview')).toBeNull();
    expect(mockPop).toHaveBeenCalledTimes(1);
  });

  test.each([
    {
      platform: 'Android',
      isNative: true,
      isDesktop: false,
      isWebEmbed: true,
      url: '',
      hidden: true,
    },
    {
      platform: 'iOS',
      isNative: true,
      isDesktop: false,
      isWebEmbed: false,
      url: 'file:///app/index.html',
      hidden: true,
    },
    {
      platform: 'Electron',
      isNative: false,
      isDesktop: true,
      isWebEmbed: false,
      url: 'file:///app/index.html',
      hidden: true,
    },
    {
      platform: 'Web',
      isNative: false,
      isDesktop: false,
      isWebEmbed: true,
      url: '',
      hidden: false,
    },
    {
      platform: 'Extension',
      isNative: false,
      isDesktop: false,
      isWebEmbed: true,
      url: '',
      hidden: false,
    },
    {
      platform: 'Android remote',
      isNative: true,
      isDesktop: false,
      isWebEmbed: false,
      url: 'https://onekey.so',
      hidden: false,
    },
  ])(
    '$platform applies the menu rule without hiding the header',
    ({ isNative, isDesktop, isWebEmbed, url, hidden }) => {
      Object.assign(platformEnv, { isNative, isDesktop });
      mockParams = { title: 'WebView', url, isWebEmbed };

      render(<WebViewModal />);

      expect(Boolean(lastHeader()?.headerRight)).toBe(!hidden);
      expect(lastHeader()?.headerShown).not.toBe(false);
    },
  );

  test('updates the native menu when the loaded page changes', () => {
    Object.assign(platformEnv, { isNative: true });
    mockParams.url = 'https://onekey.so';
    render(<WebViewModal />);
    expect(lastHeader()?.headerRight).toBeDefined();

    act(() => {
      mockWebViewProps.onNavigationStateChange({
        title: 'Local',
        url: 'file:///app/index.html',
      });
    });
    expect(lastHeader()?.headerRight).toBeUndefined();

    act(() => {
      mockWebViewProps.onNavigationStateChange({
        title: 'Remote',
        url: 'https://onekey.so',
      });
    });
    expect(lastHeader()?.headerRight).toBeDefined();
  });

  test('uses only top-frame navigation to update the Electron menu', () => {
    Object.assign(platformEnv, { isDesktop: true });
    mockParams.url = 'https://onekey.so';
    render(<WebViewModal />);

    act(() => {
      mockWebViewProps.onDidStartNavigation({
        url: 'file:///app/index.html',
        isMainFrame: false,
      });
    });
    expect(lastHeader()?.headerRight).toBeDefined();

    act(() => {
      mockWebViewProps.onDidStartNavigation({
        url: 'file:///app/index.html',
        isMainFrame: true,
      });
    });
    expect(lastHeader()?.headerRight).toBeUndefined();

    act(() => {
      mockWebViewProps.onDidStartNavigation({
        url: 'https://onekey.so',
        isMainFrame: true,
      });
    });
    expect(lastHeader()?.headerRight).toBeDefined();
  });
});
