/** @jest-environment jsdom */

import type { ReactNode, Ref } from 'react';

import { act, render, waitFor } from '@testing-library/react';

import { WebViewWebEmbed } from '@onekeyhq/kit/src/components/WebViewWebEmbed';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

import { WebViewWebEmbedProvider } from '../../provider/WebViewWebEmbedProvider';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

let mockNativeIntegration = false;
let mockNativeProps:
  | {
      onContentProcessDidTerminate?: () => void;
      onRenderProcessGone?: (event: {
        nativeEvent: { didCrash: boolean };
      }) => void;
    }
  | undefined;

jest.mock('@onekeyfe/onekey-cross-webview', () => ({
  JsBridgeNativeHost: class {
    globalOnMessageEnabled = false;
    receive = jest.fn();
    webviewWrapper: unknown;
  },
}));
jest.mock('react-native-webview', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    WebView: React.forwardRef((props, ref) => {
      mockNativeProps = props;
      React.useImperativeHandle(ref, () => ({ stopLoading: jest.fn() }));
      return React.createElement('div');
    }),
  };
});
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false, settings: {} }],
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/geckoview', () => () => null);
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
}));
jest.mock('../WebView/ErrorView', () => () => null);

const mockActivate = jest
  .fn<Promise<boolean>, [unknown]>()
  .mockResolvedValue(true);
const mockDeactivate = jest
  .fn<Promise<void>, [string]>()
  .mockResolvedValue(undefined);
const mockMarkNotReady = jest
  .fn<Promise<void>, []>()
  .mockResolvedValue(undefined);
const mockConnect = jest.fn<void, [unknown, string?, number?]>();
const mockForward = jest
  .fn<Promise<void>, [unknown]>()
  .mockResolvedValue(undefined);
let mockReceive:
  | ((payload: IJsBridgeMessagePayload, bridge: unknown) => Promise<unknown>)
  | undefined;

jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', null, children);
  return { SizableText: Box, Stack: Box, View: Box, XStack: Box };
});
jest.mock('../GlobalJotaiReady/GlobalJotaiReady', () => {
  return {
    GlobalJotaiReady: ({ children }: { children?: ReactNode }) => children,
  };
});
jest.mock('react-native', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    NativeModules: {},
    StyleSheet: { create: <T,>(styles: T) => styles },
    RefreshControl: React.forwardRef(() => React.createElement('div')),
  };
});
jest.mock('@onekeyhq/kit/src//background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDApp: {
      activateWebEmbedMount: (params: unknown) => mockActivate(params),
      deactivateWebEmbedMount: (mountId: string) => mockDeactivate(mountId),
      markWebEmbedApiNotReady: () => mockMarkNotReady(),
    },
    serviceDevSetting: { getDevSetting: async () => ({ settings: {} }) },
    connectWebEmbedBridge: (
      bridge: unknown,
      mountId?: string,
      mountSequence?: number,
    ) => mockConnect(bridge, mountId, mountSequence),
    bridgeReceiveHandler: (payload: unknown) => mockForward(payload),
  },
}));
jest.mock('@onekeyhq/shared/src/consts/primeConsts', () => ({
  REVENUECAT_API_KEY_WEB: 'test-key',
  REVENUECAT_API_KEY_WEB_SANDBOX: 'test-sandbox-key',
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/settings', () => ({
  useSettingsPersistAtom: () => [{ instanceId: 'test' }],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/devSettings', () => ({
  useDevSettingsPersistAtom: () => [{ enabled: false, settings: {} }],
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => {
  const noop: unknown = new Proxy(jest.fn(), {
    apply: () => undefined,
    get: () => noop,
  });
  return { defaultLogger: noop };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isNativeAndroid: true, isDev: false },
}));
jest.mock('@onekeyhq/shared/src/storage/webEmbedConfig', () => ({
  __esModule: true,
  default: { getWebEmbedConfig: () => ({ debug: false }) },
}));
jest.mock('@onekeyhq/shared/src/utils/uriUtils', () => ({
  __esModule: true,
  default: { buildUrl: () => '/web-embed-api' },
}));
jest.mock('@onekeyhq/shared/src/modules3rdParty/auto-update', () => ({
  BundleUpdate: { getWebEmbedPath: () => '' },
}));
jest.mock('../../hooks/useLocaleVariant', () => ({
  useLocaleVariant: () => 'en-US',
}));
jest.mock('../../hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'light',
}));
jest.mock('../WebView/InpageProviderWebView', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: React.forwardRef(
      (
        props: {
          src: string;
          receiveHandler: typeof mockReceive;
          recreateOnContentProcessTerminate?: boolean | (() => void);
        },
        ref: Ref<unknown>,
      ) => {
        mockReceive = props.receiveHandler;
        const nativeRef = React.useRef<unknown>(null);
        React.useImperativeHandle(ref, () =>
          mockNativeIntegration
            ? nativeRef.current
            : {
                jsBridge: { globalOnMessageEnabled: false },
              },
        );
        if (mockNativeIntegration) {
          const { NativeWebView } = jest.requireActual<
            typeof import('../WebView/NativeWebView')
          >('../WebView/NativeWebView');
          return React.createElement(NativeWebView, {
            ...props,
            ref: nativeRef,
          });
        }
        return React.createElement('div');
      },
    ),
  };
});

describe('WebEmbed host mount ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivate.mockResolvedValue(true);
    mockReceive = undefined;
    mockNativeIntegration = false;
    mockNativeProps = undefined;
  });

  it('tags the actual host ready message and forwards it once without deactivating on rerender', async () => {
    const props = {
      isSingleton: true,
      mountId: 'mount-a',
      mountSequence: 1,
      requestId: 'request-a',
      isCurrentMount: () => true,
    };
    const view = render(<WebViewWebEmbed {...props} />);
    await waitFor(() => expect(mockReceive).toBeDefined());
    await waitFor(() =>
      expect(mockConnect).toHaveBeenCalledWith(expect.anything(), 'mount-a', 1),
    );
    const ready = {
      scope: '$private',
      data: { method: 'webEmbedApiReady', params: [] },
    } as unknown as IJsBridgeMessagePayload;
    await act(async () => {
      await mockReceive?.(ready, {});
    });
    expect(mockForward).toHaveBeenCalledTimes(1);
    expect(mockForward).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { method: 'webEmbedApiReady', params: [{ mountId: 'mount-a' }] },
      }),
    );

    view.rerender(
      <WebViewWebEmbed
        {...props}
        customReceiveHandler={async () => undefined}
      />,
    );
    expect(mockDeactivate).not.toHaveBeenCalled();
    view.unmount();
    await waitFor(() => expect(mockDeactivate).toHaveBeenCalledTimes(1));
    expect(mockDeactivate).toHaveBeenCalledWith('mount-a');
  });

  it('ignores an old activation acknowledgement after a new host mounts', async () => {
    let resolveOld!: (active: boolean) => void;
    mockActivate
      .mockImplementationOnce(
        () =>
          new Promise<boolean>((resolve) => {
            resolveOld = resolve;
          }),
      )
      .mockResolvedValueOnce(true);
    const view = render(
      <WebViewWebEmbed
        key="old"
        isSingleton
        mountId="mount-a"
        mountSequence={1}
        requestId="request-a"
        isCurrentMount={(mountId) => mountId === 'mount-a'}
      />,
    );
    await waitFor(() => expect(mockActivate).toHaveBeenCalledTimes(1));
    const oldReady = {
      scope: '$private',
      data: { method: 'webEmbedApiReady', params: [] },
    } as unknown as IJsBridgeMessagePayload;
    const oldForward = mockReceive?.(oldReady, {});
    expect(mockForward).not.toHaveBeenCalled();
    view.rerender(
      <WebViewWebEmbed
        key="new"
        isSingleton
        mountId="mount-b"
        mountSequence={2}
        requestId="request-b"
        isCurrentMount={(mountId) => mountId === 'mount-b'}
      />,
    );
    await waitFor(() =>
      expect(mockConnect).toHaveBeenCalledWith(expect.anything(), 'mount-b', 2),
    );
    await act(async () => {
      resolveOld(true);
      await oldForward;
    });
    expect(mockConnect).not.toHaveBeenCalledWith(
      expect.anything(),
      'mount-a',
      1,
    );
    expect(mockForward).toHaveBeenCalledTimes(1);
    expect(mockForward).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { method: 'webEmbedApiReady', params: [{ mountId: 'mount-a' }] },
      }),
    );
    expect(mockDeactivate).toHaveBeenCalledWith('mount-a');
    expect(mockDeactivate).not.toHaveBeenCalledWith('mount-b');
    view.unmount();
  });

  it('retries activation on a ready message and connects after the effect failed', async () => {
    mockActivate.mockRejectedValueOnce(new Error('activation unavailable'));
    const view = render(
      <WebViewWebEmbed
        isSingleton
        mountId="retry"
        mountSequence={3}
        isCurrentMount={() => true}
      />,
    );
    await waitFor(() => expect(mockActivate).toHaveBeenCalledTimes(1));
    expect(mockConnect).not.toHaveBeenCalledWith(expect.anything(), 'retry', 3);
    const ready = {
      scope: '$private',
      data: { method: 'webEmbedApiReady', params: [] },
    } as unknown as IJsBridgeMessagePayload;
    await act(async () => {
      await mockReceive?.(ready, {});
    });
    expect(mockActivate).toHaveBeenCalledTimes(2);
    expect(mockConnect).toHaveBeenCalledWith(expect.anything(), 'retry', 3);
    await act(async () => {
      await mockReceive?.(ready, {});
    });
    expect(mockConnect.mock.calls.filter(([bridge]) => !!bridge)).toHaveLength(
      1,
    );
    const notReady = {
      scope: '$private',
      data: { method: 'webEmbedApiNotReady', params: [] },
    } as unknown as IJsBridgeMessagePayload;
    await act(async () => {
      await mockReceive?.(notReady, {});
    });
    expect(mockActivate).toHaveBeenCalledTimes(2);
    expect(notReady.data).toEqual({
      method: 'webEmbedApiNotReady',
      params: [{ mountId: 'retry' }],
    });
    view.unmount();
  });

  it.each(['ios', 'android'])(
    'replaces the singleton owner through the actual %s renderer callback',
    async (platform) => {
      mockNativeIntegration = true;
      const requested: { mountId: string; mountSequence: number }[] = [];
      const onRequested = (payload: {
        mountId: string;
        mountSequence: number;
      }) => {
        requested.push(payload);
      };
      appEventBus.on(
        EAppEventBusNames.WebEmbedWebViewMountRequested,
        onRequested,
      );
      const view = render(<WebViewWebEmbedProvider />);
      await act(async () => {
        appEventBus.emit(EAppEventBusNames.LoadWebEmbedWebView, {
          requestId: 'renderer-request',
        });
      });
      await waitFor(() =>
        expect(mockConnect).toHaveBeenCalledWith(
          expect.anything(),
          requested[0]?.mountId,
          requested[0]?.mountSequence,
        ),
      );
      const oldReady = {
        scope: '$private',
        data: { method: 'webEmbedApiReady', params: [] },
      } as unknown as IJsBridgeMessagePayload;
      await act(async () => {
        await mockReceive?.(oldReady, {});
      });
      const oldBridge = mockConnect.mock.calls.find(
        ([bridge, mountId]) => bridge && mountId === requested[0]?.mountId,
      )?.[0];
      const androidTerminate = mockNativeProps?.onRenderProcessGone;
      const terminate =
        platform === 'ios'
          ? mockNativeProps?.onContentProcessDidTerminate
          : () => androidTerminate?.({ nativeEvent: { didCrash: true } });
      await act(async () => {
        terminate?.();
      });
      expect(requested).toHaveLength(2);
      expect(requested[1]?.mountId).not.toBe(requested[0]?.mountId);
      await waitFor(() =>
        expect(mockConnect).toHaveBeenCalledWith(
          expect.anything(),
          requested[1]?.mountId,
          requested[1]?.mountSequence,
        ),
      );
      const newBridge = mockConnect.mock.calls.find(
        ([bridge, mountId]) => bridge && mountId === requested[1]?.mountId,
      )?.[0];
      expect(newBridge).toBeDefined();
      expect(newBridge).not.toBe(oldBridge);
      expect(mockActivate).toHaveBeenLastCalledWith(
        expect.objectContaining({
          requestId: 'renderer-request',
          mountId: requested[1]?.mountId,
        }),
      );
      await act(async () => {
        terminate?.();
      });
      expect(requested).toHaveLength(2);
      const newReady = {
        scope: '$private',
        data: { method: 'webEmbedApiReady', params: [] },
      } as unknown as IJsBridgeMessagePayload;
      await act(async () => {
        await mockReceive?.(newReady, {});
      });
      expect(newReady.data).toEqual({
        method: 'webEmbedApiReady',
        params: [{ mountId: requested[1]?.mountId }],
      });
      view.unmount();
      appEventBus.off(
        EAppEventBusNames.WebEmbedWebViewMountRequested,
        onRequested,
      );
    },
  );

  it('preserves non-singleton custom messages without owner changes', async () => {
    const customReceiveHandler = jest.fn();
    const view = render(
      <WebViewWebEmbed customReceiveHandler={customReceiveHandler} />,
    );
    await waitFor(() => expect(mockReceive).toBeDefined());
    const payload = {
      scope: '$private',
      data: { method: 'webEmbedApiReady', params: [] },
    } as unknown as IJsBridgeMessagePayload;
    await act(async () => {
      await mockReceive?.(payload, {});
    });
    expect(customReceiveHandler).toHaveBeenCalledWith(payload, {});
    expect(mockForward).toHaveBeenCalledTimes(1);
    expect(mockForward).toHaveBeenCalledWith(payload);
    expect(payload.data).toEqual({ method: 'webEmbedApiReady', params: [] });
    expect(mockActivate).not.toHaveBeenCalled();
    view.unmount();
    expect(mockDeactivate).not.toHaveBeenCalled();
    expect(mockMarkNotReady).not.toHaveBeenCalled();
  });
});
