import type { IShowIntercomParams } from './utils';
import type { UserAttributes } from '@intercom/intercom-react-native';

let mockUserId: string | null = null;
let mockLoggedInUser: UserAttributes | undefined;
let mockUnreadCount = 0;
let mockOnUnreadChanged: (() => void) | undefined;
const mockNativeModules: { IntercomEventEmitter: object | undefined } = {
  IntercomEventEmitter: {},
};
const mockGetCustomerJWT = jest.fn<Promise<{ token: string }>, []>();
const mockWebIntercom = jest.fn<Promise<void>, [IShowIntercomParams?]>(
  async () => {},
);
const mockAddListener = jest.fn();
const mockNotifyOpenFailed = jest.fn((_error: unknown) => {});
const mockStorage = new Map<string, boolean>();
const mockPlatformEnv = {
  isNativeMainThread: true,
  isNativeIOSMacCatalyst: false,
  isNativeAndroid: false,
};
const mockSdk = {
  initialize: jest.fn(async () => true),
  setLauncherVisibility: jest.fn(async () => true),
  setInAppMessageVisibility: jest.fn(async (_visibility: string) => true),
  setThemeMode: jest.fn(async (_theme: string) => true),
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
  updateUser: jest.fn(async () => true),
  logEvent: jest.fn(async () => true),
  getUnreadConversationCount: jest.fn(async () => mockUnreadCount),
  present: jest.fn(async () => true),
  presentContent: jest.fn(async (_content: { id: string }) => true),
  bootstrapEventListeners: jest.fn(() => () => {}),
};

jest.mock('@intercom/intercom-react-native', () => ({
  __esModule: true,
  default: mockSdk,
  Visibility: { GONE: 'GONE', VISIBLE: 'VISIBLE' },
  ThemeMode: { DARK: 'DARK', LIGHT: 'LIGHT' },
  IntercomEvents: { IntercomUnreadCountDidChange: 'unread-changed' },
  IntercomContent: {
    conversationWithConversationId: (id: string) => ({ id }),
  },
}));
jest.mock('react-native', () => ({
  NativeModules: mockNativeModules,
  NativeEventEmitter: class {
    addListener(_name: string, listener: () => void) {
      mockAddListener();
      mockOnUnreadChanged = listener;
    }
  },
}));
jest.mock('../../appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
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
  getInstanceId: async () => 'test-instance',
  getIntercomLanguageOverride: async () => 'zh-CN',
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
  const originalApiKey = process.env.INTERCOM_IOS_API_KEY;
  const originalAndroidApiKey = process.env.INTERCOM_ANDROID_API_KEY;

  afterAll(() => {
    if (originalApiKey === undefined) {
      delete process.env.INTERCOM_IOS_API_KEY;
    } else {
      process.env.INTERCOM_IOS_API_KEY = originalApiKey;
    }
    if (originalAndroidApiKey === undefined) {
      delete process.env.INTERCOM_ANDROID_API_KEY;
    } else {
      process.env.INTERCOM_ANDROID_API_KEY = originalAndroidApiKey;
    }
  });

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    mockUserId = null;
    mockLoggedInUser = undefined;
    mockUnreadCount = 0;
    mockOnUnreadChanged = undefined;
    mockNativeModules.IntercomEventEmitter = {};
    mockPlatformEnv.isNativeMainThread = true;
    mockPlatformEnv.isNativeIOSMacCatalyst = false;
    mockPlatformEnv.isNativeAndroid = false;
    mockGetCustomerJWT.mockReset();
    mockStorage.clear();
    // Most cases model an anonymous user who has contacted support before.
    mockStorage.set(SUPPORT_OPENED_KEY, true);
    process.env.INTERCOM_IOS_API_KEY = 'test-ios-sdk-key';
    process.env.INTERCOM_ANDROID_API_KEY = 'test-android-sdk-key';
    subject = await import('./index.native');
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

      expect(mockSdk.initialize).toHaveBeenCalledTimes(1);
      expect(mockSdk.initialize).toHaveBeenCalledWith(
        platform === 'android' ? 'test-android-sdk-key' : 'test-ios-sdk-key',
        'vbbj4ssb',
      );
      expect(
        mockSdk.bootstrapEventListeners.mock.invocationCallOrder[0],
      ).toBeLessThan(mockAddListener.mock.invocationCallOrder[0]);
      expect(mockSdk.loginUnidentifiedUser).not.toHaveBeenCalled();
      expect(mockSdk.logout).not.toHaveBeenCalled();
      expect(subject.getIntercomUnreadCount()).toBe(3);
      expect(mockSdk.setLauncherVisibility).toHaveBeenCalledWith('GONE');
      expect(mockSdk.setInAppMessageVisibility).toHaveBeenCalledWith('GONE');
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

  it('preserves support access on older binaries or without SDK configuration', async () => {
    delete process.env.INTERCOM_IOS_API_KEY;
    delete process.env.INTERCOM_ANDROID_API_KEY;
    await subject.initIntercom();
    await subject.showIntercom({ conversationId: 'conversation-1' });
    expect(mockSdk.initialize).not.toHaveBeenCalled();
    expect(mockWebIntercom).toHaveBeenCalledWith({
      conversationId: 'conversation-1',
    });

    process.env.INTERCOM_IOS_API_KEY = 'test-ios-sdk-key';
    process.env.INTERCOM_ANDROID_API_KEY = 'test-android-sdk-key';
    mockNativeModules.IntercomEventEmitter = undefined;
    await subject.initIntercom();
    await subject.showIntercom();
    expect(mockSdk.initialize).not.toHaveBeenCalled();
    expect(mockWebIntercom).toHaveBeenCalledTimes(2);
    expect(subject.getIntercomUnreadCount()).toBe(0);
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
    expect(mockSdk.initialize).toHaveBeenCalledTimes(1);
    expect(mockSdk.logEvent).not.toHaveBeenCalled();

    mockUserId = null;
    await subject.initIntercom();
    expect(mockSdk.logout).toHaveBeenCalledTimes(1);
  });
});
