let mockUserId: string | null = 'A';
let mockInstanceId: Promise<string | undefined> = Promise.resolve('instance');
const mockOpenUrlInApp = jest.fn((_url: string, _title: string) => {});
const mockNotifyOpenFailed = jest.fn((_error: unknown) => {});
const mockWindowOpen = jest.fn();

jest.mock('../../appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      servicePrime: {
        getLocalUserInfo: async () => ({
          isLoggedIn: mockUserId !== null,
          onekeyUserId: mockUserId,
        }),
        apiGetCustomerJWT: async () => ({ token: createToken('intercom-A') }),
      },
    },
  },
}));
jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('../../utils/openUrlUtils', () => ({
  __esModule: true,
  default: {
    openUrlInApp: (url: string, title: string) => {
      mockOpenUrlInApp(url, title);
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

function createToken(userId: string) {
  return `header.${Buffer.from(JSON.stringify({ user_id: userId })).toString(
    'base64url',
  )}.signature`;
}

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
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { open: mockWindowOpen },
    });
  });

  it('opens the WebView with the token of the user still signed in', async () => {
    const { showIntercom } = await import('./webView.native');
    await showIntercom({ conversationId: 'conversation-1' });
    expect(mockOpenUrlInApp).toHaveBeenCalledTimes(1);
    expect(mockOpenUrlInApp.mock.calls[0][0]).toContain(
      encodeURIComponent(createToken('intercom-A')),
    );
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

  it('does not open the extension tab when the account changes during metadata loading', async () => {
    const { showIntercom } = await import('./index.ext');
    const instanceId = deferred<string | undefined>();
    mockInstanceId = instanceId.promise;
    const opening = showIntercom({ conversationId: 'conversation-1' });
    await flushEvents();
    mockUserId = 'B';
    instanceId.resolve('instance');
    await opening;
    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockNotifyOpenFailed).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: expect.stringContaining('changed') }),
    );
  });
});
