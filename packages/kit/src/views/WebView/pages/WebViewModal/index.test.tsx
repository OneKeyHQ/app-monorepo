/** @jest-environment jsdom */

import type { ReactElement, ReactNode } from 'react';
import { StrictMode } from 'react';

import WebViewModal from '.';

import { act, cleanup, fireEvent, render } from '@testing-library/react';

import type {
  IActionListItemProps,
  IActionListProps,
} from '@onekeyhq/components/src/actions/ActionList';
import type { IPopoverProps } from '@onekeyhq/components/src/actions/Popover/type';
import { handlePrimeHostedCardCheckoutFallbackRequest } from '@onekeyhq/kit/src/views/Prime/hooks/primeHostedCardCheckout';
import { handlePrimePurchaseSuccessCloseRequest } from '@onekeyhq/kit/src/views/Prime/primeSubscriptionPurchaseSuccess';
import {
  EWebEmbedPrivateRequestMethod,
  EWebEmbedRoutePath,
} from '@onekeyhq/shared/src/consts/webEmbedConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EPrimeFeatures } from '@onekeyhq/shared/src/routes/prime';
import type {
  EModalWebViewRoutes,
  IModalWebViewParamList,
} from '@onekeyhq/shared/src/routes/webView';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { WebViewTestIDs } from '../../testIDs';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

type IHeaderProps = {
  headerRight?: () => ReactNode;
  headerShown?: boolean;
};
type IWebViewProps = {
  disableBridge?: boolean;
  onMessage?: (event: { nativeEvent: { data: string; url: string } }) => void;
  onNavigationStateChange: (event: { title: string; url: string }) => void;
  onDidStartNavigation: (event: { url: string; isMainFrame: boolean }) => void;
};

const mockPop = jest.fn();
const mockInjectJavaScript = jest.fn<void, [string]>();
const mockHeader = jest.fn<null, [IHeaderProps]>(() => null);
const mockWebViewRef = {
  current: { innerRef: { injectJavaScript: mockInjectJavaScript } },
};
let mockWebViewProps: IWebViewProps;
let mockWebEmbedProps: {
  customReceiveHandler: (payload: IJsBridgeMessagePayload) => void;
};
let mockParams: IModalWebViewParamList[EModalWebViewRoutes.WebView];

jest.mock('@onekeyhq/components', () => {
  const { cloneElement, useState } =
    jest.requireActual<typeof import('react')>('react');
  const Passthrough = ({ children }: { children?: ReactNode }) => children;
  const Item = ({ label, onPress, onClose, testID }: IActionListItemProps) => (
    <button
      type="button"
      data-testid={testID}
      onClick={() => {
        void onPress?.(onClose ?? jest.fn());
        if (!onPress?.length) onClose?.();
      }}
    >
      {label}
    </button>
  );
  return {
    Page: Object.assign(Passthrough, {
      Header: (props: IHeaderProps) => {
        mockHeader(props);
        return props.headerRight?.() ?? null;
      },
      Body: Passthrough,
    }),
    HeaderIconButton: ({
      testID,
      onPress,
      accessibilityLabel,
    }: {
      testID: string;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) => (
      <button
        type="button"
        data-testid={testID}
        aria-label={accessibilityLabel ?? testID}
        onClick={onPress}
      />
    ),
    LazyPopover: ({
      open,
      onOpenChange,
      renderContent,
      renderTrigger,
    }: IPopoverProps) => {
      const Content = renderContent as () => ReactNode;
      return (
        <>
          {cloneElement(
            renderTrigger as ReactElement<{ onPress: () => void }>,
            {
              onPress: () => onOpenChange?.(!open),
            },
          )}
          {open ? <Content /> : null}
        </>
      );
    },
    ActionList: Object.assign(
      ({ renderTrigger, sections }: IActionListProps) => {
        const [open, setOpen] = useState(false);
        return (
          <>
            {cloneElement(
              renderTrigger as ReactElement<{ onPress: () => void }>,
              { onPress: () => setOpen(true) },
            )}
            {open
              ? sections?.flatMap((section) =>
                  section.items.map((item) => (
                    <Item
                      key={item.label}
                      {...item}
                      onClose={() => setOpen(false)}
                    />
                  )),
                )
              : null}
          </>
        );
      },
      { Item },
    ),
    YStack: Passthrough,
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
    return <div data-testid="generic-webview" />;
  },
}));

jest.mock('@onekeyhq/kit/src/components/WebView/WebViewWithFeatures', () => ({
  WebViewWithFeatures: () => null,
}));

jest.mock('@onekeyhq/kit/src/components/WebViewWebEmbed', () => ({
  WebViewWebEmbed: (props: typeof mockWebEmbedProps) => {
    mockWebEmbedProps = props;
    return null;
  },
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
const primeMenuProps = () =>
  (lastHeader()?.headerRight?.() as ReactElement<IPopoverProps>).props;
const primeMenuItem = () => {
  const item = menuProps().sections?.[0].items[0];
  if (item) return item;
  const Content = primeMenuProps().renderContent as () => ReactElement<{
    children: ReactElement<IActionListItemProps>;
  }>;
  return Content().props.children.props;
};

describe('WebViewModal menu', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(handlePrimePurchaseSuccessCloseRequest)
      .mockImplementation(({ pop }) => pop());
    Object.assign(platformEnv, {
      isNative: false,
      isDesktop: false,
      isNativeAndroid: false,
      isNativeAndroidGooglePlay: false,
      isNativeIOS: false,
      isMas: false,
      isExtension: false,
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
    const view = render(
      <StrictMode>
        <WebViewModal />
      </StrictMode>,
    );

    const menu = primeMenuProps();
    expect(view.queryByTestId(WebViewTestIDs.openInBrowserBtn)).toBeNull();
    fireEvent.click(view.getByTestId(WebViewTestIDs.optionsMenuBtn));
    expect(
      view.getAllByText(ETranslations.explore_open_in_browser),
    ).toHaveLength(1);
    expect(menu.title).toBe(ETranslations.explore_options);
    expect(menu.renderTrigger).toMatchObject({
      props: {
        icon: 'DotHorOutline',
        accessibilityLabel: ETranslations.explore_options,
      },
    });
    expect(primeMenuItem()).toMatchObject({
      label: ETranslations.explore_open_in_browser,
      icon: 'GlobusOutline',
      onPress: expect.any(Function),
    });
    expect(primeMenuItem().disabled).toBeFalsy();
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
        const view = render(<WebViewModal />);
        fireEvent.click(view.getByTestId(WebViewTestIDs.optionsMenuBtn));
        fireEvent.click(view.getByTestId(WebViewTestIDs.openInBrowserBtn));
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

  describe('Prime checkout menu lifetime', () => {
    beforeEach(() => {
      Object.assign(platformEnv, { isNative: true, isNativeAndroid: true });
      mockParams = {
        title: 'Prime',
        url: '',
        isWebEmbed: true,
        hashRoutePath: EWebEmbedRoutePath.primePurchase,
        hashRouteQueryParams: {
          primeUserId: 'test-user',
          subscriptionPeriod: 'P1Y',
        },
      };
    });

    test.each([
      EWebEmbedPrivateRequestMethod.closeWebViewModal,
      EWebEmbedPrivateRequestMethod.closeWebViewModalAfterPrimePurchaseSuccess,
      EWebEmbedPrivateRequestMethod.fallbackToPrimeHostedCheckout,
    ])(
      'closes an open menu and invalidates its action on %s',
      async (method) => {
        jest.useFakeTimers();
        try {
          const view = render(<WebViewModal />);
          fireEvent.click(view.getByTestId(WebViewTestIDs.optionsMenuBtn));
          expect(
            view.getByTestId(WebViewTestIDs.openInBrowserBtn),
          ).not.toBeNull();
          const staleAction = primeMenuItem().onPress;
          act(() => {
            mockWebEmbedProps.customReceiveHandler({
              data: {
                id: 1,
                jsonrpc: '2.0',
                method,
                params: {
                  trigger: 'checkoutError',
                  onekeyUserId: 'test-user',
                  subscriptionPeriod: 'P1Y',
                },
              },
            } as IJsBridgeMessagePayload);
          });
          expect(
            view.queryByTestId(WebViewTestIDs.openInBrowserBtn),
          ).toBeNull();
          act(() => {
            void staleAction?.(jest.fn());
          });
          await jest.advanceTimersByTimeAsync(350);
          expect(mockPop).toHaveBeenCalledTimes(1);
          expect(
            handlePrimeHostedCardCheckoutFallbackRequest,
          ).toHaveBeenCalledTimes(
            method ===
              EWebEmbedPrivateRequestMethod.fallbackToPrimeHostedCheckout
              ? 1
              : 0,
          );
        } finally {
          jest.useRealTimers();
        }
      },
    );

    test('removes an open menu on unmount and ignores retained callbacks', async () => {
      jest.useFakeTimers();
      try {
        const view = render(<WebViewModal />);
        fireEvent.click(view.getByTestId(WebViewTestIDs.optionsMenuBtn));
        const staleAction = primeMenuItem().onPress;
        const staleOpenChange = primeMenuProps().onOpenChange;
        view.unmount();
        act(() => {
          staleOpenChange?.(true);
          void staleAction?.(jest.fn());
        });
        await jest.advanceTimersByTimeAsync(350);
        expect(view.queryByTestId(WebViewTestIDs.openInBrowserBtn)).toBeNull();
        expect(mockPop).not.toHaveBeenCalled();
        expect(
          handlePrimeHostedCardCheckoutFallbackRequest,
        ).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    });
  });

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
