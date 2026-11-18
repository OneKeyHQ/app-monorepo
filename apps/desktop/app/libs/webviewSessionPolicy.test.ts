import {
  NEW_WINDOW_DOWNLOAD_HANDOFF_TTL_MS,
  USER_ACTIVATION_WINDOW_MS,
  WebviewDownloadPolicy,
  configureOverlaySessionPermissions,
  configureWebviewSessionDeviceAndDownloadPolicy,
} from './webviewSessionPolicy';

import type { DownloadItem, Event, WebContents } from 'electron';

function createMockSession() {
  let permissionCheckHandler: ((...args: unknown[]) => boolean) | undefined;
  let permissionRequestHandler:
    | ((
        webContents: unknown,
        permission: string,
        callback: (granted: boolean) => void,
      ) => void)
    | undefined;
  let devicePermissionHandler: ((...args: unknown[]) => boolean) | undefined;
  const listeners = new Map<
    string,
    Array<(event: Event, item: DownloadItem, webContents: WebContents) => void>
  >();

  return {
    session: {
      setPermissionCheckHandler: jest.fn((handler) => {
        permissionCheckHandler = handler;
      }),
      setPermissionRequestHandler: jest.fn((handler) => {
        permissionRequestHandler = handler;
      }),
      setDevicePermissionHandler: jest.fn((handler) => {
        devicePermissionHandler = handler;
      }),
      removeAllListeners: jest.fn((channel?: string) => {
        if (channel) {
          listeners.delete(channel);
        } else {
          listeners.clear();
        }
      }),
      on: jest.fn((channel: string, listener: any) => {
        const current = listeners.get(channel) ?? [];
        current.push(listener);
        listeners.set(channel, current);
      }),
    } as any,
    getPermissionCheckHandler: () => permissionCheckHandler,
    getPermissionRequestHandler: () => permissionRequestHandler,
    getDevicePermissionHandler: () => devicePermissionHandler,
    emitWillDownload: (item: Partial<DownloadItem>, webContentsId = 2) => {
      const preventDefault = jest.fn();
      const event = { preventDefault } as unknown as Event;
      const webContents = { id: webContentsId } as unknown as WebContents;
      for (const listener of listeners.get('will-download') ?? []) {
        listener(event, item as DownloadItem, webContents);
      }
      return { preventDefault };
    },
    getListenerCount: (channel: string) =>
      (listeners.get(channel) ?? []).length,
  };
}

describe('webviewSessionPolicy', () => {
  it('denies all permission, device, and download requests on overlaySession without stacking listeners', () => {
    const mock = createMockSession();

    configureOverlaySessionPermissions(mock.session);
    configureOverlaySessionPermissions(mock.session);

    expect(mock.getListenerCount('will-download')).toBe(1);
    expect(mock.getPermissionCheckHandler()?.()).toBe(false);
    expect(mock.getDevicePermissionHandler()?.()).toBe(false);

    const requestCallback = jest.fn();
    mock.getPermissionRequestHandler()?.({}, 'media', requestCallback);
    expect(requestCallback).toHaveBeenCalledWith(false);

    const { preventDefault } = mock.emitWillDownload({
      hasUserGesture: () => true,
      getURL: () => 'https://example.com/file.pdf',
    });
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('denies device permissions and blocks automatic downloads on webviewSession while allowing user-gesture downloads', () => {
    const mock = createMockSession();
    const policy = new WebviewDownloadPolicy();
    const onBlocked = jest.fn();

    configureWebviewSessionDeviceAndDownloadPolicy({
      webviewSession: mock.session,
      downloadPolicy: policy,
      onAutomaticDownloadBlocked: onBlocked,
    });

    expect(mock.getDevicePermissionHandler()?.()).toBe(false);

    const automatic = mock.emitWillDownload({
      hasUserGesture: () => false,
      getURL: () => 'https://dapp.example/payload.bin',
    });
    expect(automatic.preventDefault).toHaveBeenCalledTimes(1);
    expect(onBlocked).toHaveBeenCalledTimes(1);

    const userGesture = mock.emitWillDownload({
      hasUserGesture: () => true,
      getURL: () => 'https://dapp.example/export.csv',
    });
    expect(userGesture.preventDefault).not.toHaveBeenCalled();
    expect(onBlocked).toHaveBeenCalledTimes(1);
  });

  it('preserves user-initiated new-window downloads across loadURL handoff and redirects once', () => {
    const policy = new WebviewDownloadPolicy();
    const t0 = 1_000_000;

    expect(policy.recordInputEvent(10, { type: 'mouseDown' }, t0)).toBe(true);
    expect(
      policy.recordNewWindowHandoff({
        sourceWebContentsId: 10,
        url: 'https://dapp.example/export?id=1',
        now: t0 + 100,
      }),
    ).toBe(true);

    // Same-tab automatic download cannot consume the new-window handoff.
    expect(
      policy.shouldAllowDownload({
        item: {
          hasUserGesture: () => false,
          getURL: () => 'https://cdn.dapp.example/export.csv',
          getURLChain: () => [
            'https://dapp.example/export?id=1',
            'https://cdn.dapp.example/export.csv',
          ],
        },
        webContents: { id: 10 },
        now: t0 + 200,
      }),
    ).toBe(false);

    // The newly opened tab (webContents.id = 11) consumes the handoff once.
    expect(
      policy.shouldAllowDownload({
        item: {
          hasUserGesture: () => false,
          getURL: () => 'https://cdn.dapp.example/export.csv',
          getURLChain: () => [
            'https://dapp.example/export?id=1',
            'https://cdn.dapp.example/export.csv',
          ],
        },
        webContents: { id: 11 },
        now: t0 + 200,
      }),
    ).toBe(true);

    // Replaying the same download without a new user gesture is blocked.
    expect(
      policy.shouldAllowDownload({
        item: {
          hasUserGesture: () => false,
          getURL: () => 'https://cdn.dapp.example/export.csv',
          getURLChain: () => [
            'https://dapp.example/export?id=1',
            'https://cdn.dapp.example/export.csv',
          ],
        },
        webContents: { id: 11 },
        now: t0 + 300,
      }),
    ).toBe(false);
  });

  it('rejects new-window download handoffs without recent user activation or after expiry', () => {
    const policy = new WebviewDownloadPolicy();
    const t0 = 2_000_000;

    // Non-activation input event (mouseMove) must not authorize a handoff.
    expect(policy.recordInputEvent(20, { type: 'mouseMove' }, t0)).toBe(false);
    expect(
      policy.recordNewWindowHandoff({
        sourceWebContentsId: 20,
        url: 'https://dapp.example/auto.bin',
        now: t0 + 50,
      }),
    ).toBe(false);

    // Expired user activation must not authorize a handoff.
    expect(policy.recordInputEvent(20, { type: 'pointerDown' }, t0)).toBe(true);
    expect(
      policy.recordNewWindowHandoff({
        sourceWebContentsId: 20,
        url: 'https://dapp.example/late.bin',
        now: t0 + USER_ACTIVATION_WINDOW_MS + 1,
      }),
    ).toBe(false);

    // Expired handoff must not authorize a download.
    expect(policy.recordInputEvent(20, { type: 'keyDown' }, t0 + 10_000)).toBe(
      true,
    );
    expect(
      policy.recordNewWindowHandoff({
        sourceWebContentsId: 20,
        url: 'https://dapp.example/expired.csv',
        now: t0 + 10_100,
      }),
    ).toBe(true);
    expect(
      policy.shouldAllowDownload({
        item: {
          hasUserGesture: () => false,
          getURL: () => 'https://dapp.example/expired.csv',
        },
        webContents: { id: 21 },
        now: t0 + 10_100 + NEW_WINDOW_DOWNLOAD_HANDOFF_TTL_MS,
      }),
    ).toBe(false);
  });
});
