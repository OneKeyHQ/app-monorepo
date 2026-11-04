import type { IOpenUrlInAppOptions } from '../../utils/openUrlUtils';

let mockUserId: string | null = 'A';
let mockInstanceId: Promise<string | undefined> = Promise.resolve('instance');
const mockOpenUrlInApp = jest.fn(
  (_url: string, _title: string, _options?: IOpenUrlInAppOptions) => {},
);
const mockNotifyOpenFailed = jest.fn((_error: unknown) => {});
const mockWindowOpen = jest.fn();
const mockOpenUrlExternal = jest.fn((_url: string): void => {});
const mockApiGetCustomerJWT = jest.fn(async () => ({
  token: 'intercom-token',
}));
const EXTENSION_ORIGIN = 'chrome-extension://onekey-test';
let mockDevSettings: {
  enabled: boolean;
  settings?: { intercomSupportUrl?: string };
} = { enabled: false };

jest.mock('../../appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      servicePrime: {
        getLocalUserInfo: async () => ({
          isLoggedIn: mockUserId !== null,
          onekeyUserId: mockUserId,
        }),
        apiGetCustomerJWT: () => mockApiGetCustomerJWT(),
      },
      serviceDevSetting: {
        getDevSetting: async () => mockDevSettings,
      },
    },
  },
}));
jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('../../utils/openUrlUtils', () => ({
  __esModule: true,
  openUrlExternal: (url: string) => mockOpenUrlExternal(url),
  default: {
    openUrlInApp: (
      url: string,
      title: string,
      options?: IOpenUrlInAppOptions,
    ) => {
      mockOpenUrlInApp(url, title, options);
    },
  },
}));
jest.mock('./openFailure', () => ({
  notifyIntercomOpenFailed: (error: unknown) => mockNotifyOpenFailed(error),
}));
jest.mock('./utils', () => ({
  ...jest.requireActual<typeof import('./utils')>('./utils'),
  getInstanceId: () => mockInstanceId,
  getIntercomLanguageOverride: async () => 'en',
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

async function flushEvents() {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe('fallback support URLs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUserId = 'A';
    mockInstanceId = Promise.resolve('instance');
    mockDevSettings = { enabled: false };
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { open: mockWindowOpen },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { origin: EXTENSION_ORIGIN },
    });
  });

  it('opens WebView home bound to the signed-in user with no JWT', async () => {
    const { showIntercom } = await import('./webView.native');
    await showIntercom({ conversationId: 'conversation-1' });
    expect(mockOpenUrlInApp).toHaveBeenCalledTimes(1);
    expect(mockOpenUrlInApp.mock.calls[0][2]).toEqual({
      hideHeaderRight: true,
      disableBridge: true,
      redirectExternalNavigation: true,
      intercomUserId: 'A',
    });
    const [url] = mockOpenUrlInApp.mock.calls[0];
    expect(url).toMatch(/^https:\/\/intercom\.onekey\.so\/\?/);
    expect(url).toMatch(/#bridge=injected-v1$/);
    expect(url).not.toContain('intercom_user_jwt');
    expect(url).not.toContain('conversationId');
    expect(mockApiGetCustomerJWT).not.toHaveBeenCalled();
  });

  it('does not open the WebView when the account changes during metadata loading', async () => {
    const { showIntercom } = await import('./webView.native');
    const instanceId = deferred<string | undefined>();
    mockInstanceId = instanceId.promise;
    const opening = showIntercom({ conversationId: 'conversation-1' });
    await flushEvents();
    mockUserId = 'B';
    instanceId.resolve('instance');
    await expect(opening).rejects.toThrow('user changed');
    expect(mockOpenUrlInApp).not.toHaveBeenCalled();
  });

  it('embeds extension support like mobile, with no JWT and no website jump', async () => {
    const { showIntercom } = await import('./index.ext');
    await showIntercom({ conversationId: 'conversation-1' });
    expect(mockOpenUrlInApp).toHaveBeenCalledTimes(1);
    const [url, title, options] = mockOpenUrlInApp.mock.calls[0];
    expect(title).toBe('Support');
    expect(options).toEqual({
      hideHeaderRight: true,
      disableBridge: true,
      intercomUserId: 'A',
    });
    expect(url).toMatch(/^https:\/\/intercom\.onekey\.so\/\?/);
    expect(url).toContain('language_override=en');
    expect(url).toMatch(
      new RegExp(
        `#bridge=message-channel-v1&parentOrigin=${encodeURIComponent(
          EXTENSION_ORIGIN,
        )}$`,
      ),
    );
    expect(url).not.toContain('intercom_user_jwt');
    expect(url).not.toContain('conversationId');
    expect(mockApiGetCustomerJWT).not.toHaveBeenCalled();
    expect(mockOpenUrlExternal).not.toHaveBeenCalled();
    expect(mockWindowOpen).not.toHaveBeenCalled();
  });

  describe('developer support URL override', () => {
    const previewUrl = 'https://intercom-preview.onekey.test/support/';

    it.each([
      ['WebView', './webView.native', 'injected-v1'],
      ['extension', './index.ext', 'message-channel-v1'],
    ])(
      'opens the %s support page at the configured URL',
      async (_name, modulePath, bridge) => {
        mockDevSettings = {
          enabled: true,
          settings: { intercomSupportUrl: `${previewUrl}#stale` },
        };
        const { showIntercom } = (await import(
          modulePath
        )) as typeof import('./webView.native');
        await showIntercom({ requestId: 'request-1' });
        expect(mockOpenUrlInApp).toHaveBeenCalledTimes(1);
        const [url] = mockOpenUrlInApp.mock.calls[0];
        expect(url.startsWith(`${previewUrl}?instanceId=instance`)).toBe(true);
        expect(url).toContain('requestId=request-1');
        expect(url).toContain(`#bridge=${bridge}`);
        expect(url).not.toContain('stale');
      },
    );

    it('ignores the override once developer mode is off', async () => {
      mockDevSettings = {
        enabled: false,
        settings: { intercomSupportUrl: previewUrl },
      };
      const { showIntercom } = await import('./webView.native');
      await showIntercom();
      const [url] = mockOpenUrlInApp.mock.calls[0];
      expect(url).toMatch(/^https:\/\/intercom\.onekey\.so\/\?/);
    });
  });

  it('does not open extension support when the account changes during metadata loading', async () => {
    const { showIntercom } = await import('./index.ext');
    const instanceId = deferred<string | undefined>();
    mockInstanceId = instanceId.promise;
    const opening = showIntercom({ conversationId: 'conversation-1' });
    await flushEvents();
    mockUserId = 'B';
    instanceId.resolve('instance');
    await opening;
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockOpenUrlInApp).not.toHaveBeenCalled();
    expect(mockOpenUrlExternal).not.toHaveBeenCalled();
    expect(mockNotifyOpenFailed).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: expect.stringContaining('changed') }),
    );
  });
});
