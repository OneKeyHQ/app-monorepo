/** @jest-environment jsdom */

import { act, render } from '@testing-library/react';

import { WebViewWebEmbed } from '@onekeyhq/kit/src/components/WebViewWebEmbed';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IJsBridgeReceiveHandler } from '@onekeyfe/cross-inpage-provider-types';

const mockConnectWebEmbedBridge = jest.fn((_bridge: unknown) => undefined);
const mockMarkWebEmbedApiNotReady = jest.fn(async () => undefined);
const mockJsBridge = { globalOnMessageEnabled: false };
let mockWebViewProps: Record<string, unknown> | undefined;
let mockIsolatedWebViewProps: Record<string, unknown> | undefined;
let mockDevSettings: {
  enabled: boolean;
  settings: {
    disableWebEmbedApi?: boolean;
    enableTestEndpoint?: boolean;
    useFaultyPrimeStripeJs?: boolean;
  };
} = { enabled: false, settings: {} };

jest.mock('react-native', () => ({ NativeModules: {} }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: true,
    isNativeIOS: true,
    isDesktop: false,
    isDev: false,
  },
}));
jest.mock('@onekeyhq/kit/src//background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    connectWebEmbedBridge: (bridge: unknown) =>
      mockConnectWebEmbedBridge(bridge),
    serviceDApp: {
      markWebEmbedApiNotReady: () => mockMarkWebEmbedApiNotReady(),
    },
    serviceDevSetting: {
      getDevSetting: async () => mockDevSettings,
    },
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [mockDevSettings],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsPersistAtom: () => [{ instanceId: 'instance' }],
}));
jest.mock('@onekeyhq/shared/src/consts/primeConsts', () => ({
  REVENUECAT_API_KEY_WEB: 'rc-web-key',
  REVENUECAT_API_KEY_WEB_SANDBOX: 'rc-sandbox-key',
}));
jest.mock('@onekeyhq/shared/src/storage/webEmbedConfig', () => ({
  __esModule: true,
  default: { getWebEmbedConfig: () => undefined },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  BundleUpdate: { getWebEmbedPath: () => '' },
}));
jest.mock('@onekeyhq/shared/src/analytics', () => ({
  analytics: { trackEvent: jest.fn() },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/sentry', () => ({
  captureException: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: { webembed: new Proxy({}, { get: () => () => undefined }) },
  },
}));
jest.mock('@onekeyhq/components', () => ({
  SizableText: () => null,
  Stack: () => null,
  View: ({ children }: { children?: unknown }) => children ?? null,
  XStack: () => null,
}));
jest.mock('../../hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));
jest.mock('../../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('../GlobalJotaiReady/GlobalJotaiReady', () => ({
  GlobalJotaiReady: ({ children }: { children?: unknown }) => children,
}));
jest.mock('./injectedWebEmbed.text-js', () => '', { virtual: true });
jest.mock('../WebView', () => ({
  __esModule: true,
  default: (
    props: Record<string, unknown> & {
      onWebViewRef: (ref: unknown) => void;
    },
  ) => {
    mockWebViewProps = props;
    props.onWebViewRef({ jsBridge: mockJsBridge });
    return null;
  },
}));
jest.mock('../WebView/IsolatedWebView', () => ({
  __esModule: true,
  default: (
    props: Record<string, unknown> & {
      onWebViewRef: (ref: unknown) => void;
    },
  ) => {
    mockIsolatedWebViewProps = props;
    props.onWebViewRef({});
    return null;
  },
}));

async function mount(props: Parameters<typeof WebViewWebEmbed>[0]) {
  const view = render(<WebViewWebEmbed {...props} />);
  await act(async () => {
    await Promise.resolve();
  });
  view.rerender(<WebViewWebEmbed {...props} />);
  return view;
}

beforeEach(() => {
  mockConnectWebEmbedBridge.mockClear();
  mockMarkWebEmbedApiNotReady.mockClear();
  mockJsBridge.globalOnMessageEnabled = false;
  mockWebViewProps = undefined;
  mockIsolatedWebViewProps = undefined;
  mockDevSettings = { enabled: false, settings: {} };
  Object.assign(platformEnv, {
    isNative: true,
    isNativeIOS: true,
    isDesktop: false,
    isDev: false,
  });
});

describe('WebViewWebEmbed bridge ownership', () => {
  it('Prime purchase modal: keeps its handler and never touches the webEmbed or background bridge', async () => {
    const customReceiveHandler: IJsBridgeReceiveHandler = jest.fn();
    const view = await mount({
      hashRoutePath: '/prime/purchase' as never,
      hashRouteQueryParams: { primeUserId: 'user' },
      customReceiveHandler,
    });
    expect(mockWebViewProps?.customReceiveHandler).toBe(customReceiveHandler);
    expect(mockWebViewProps?.isWebEmbedChannel).toBe(false);
    expect(mockWebViewProps?.skipBackgroundBridge).toBe(true);
    expect(mockJsBridge.globalOnMessageEnabled).toBe(true);
    expect(mockConnectWebEmbedBridge).not.toHaveBeenCalled();

    // Closing the modal must not drop the singleton's bridge.
    view.unmount();
    expect(mockConnectWebEmbedBridge).not.toHaveBeenCalled();
    expect(mockMarkWebEmbedApiNotReady).not.toHaveBeenCalled();
  });

  it('singleton: owns the webEmbed bridge and its channel mark', async () => {
    const view = await mount({
      isSingleton: true,
      hashRoutePath: '/webembed/api' as never,
    });
    expect(mockWebViewProps?.isWebEmbedChannel).toBe(true);
    expect(mockWebViewProps?.skipBackgroundBridge).toBe(false);
    expect(mockConnectWebEmbedBridge).toHaveBeenCalledWith(mockJsBridge);

    view.unmount();
    expect(mockMarkWebEmbedApiNotReady).toHaveBeenCalled();
    expect(mockConnectWebEmbedBridge).toHaveBeenLastCalledWith(null);
  });

  it('desktop Prime purchase modal: renders IsolatedWebView and forwards the faulty Stripe.js dev switch in src', async () => {
    Object.assign(platformEnv, {
      isNative: false,
      isNativeIOS: false,
      isDesktop: true,
    });
    mockDevSettings = {
      enabled: true,
      settings: { useFaultyPrimeStripeJs: true },
    };
    await mount({
      hashRoutePath: '/prime/purchase' as never,
      hashRouteQueryParams: { primeUserId: 'user' },
    });
    expect(mockWebViewProps).toBeUndefined();
    expect(mockIsolatedWebViewProps).toBeDefined();
    expect(String(mockIsolatedWebViewProps?.src)).toContain(
      'render=prime-purchase',
    );
    expect(String(mockIsolatedWebViewProps?.src)).toContain(
      'useFaultyPrimeStripeJs=1',
    );
  });
});
