/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';

import WebViewModal from '.';

import { act, cleanup, render } from '@testing-library/react';

import type { IActionListProps } from '@onekeyhq/components/src/actions/ActionList';
import { handlePrimeHostedCardCheckoutFallbackRequest } from '@onekeyhq/kit/src/views/Prime/hooks/primeHostedCardCheckout';
import { EWebEmbedRoutePath } from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  EModalWebViewRoutes,
  IModalWebViewParamList,
} from '@onekeyhq/shared/src/routes/webView';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

type IHeaderProps = {
  headerRight?: () => ReactNode;
  headerShown?: boolean;
};
type IWebViewProps = {
  onNavigationStateChange: (event: { title: string; url: string }) => void;
  onDidStartNavigation: (event: { url: string; isMainFrame: boolean }) => void;
};

const mockHeader = jest.fn<null, [IHeaderProps]>(() => null);
const mockWebViewRef = { current: null };
const mockPop = jest.fn();
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
    ActionList: () => null,
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
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('@onekeyhq/kit/src/components/WebView', () => ({
  __esModule: true,
  default: (props: IWebViewProps) => {
    mockWebViewProps = props;
    return null;
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
const menuProps = () =>
  (lastHeader()?.headerRight?.() as ReactElement<IActionListProps>).props;

describe('WebViewModal menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.assign(platformEnv, {
      isNative: false,
      isDesktop: false,
      isNativeAndroid: false,
      isNativeAndroidGooglePlay: false,
      isNativeIOS: false,
      isMas: false,
    });
    mockParams = { title: 'WebView', url: '' };
  });

  afterEach(cleanup);

  test('shows a dedicated single-action menu with shared copy on Android Prime', () => {
    Object.assign(platformEnv, { isNative: true, isNativeAndroid: true });
    mockParams = {
      title: 'Prime',
      url: '',
      isWebEmbed: true,
      hashRoutePath: EWebEmbedRoutePath.primePurchase,
    };
    render(<WebViewModal />);

    const menu = menuProps();
    expect(menu.title).toBe(ETranslations.explore_options);
    expect(menu.renderTrigger).toMatchObject({
      props: {
        icon: 'DotHorOutline',
        accessibilityLabel: ETranslations.explore_options,
      },
    });
    expect(menu.sections).toHaveLength(1);
    expect(menu.sections?.[0].items).toHaveLength(1);
    expect(menu.sections?.[0].items[0]).toMatchObject({
      label: ETranslations.explore_open_in_browser,
      icon: 'GlobusOutline',
      onPress: expect.any(Function),
    });
    expect(menu.sections?.[0].items[0].disabled).toBeFalsy();
  });

  test.each(['P1M', 'P1Y'])(
    'opens the existing hosted checkout for route plan %s',
    async (subscriptionPeriod) => {
      jest.useFakeTimers();
      try {
        Object.assign(platformEnv, { isNative: true, isNativeAndroid: true });
        mockParams = {
          title: 'Prime',
          url: '',
          isWebEmbed: true,
          hashRoutePath: EWebEmbedRoutePath.primePurchase,
          hashRouteQueryParams: {
            primeUserId: 'test-user',
            primeUserEmail: 'user@example.com',
            subscriptionPeriod,
            currency: 'EUR',
            featureName: EPrimeFeatures.OneKeyCloud,
          },
        };
        render(<WebViewModal />);
        void menuProps().sections?.[0].items[0].onPress?.(jest.fn());
        expect(mockPop).toHaveBeenCalledTimes(1);
        expect(
          handlePrimeHostedCardCheckoutFallbackRequest,
        ).not.toHaveBeenCalled();
        await jest.advanceTimersByTimeAsync(350);
        expect(
          handlePrimeHostedCardCheckoutFallbackRequest,
        ).toHaveBeenCalledTimes(1);
        expect(
          handlePrimeHostedCardCheckoutFallbackRequest,
        ).toHaveBeenCalledWith({
          params: {
            trigger: 'userRequestedHostedCheckout',
            onekeyUserId: 'test-user',
            subscriptionPeriod,
            featureName: EPrimeFeatures.OneKeyCloud,
          },
          routePrimeUserId: 'test-user',
          routePrimeUserEmail: 'user@example.com',
          routeSubscriptionPeriod: subscriptionPeriod,
          routeCurrency: 'EUR',
          intl: expect.objectContaining({
            formatMessage: expect.any(Function),
          }),
        });
        expect(openUrlExternal).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    },
  );

  test.each([
    {
      name: 'Google Play',
      isNativeAndroid: true,
      isNativeAndroidGooglePlay: true,
    },
    { name: 'iOS', isNativeIOS: true },
    {
      name: 'other Android web-embed',
      isNativeAndroid: true,
      hashRoutePath: EWebEmbedRoutePath.webEmbedApi,
    },
    { name: 'explicitly hidden', isNativeAndroid: true, hideHeaderRight: true },
    { name: 'desktop', isNative: false, isDesktop: true },
  ])(
    'keeps the menu hidden for $name',
    ({
      name: _name,
      hashRoutePath = EWebEmbedRoutePath.primePurchase,
      hideHeaderRight,
      ...platform
    }) => {
      Object.assign(platformEnv, { isNative: true }, platform);
      mockParams = {
        title: 'Prime',
        url: '',
        isWebEmbed: true,
        hashRoutePath,
        hideHeaderRight,
      };
      render(<WebViewModal />);
      expect(lastHeader()?.headerRight).toBeUndefined();
    },
  );

  test('keeps the generic Android remote-page actions', () => {
    Object.assign(platformEnv, { isNative: true, isNativeAndroid: true });
    mockParams.url = 'https://onekey.so';
    render(<WebViewModal />);
    expect(menuProps().sections?.[0].items.map((item) => item.label)).toEqual([
      ETranslations.global_refresh,
      ETranslations.explore_share,
      ETranslations.global_copy_url,
      ETranslations.explore_open_in_browser,
    ]);
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
