/** @jest-environment jsdom */

import type { ReactNode, Ref } from 'react';

import { act, render, waitFor } from '@testing-library/react';

import { WebViewWebEmbed } from '@onekeyhq/kit/src/components/WebViewWebEmbed';

import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

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
jest.mock('react-native', () => ({ NativeModules: {} }));
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
  BundleUpdate: { getWebEmbedPath: () => undefined },
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
      (props: { receiveHandler: typeof mockReceive }, ref: Ref<unknown>) => {
        mockReceive = props.receiveHandler;
        React.useImperativeHandle(ref, () => ({
          jsBridge: { globalOnMessageEnabled: false },
        }));
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
    expect(mockMarkNotReady).toHaveBeenCalledTimes(1);
  });
});
