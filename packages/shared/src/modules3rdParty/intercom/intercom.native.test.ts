import type { IShowIntercomParams } from './utils';
import type { UserAttributes } from '@intercom/intercom-react-native';

let mockUserId: string | null = null;
let mockLoggedInUser: UserAttributes | undefined;
let mockUnreadCount = 0;
let mockOnUnreadChanged: (() => void) | undefined;
let mockOnWindowHidden: (() => void) | undefined;
let mockOnAppStateChange: ((state: string) => void) | undefined;
let mockOnSupportReply: (() => void) | undefined;
const mockAppState = { currentState: 'background' };
const mockUpdateLockPolicy = jest.fn(async () => {});
const mockRefreshUnreadCount = jest.fn<Promise<void>, [string]>(async () => {});
const mockNativeModules: {
  IntercomEventEmitter: object | undefined;
  OneKeyIntercom: {
    initialized: boolean;
    refreshUnreadCount?: typeof mockRefreshUnreadCount;
    updateLockPolicy: typeof mockUpdateLockPolicy;
  };
} = {
  OneKeyIntercom: {
    initialized: true,
    refreshUnreadCount: mockRefreshUnreadCount,
    updateLockPolicy: mockUpdateLockPolicy,
  },
  IntercomEventEmitter: {},
};
const mockGetCustomerJWT = jest.fn<Promise<{ token: string }>, []>();
const mockWebIntercom = jest.fn<Promise<void>, [IShowIntercomParams?]>(
  async () => {},
);
const mockAddListener = jest.fn();
const mockNotifyOpenFailed = jest.fn((_error: unknown) => {});
const mockStorage = new Map<string, boolean>();
let mockSupportUrlOverride: string | undefined;
const mockPlatformEnv = {
  isNativeMainThread: true,
  isNativeIOSMacCatalyst: false,
  isNativeAndroid: false,
};
const mockSdk = {
  initialize: jest.fn(async () => true),
  setThemeMode: jest.fn(async (_theme: string) => true),
  setInAppMessageVisibility: jest.fn(async (_visibility: string) => true),
  isUserLoggedIn: jest.fn(async () => mockLoggedInUser !== undefined),
  fetchLoggedInUserAttributes: jest.fn(async () => mockLoggedInUser ?? {}),
  loginUnidentifiedUser: jest.fn(async () => {
    mockLoggedInUser = {};
    return true;
  }),
  loginUserWithUserAttributes: jest.fn(async (attributes: UserAttributes) => {
    mockLoggedInUser = attributes;
    return true;
  }),
  logout: jest.fn(async () => {
    mockLoggedInUser = undefined;
    return true;
  }),
  hideIntercom: jest.fn(async () => true),
  setUserJwt: jest.fn(async (_token: string) => true),
  setUserJwtProvider: jest.fn(
    async (_provider: () => Promise<string | null>) => true,
  ),
  removeUserJwtProvider: jest.fn(async () => true),
  updateUser: jest.fn<Promise<boolean>, [UserAttributes]>(async () => true),
  logEvent: jest.fn(async () => true),
  getUnreadConversationCount: jest.fn(async () => mockUnreadCount),
  present: jest.fn(async () => true),
  presentContent: jest.fn(async (_content: { id: string }) => true),
  bootstrapEventListeners: jest.fn(() => () => {}),
};

jest.mock('@intercom/intercom-react-native', () => ({
  __esModule: true,
  default: mockSdk,
  ThemeMode: { DARK: 'DARK', LIGHT: 'LIGHT', SYSTEM: 'SYSTEM' },
  Visibility: { GONE: 'GONE', VISIBLE: 'VISIBLE' },
  IntercomEvents: {
    IntercomUnreadCountDidChange: 'unread-changed',
    IntercomWindowDidHide: 'window-hidden',
  },
  IntercomContent: {
    conversationWithConversationId: (id: string) => ({ id }),
  },
}));
jest.mock('react-native', () => ({
  NativeModules: mockNativeModules,
  NativeEventEmitter: class {
    addListener(name: string, listener: () => void) {
      mockAddListener();
      if (name === 'unread-changed') {
        mockOnUnreadChanged = listener;
      } else if (name === 'window-hidden') {
        mockOnWindowHidden = listener;
      }
    }
  },
  AppState: {
    get currentState() {
      return mockAppState.currentState;
    },
    addEventListener: (_event: string, listener: (state: string) => void) => {
      mockOnAppStateChange = listener;
      return { remove: () => {} };
    },
  },
}));
jest.mock('../../appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      serviceLogger: { addMsg: jest.fn() },
      servicePrime: {
        getLocalUserInfo: async () => ({
          isLoggedIn: mockUserId !== null,
          onekeyUserId: mockUserId,
        }),
        apiGetCustomerJWT: () => mockGetCustomerJWT(),
      },
    },
  },
}));
jest.mock('../../eventBus/appEventBus', () => ({
  EAppEventBusNames: { SupportReplyReceived: 'SupportReplyReceived' },
  appEventBus: {
    on: (name: string, listener: () => void) => {
      if (name === 'SupportReplyReceived') {
        mockOnSupportReply = listener;
      }
    },
  },
}));
jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: mockPlatformEnv,
}));
jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('./openFailure', () => ({
  notifyIntercomOpenFailed: (error: unknown) => mockNotifyOpenFailed(error),
}));
jest.mock('../../storage/appStorage', () => ({
  __esModule: true,
  default: {
    syncStorage: {
      getBoolean: (key: string) => mockStorage.get(key),
      set: async (key: string, value: boolean) => {
        mockStorage.set(key, value);
      },
    },
  },
}));
jest.mock('./webView.native', () => ({
  showIntercom: (params?: IShowIntercomParams) => mockWebIntercom(params),
}));
jest.mock('./utils', () => ({
  ...jest.requireActual<typeof import('./utils')>('./utils'),
  getInstanceId: async () => 'test-instance',
  getIntercomLanguageOverride: async () => 'zh-CN',
  getIntercomSupportUrlOverride: async () => mockSupportUrlOverride,
}));

function createToken(userId: string) {
  const claims = Buffer.from(JSON.stringify({ user_id: userId })).toString(
    'base64url',
  );
  return `header.${claims}.signature`;
}

const SUPPORT_OPENED_KEY = 'onekey_intercom_native_support_opened';

function expectOpenFailure(message: string) {
  expect(mockNotifyOpenFailed).toHaveBeenLastCalledWith(
    expect.objectContaining({ message: expect.stringContaining(message) }),
  );
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

describe('native Intercom SDK integration', () => {
  let subject: typeof import('./index.native');
  let mockSupportLog: {
    intercomUnreadChanged: jest.SpyInstance;
    supportReplyResync: jest.SpyInstance;
    intercomUnreadRefreshFailed: jest.SpyInstance;
  };
  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockUserId = null;
    mockLoggedInUser = undefined;
    mockUnreadCount = 0;
    mockOnUnreadChanged = undefined;
    mockOnWindowHidden = undefined;
    mockOnAppStateChange = undefined;
    mockOnSupportReply = undefined;
    mockAppState.currentState = 'background';
    mockNativeModules.IntercomEventEmitter = {};
    mockPlatformEnv.isNativeMainThread = true;
    mockPlatformEnv.isNativeIOSMacCatalyst = false;
    mockPlatformEnv.isNativeAndroid = false;
    mockGetCustomerJWT.mockReset();
    mockSdk.updateUser.mockReset().mockResolvedValue(true);
    mockRefreshUnreadCount.mockReset().mockResolvedValue(undefined);
    mockStorage.clear();
    mockSupportUrlOverride = undefined;
    // Most cases model an anonymous user who has contacted support before.
    mockStorage.set(SUPPORT_OPENED_KEY, true);
    mockNativeModules.OneKeyIntercom.initialized = true;
    mockNativeModules.OneKeyIntercom.refreshUnreadCount =
      mockRefreshUnreadCount;
    subject = await import('./index.native');
    const { defaultLogger } = await import('../../logger/logger');
    mockSupportLog = {
      intercomUnreadChanged: jest.spyOn(
        defaultLogger.notification.support,
        'intercomUnreadChanged',
      ),
      supportReplyResync: jest.spyOn(
        defaultLogger.notification.support,
        'supportReplyResync',
      ),
      intercomUnreadRefreshFailed: jest.spyOn(
        defaultLogger.notification.support,
        'intercomUnreadRefreshFailed',
      ),
    };
  });

  it('keeps the native singleton out of the background runtime and Catalyst', async () => {
    mockPlatformEnv.isNativeMainThread = false;
    await subject.initIntercom();
    await subject.showIntercom();
    expectOpenFailure('main runtime');
    expect(mockSdk.initialize).not.toHaveBeenCalled();

    mockPlatformEnv.isNativeMainThread = true;
    mockPlatformEnv.isNativeIOSMacCatalyst = true;
    await subject.showIntercom({ conversationId: 'conversation-1' });
    expect(mockWebIntercom).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
    });
    expect(mockSdk.initialize).not.toHaveBeenCalled();
  });

  it.each(['ios', 'android'])(
    'initializes %s once and publishes live unread changes',
    async (platform) => {
      mockPlatformEnv.isNativeAndroid = platform === 'android';
      mockLoggedInUser = {};
      mockUnreadCount = 3;
      const listener = jest.fn();
      const unsubscribe = subject.subscribeToIntercomUnreadCount(listener);
      await subject.setIntercomTheme('dark');
      expect(mockSdk.initialize).not.toHaveBeenCalled();
      await Promise.all([subject.initIntercom(), subject.initIntercom()]);

      // Native initialization is the only source of readiness on both platforms.
      expect(mockSdk.initialize).not.toHaveBeenCalled();
      expect(
        mockSdk.bootstrapEventListeners.mock.invocationCallOrder[0],
      ).toBeLessThan(mockAddListener.mock.invocationCallOrder[0]);
      expect(mockSdk.loginUnidentifiedUser).not.toHaveBeenCalled();
      expect(mockSdk.logout).not.toHaveBeenCalled();
      expect(subject.getIntercomUnreadCount()).toBe(3);
      expect(mockSdk.setThemeMode).toHaveBeenCalledWith('DARK');

      listener.mockClear();
      mockUnreadCount = 0;
      mockOnUnreadChanged?.();
      await flushEvents();
      expect(subject.getIntercomUnreadCount()).toBe(0);
      expect(listener).toHaveBeenCalledTimes(1);
      unsubscribe();
      await subject.setIntercomTheme('light');
      expect(mockSdk.setThemeMode).toHaveBeenLastCalledWith('LIGHT');
    },
  );

  it('follows the system theme when the app theme follows the system', async () => {
    await subject.setIntercomTheme('dark', true);
    await subject.initIntercom();
    expect(mockSdk.setThemeMode).toHaveBeenLastCalledWith('SYSTEM');

    await subject.setIntercomTheme('light');
    expect(mockSdk.setThemeMode).toHaveBeenLastCalledWith('LIGHT');
    await subject.setIntercomTheme('light', true);
    expect(mockSdk.setThemeMode).toHaveBeenLastCalledWith('SYSTEM');
  });

  it('never shows in-app messages and hides them without loading the SDK', async () => {
    // A fresh main runtime hides messages a previous runtime left enabled,
    // without starting an SDK session.
    await subject.setIntercomInAppMessageVisibility(true);
    expect(mockSdk.setInAppMessageVisibility).toHaveBeenCalledTimes(1);
    expect(mockSdk.setInAppMessageVisibility).toHaveBeenLastCalledWith('GONE');
    expect(mockSdk.bootstrapEventListeners).not.toHaveBeenCalled();
    expect(mockSdk.isUserLoggedIn).not.toHaveBeenCalled();

    // Re-enabling would re-present an unread reply the user swiped away
    // (OK-67003), so main tabs, unlocks and new sessions all stay hidden.
    mockUserId = 'A';
    mockGetCustomerJWT.mockResolvedValue({ token: createToken('intercom-A') });
    await subject.initIntercom();
    await subject.setIntercomInAppMessageVisibility(true);
    await subject.setIntercomMessengerLocked(true);
    await subject.setIntercomMessengerLocked(false);
    await flushEvents();
    mockUserId = 'B';
    mockGetCustomerJWT.mockResolvedValue({ token: createToken('intercom-B') });
    await subject.initIntercom();
    await subject.setIntercomInAppMessageVisibility(true);
    expect(mockSdk.setInAppMessageVisibility).toHaveBeenLastCalledWith('GONE');
    expect(mockSdk.setInAppMessageVisibility).not.toHaveBeenCalledWith(
      'VISIBLE',
    );

    mockSdk.setInAppMessageVisibility.mockClear();
    mockPlatformEnv.isNativeMainThread = false;
    await subject.setIntercomInAppMessageVisibility(true);
    expect(mockSdk.setInAppMessageVisibility).not.toHaveBeenCalled();
  });

  it('hides messages over a lock screen after a main runtime restart', async () => {
    await subject.setIntercomMessengerLocked(true);
    await flushEvents();
    expect(mockSdk.setInAppMessageVisibility).toHaveBeenLastCalledWith('GONE');
    expect(mockSdk.bootstrapEventListeners).not.toHaveBeenCalled();

    mockNativeModules.OneKeyIntercom.initialized = false;
    mockSdk.setInAppMessageVisibility.mockClear();
    await subject.setIntercomInAppMessageVisibility(false);
    expect(mockSdk.setInAppMessageVisibility).not.toHaveBeenCalled();
  });

  it('refreshes unread count on foreground and Messenger close', async () => {
    await subject.initIntercom();
    expect(subject.getIntercomUnreadCount()).toBe(0);

    mockUnreadCount = 2;
    mockOnAppStateChange?.('active');
    await flushEvents();
    expect(subject.getIntercomUnreadCount()).toBe(2);

    mockUnreadCount = 0;
    mockOnWindowHidden?.();
    await flushEvents();
    expect(subject.getIntercomUnreadCount()).toBe(0);
    mockOnAppStateChange?.('background');
  });

  it('polls the unread count only while the app is active', async () => {
    jest.useFakeTimers();
    try {
      mockAppState.currentState = 'active';
      await subject.initIntercom();
      mockSdk.getUnreadConversationCount.mockClear();

      mockUnreadCount = 4;
      await jest.advanceTimersByTimeAsync(30_000);
      expect(mockSdk.getUnreadConversationCount).toHaveBeenCalledTimes(1);
      expect(subject.getIntercomUnreadCount()).toBe(4);

      mockOnAppStateChange?.('background');
      await jest.advanceTimersByTimeAsync(60_000);
      expect(mockSdk.getUnreadConversationCount).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('resyncs the unread count from the server on a support reply push', async () => {
    // The SDK listens only once a session loaded it.
    expect(mockOnSupportReply).toBeUndefined();

    mockAppState.currentState = 'active';
    await subject.initIntercom();
    expect(subject.getIntercomUnreadCount()).toBe(0);
    mockSdk.updateUser.mockClear();
    // The realtime event never reached the SDK; only a server response
    // updates its unread cache (OK-67112).
    mockSdk.updateUser.mockImplementationOnce(async () => {
      mockUnreadCount = 1;
      return true;
    });
    mockOnSupportReply?.();
    await flushEvents();
    expect(mockSdk.updateUser).toHaveBeenCalledWith({
      languageOverride: 'zh-CN',
    });
    expect(subject.getIntercomUnreadCount()).toBe(1);
    expect(mockSupportLog.intercomUnreadChanged).toHaveBeenCalledWith({
      trigger: 'support-push',
      previousCount: 0,
      count: 1,
    });
    expect(mockSupportLog.supportReplyResync).toHaveBeenLastCalledWith({
      result: 'resynced',
    });
    mockOnAppStateChange?.('background');
  });

  it('refreshes Android replies after a same-language session update and waits for the response', async () => {
    mockPlatformEnv.isNativeAndroid = true;
    mockAppState.currentState = 'active';
    let previousLanguage: string | undefined;
    let serverUnreadCount = 0;
    let serverRequests = 0;
    // Model Android's attribute dedup: repeated attributes succeed locally.
    mockSdk.updateUser.mockImplementation(async ({ languageOverride }) => {
      if (languageOverride !== previousLanguage) {
        previousLanguage = languageOverride;
        serverRequests += 1;
        mockUnreadCount = serverUnreadCount;
      }
      return true;
    });
    const response = deferred<void>();
    mockRefreshUnreadCount.mockImplementationOnce(async (languageOverride) => {
      await response.promise;
      previousLanguage = undefined;
      await mockSdk.updateUser({ languageOverride });
    });

    try {
      await subject.initIntercom();
      expect(serverRequests).toBe(1);
      expect(subject.getIntercomUnreadCount()).toBe(0);

      serverUnreadCount = 1;
      mockOnSupportReply?.();
      await flushEvents();
      expect(mockRefreshUnreadCount).toHaveBeenCalledWith('zh-CN');
      expect(serverRequests).toBe(1);
      expect(subject.getIntercomUnreadCount()).toBe(0);
      expect(mockSupportLog.supportReplyResync).not.toHaveBeenCalled();

      response.resolve();
      await flushEvents();
      expect(serverRequests).toBe(2);
      expect(subject.getIntercomUnreadCount()).toBe(1);
      expect(mockSupportLog.supportReplyResync).toHaveBeenLastCalledWith({
        result: 'resynced',
      });
    } finally {
      mockOnAppStateChange?.('background');
    }
  });

  it('retries a failed Android reply refresh on the next foreground', async () => {
    mockPlatformEnv.isNativeAndroid = true;
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockRefreshUnreadCount
      .mockRejectedValueOnce(new Error('offline'))
      .mockImplementationOnce(async () => {
        mockUnreadCount = 2;
      });

    try {
      await subject.initIntercom();
      // A background reply is flushed on foreground, where its request fails.
      mockOnSupportReply?.();
      await flushEvents();
      mockAppState.currentState = 'active';
      mockOnAppStateChange?.('active');
      await flushEvents();
      expect(mockRefreshUnreadCount).toHaveBeenCalledTimes(1);
      expect(subject.getIntercomUnreadCount()).toBe(0);
      expect(mockSupportLog.intercomUnreadRefreshFailed).toHaveBeenCalledWith({
        trigger: 'support-push',
        errorName: 'Error',
      });

      mockOnAppStateChange?.('background');
      mockOnAppStateChange?.('active');
      await flushEvents();
      expect(mockRefreshUnreadCount).toHaveBeenCalledTimes(2);
      expect(subject.getIntercomUnreadCount()).toBe(2);
      expect(mockSupportLog.supportReplyResync).toHaveBeenLastCalledWith({
        result: 'resynced',
      });

      mockOnAppStateChange?.('background');
      mockOnAppStateChange?.('active');
      await flushEvents();
      expect(mockRefreshUnreadCount).toHaveBeenCalledTimes(2);
    } finally {
      mockOnAppStateChange?.('background');
      warning.mockRestore();
    }
  });

  it('does not report an Android server refresh on binaries without the bridge', async () => {
    mockPlatformEnv.isNativeAndroid = true;
    mockAppState.currentState = 'active';
    mockNativeModules.OneKeyIntercom.refreshUnreadCount = undefined;
    const warning = jest.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      await subject.initIntercom();
      mockSdk.updateUser.mockClear();
      mockOnSupportReply?.();
      await flushEvents();
      expect(mockSdk.updateUser).not.toHaveBeenCalled();
      expect(mockSupportLog.supportReplyResync).not.toHaveBeenCalled();
      expect(mockSupportLog.intercomUnreadRefreshFailed).toHaveBeenCalledWith({
        trigger: 'support-push',
        errorName: 'Error',
      });
    } finally {
      mockOnAppStateChange?.('background');
      warning.mockRestore();
    }
  });

  it('defers a support reply received in the background to the next foreground', async () => {
    await subject.initIntercom();
    mockSdk.updateUser.mockClear();

    mockOnSupportReply?.();
    await flushEvents();
    expect(mockSdk.updateUser).not.toHaveBeenCalled();
    expect(mockSupportLog.supportReplyResync).toHaveBeenLastCalledWith({
      result: 'deferred-to-foreground',
    });

    mockUnreadCount = 2;
    mockAppState.currentState = 'active';
    mockOnAppStateChange?.('active');
    await flushEvents();
    expect(mockSdk.updateUser).toHaveBeenCalledTimes(1);
    expect(subject.getIntercomUnreadCount()).toBe(2);

    // The pending resync runs once.
    mockOnAppStateChange?.('background');
    mockOnAppStateChange?.('active');
    await flushEvents();
    expect(mockSdk.updateUser).toHaveBeenCalledTimes(1);
    mockOnAppStateChange?.('background');
  });

  it('does not resync a support reply into a switched identity', async () => {
    mockAppState.currentState = 'active';
    mockUserId = 'A';
    mockGetCustomerJWT.mockResolvedValue({ token: createToken('intercom-A') });
    await subject.initIntercom();
    mockSdk.updateUser.mockClear();

    // The wallet switched accounts before the push arrived; the new session
    // has not been established yet.
    mockUserId = 'B';
    mockOnSupportReply?.();
    await flushEvents();
    expect(mockSdk.updateUser).not.toHaveBeenCalled();
    expect(mockSupportLog.supportReplyResync).toHaveBeenLastCalledWith({
      result: 'identity-changed',
    });
    mockOnAppStateChange?.('background');
  });

  it('leaves a support reply to a session sync that is still running', async () => {
    mockAppState.currentState = 'active';
    mockUserId = 'A';
    mockGetCustomerJWT.mockResolvedValue({ token: createToken('intercom-A') });
    await subject.initIntercom();
    mockSdk.updateUser.mockClear();

    // The next identity's JWT request hangs; the push must not wait on it.
    mockUserId = 'B';
    const jwt = deferred<{ token: string }>();
    mockGetCustomerJWT.mockReturnValueOnce(jwt.promise);
    const switching = subject.initIntercom();
    await flushEvents();
    mockOnSupportReply?.();
    await flushEvents();
    expect(mockSupportLog.supportReplyResync).toHaveBeenLastCalledWith({
      result: 'session-syncing',
    });

    jwt.resolve({ token: createToken('intercom-B') });
    await switching;
    // The finished sync ran its own resync.
    expect(mockSdk.updateUser).toHaveBeenCalledTimes(1);
    mockOnAppStateChange?.('background');
  });

  it('preserves support access on older binaries or without SDK configuration', async () => {
    mockNativeModules.OneKeyIntercom.initialized = false;
    await subject.initIntercom();
    await subject.showIntercom({ conversationId: 'conversation-1' });
    expect(mockSdk.initialize).not.toHaveBeenCalled();
    expect(mockWebIntercom).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
    });

    mockNativeModules.OneKeyIntercom.initialized = true;
    mockNativeModules.IntercomEventEmitter = undefined;
    await subject.initIntercom();
    await subject.showIntercom();
    expect(mockSdk.initialize).not.toHaveBeenCalled();
    expect(mockWebIntercom).toHaveBeenCalledTimes(2);
    expect(subject.getIntercomUnreadCount()).toBe(0);
  });

  it.each(['ios', 'android'])(
    'keeps %s support on the SDK while a support URL override is set',
    async (platform) => {
      mockPlatformEnv.isNativeAndroid = platform === 'android';
      mockSupportUrlOverride = 'https://intercom-preview.onekey.test/';
      await subject.showIntercom({ requestId: 'request-1' });
      expect(mockWebIntercom).not.toHaveBeenCalled();
      expect(mockSdk.present).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps notification conversations on the SDK while a support URL override is set', async () => {
    mockSupportUrlOverride = 'https://intercom-preview.onekey.test/';
    await subject.showIntercom({ conversationId: 'conversation-1' });
    expect(mockWebIntercom).not.toHaveBeenCalled();
    expect(mockSdk.presentContent).toHaveBeenCalledWith({
      id: 'conversation-1',
    });
  });

  it('sends lock policy to Android without loading the SDK or using bg state', async () => {
    mockPlatformEnv.isNativeAndroid = true;
    const policy = { validFromMs: 1234, lockAtMs: 301_234 };
    await subject.setIntercomMessengerLocked(false, policy);
    expect(mockUpdateLockPolicy).toHaveBeenCalledWith(false, 1234, 301_234);
    expect(mockSdk.bootstrapEventListeners).not.toHaveBeenCalled();
    mockUpdateLockPolicy.mockClear();
    mockPlatformEnv.isNativeMainThread = false;
    await subject.setIntercomMessengerLocked(true, policy);
    expect(mockUpdateLockPolicy).not.toHaveBeenCalled();
  });

  it('retries an initialization cancelled by a transient account change', async () => {
    mockUserId = 'A';
    const response = deferred<{ token: string }>();
    mockGetCustomerJWT.mockReturnValueOnce(response.promise);
    mockGetCustomerJWT.mockResolvedValue({ token: createToken('intercom-A') });
    const starting = subject.initIntercom();
    await flushEvents();
    mockUserId = 'B';
    response.resolve({ token: createToken('intercom-A') });
    await starting;
    expect(mockSdk.loginUserWithUserAttributes).not.toHaveBeenCalled();
    mockUserId = 'A';
    await subject.initIntercom();
    expect(mockSdk.loginUserWithUserAttributes).toHaveBeenCalledWith({
      userId: 'intercom-A',
    });
  });

  it('identifies an anonymous session with JWT before login and clears it after sign-out', async () => {
    await subject.initIntercom();
    mockUserId = 'onekey-user';
    const token = createToken('intercom-user');
    mockGetCustomerJWT.mockResolvedValue({ token });
    mockUnreadCount = 2;
    await subject.initIntercom();

    expect(mockSdk.setUserJwt).toHaveBeenCalledWith(token);
    expect(mockSdk.loginUserWithUserAttributes).toHaveBeenCalledWith({
      userId: 'intercom-user',
    });
    expect(mockSdk.logout).not.toHaveBeenCalled();
    expect(mockSdk.setUserJwt.mock.invocationCallOrder[0]).toBeLessThan(
      mockSdk.loginUserWithUserAttributes.mock.invocationCallOrder[0],
    );
    expect(subject.getIntercomUnreadCount()).toBe(2);
    const provider = mockSdk.setUserJwtProvider.mock.calls[0][0];

    mockUserId = null;
    mockUnreadCount = 0;
    await subject.initIntercom();
    expect(await provider()).toBeNull();
    expect(mockSdk.logout).toHaveBeenCalledTimes(1);
    expect(mockSdk.loginUnidentifiedUser).toHaveBeenCalledTimes(2);
    expect(subject.getIntercomUnreadCount()).toBe(0);
  });

  it('does not log in a previous user when their token arrives after sign-out', async () => {
    mockUserId = 'previous-user';
    const tokenResponse = deferred<{ token: string }>();
    mockGetCustomerJWT.mockReturnValue(tokenResponse.promise);
    const previousSession = subject.initIntercom();
    await flushEvents();

    mockUserId = null;
    const anonymousSession = subject.initIntercom();
    tokenResponse.resolve({ token: createToken('previous-intercom-user') });
    await Promise.all([previousSession, anonymousSession]);
    expect(mockSdk.loginUserWithUserAttributes).not.toHaveBeenCalled();
    expect(mockSdk.loginUnidentifiedUser).toHaveBeenCalledTimes(1);
  });

  it.each([
    '',
    `header.${Buffer.from(JSON.stringify({ email: 'test@example.com' })).toString('base64url')}.signature`,
  ])(
    'rejects a token without user_id instead of falling back to anonymous (%#)',
    async (token) => {
      mockUserId = 'onekey-user';
      mockGetCustomerJWT.mockResolvedValue({ token });
      await subject.showIntercom();
      expectOpenFailure('identity token');
      expect(mockSdk.setUserJwt).not.toHaveBeenCalled();
      expect(mockSdk.loginUserWithUserAttributes).not.toHaveBeenCalled();
      expect(mockSdk.loginUnidentifiedUser).not.toHaveBeenCalled();
      expect(mockSdk.present).not.toHaveBeenCalled();
    },
  );

  it('opens an exact conversation or the default messenger without an id', async () => {
    mockStorage.clear();
    await subject.showIntercom({
      conversationId: 'conversation-123',
      requestId: 'request-123',
    });
    expect(mockSdk.presentContent).toHaveBeenCalledWith({
      id: 'conversation-123',
    });
    expect(mockSdk.logEvent).toHaveBeenCalledWith('client info', {
      instanceId: 'test-instance',
      requestId: 'request-123',
    });
    expect(mockStorage.get(SUPPORT_OPENED_KEY)).toBe(true);
    await subject.showIntercom();
    expect(mockSdk.present).toHaveBeenCalledTimes(1);
  });

  it('ignores an unread response from the previous identity', async () => {
    mockUserId = 'onekey-user';
    mockGetCustomerJWT.mockResolvedValue({
      token: createToken('intercom-user'),
    });
    await subject.initIntercom();
    const unreadResponse = deferred<number>();
    mockSdk.getUnreadConversationCount.mockReturnValueOnce(
      unreadResponse.promise,
    );
    mockOnUnreadChanged?.();
    await flushEvents();

    mockUserId = null;
    await subject.initIntercom();
    unreadResponse.resolve(8);
    await flushEvents();
    expect(subject.getIntercomUnreadCount()).toBe(0);
  });

  it('does not present the previous identity after sign-out during request tracking', async () => {
    mockUserId = 'onekey-user';
    mockGetCustomerJWT.mockResolvedValue({
      token: createToken('intercom-user'),
    });
    await subject.initIntercom();
    const trackingResponse = deferred<boolean>();
    mockSdk.logEvent.mockReturnValueOnce(trackingResponse.promise);
    const opening = subject.showIntercom({ requestId: 'test-request' });
    await flushEvents();

    mockUserId = null;
    const anonymousSession = subject.initIntercom();
    trackingResponse.resolve(true);
    await opening;
    expectOpenFailure('user changed');
    await anonymousSession;
    expect(mockSdk.present).not.toHaveBeenCalled();
  });

  it('keeps the SDK off for anonymous users who never contacted support', async () => {
    mockStorage.clear();
    await subject.initIntercom();
    expect(mockSdk.initialize).not.toHaveBeenCalled();

    mockUserId = 'onekey-user';
    mockGetCustomerJWT.mockResolvedValue({
      token: createToken('intercom-user'),
    });
    await subject.initIntercom();
    expect(mockSdk.initialize).not.toHaveBeenCalled();
    expect(mockSdk.logEvent).not.toHaveBeenCalled();

    mockUserId = null;
    await subject.initIntercom();
    expect(mockSdk.logout).toHaveBeenCalledTimes(1);
  });

  it('retires the previous account before the next JWT request can fail', async () => {
    mockUserId = 'A';
    mockGetCustomerJWT.mockResolvedValue({ token: createToken('intercom-A') });
    await subject.initIntercom();
    expect(mockSdk.loginUserWithUserAttributes).toHaveBeenCalledTimes(1);

    mockUserId = 'B';
    mockGetCustomerJWT.mockRejectedValueOnce(new Error('offline'));
    await expect(subject.initIntercom()).rejects.toThrow('offline');
    expect(mockSdk.hideIntercom).toHaveBeenCalledTimes(1);
    expect(mockSdk.logout).toHaveBeenCalledTimes(1);
    expect(mockSdk.loginUserWithUserAttributes).toHaveBeenCalledTimes(1);
  });

  it('hides the Messenger on lock and keeps in-flight opens closed', async () => {
    await subject.setIntercomMessengerLocked(true);
    expect(mockSdk.hideIntercom).not.toHaveBeenCalled();
    await subject.setIntercomMessengerLocked(false);
    await subject.showIntercom();
    expect(mockSdk.present).toHaveBeenCalledTimes(1);
    await subject.setIntercomMessengerLocked(true);
    expect(mockSdk.hideIntercom).toHaveBeenCalledTimes(1);

    await subject.setIntercomMessengerLocked(false);
    const tracking = deferred<boolean>();
    mockSdk.logEvent.mockReturnValueOnce(tracking.promise);
    const opening = subject.showIntercom();
    await flushEvents();
    await subject.setIntercomMessengerLocked(true);
    tracking.resolve(true);
    await opening;
    expect(mockSdk.present).toHaveBeenCalledTimes(1);
  });
});
