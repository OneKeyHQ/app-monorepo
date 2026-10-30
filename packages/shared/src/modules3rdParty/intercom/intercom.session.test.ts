let mockUserId: string | null = 'A';
const mockUnreadCallbacks: ((count: number) => void)[] = [];
const mockApiGetCustomerJWT = jest.fn<Promise<{ token: string }>, []>();
const mockNotifyOpenFailed = jest.fn((_error: unknown) => {});
const mockSdk = {
  default: jest.fn(),
  boot: jest.fn(),
  shutdown: jest.fn(),
  onShow: jest.fn(),
  onUnreadCountChange: jest.fn((callback: (count: number) => void) => {
    mockUnreadCallbacks.push(callback);
  }),
  trackEvent: jest.fn(),
  update: jest.fn(),
  show: jest.fn(),
  hide: jest.fn(),
  showConversation: jest.fn(),
};

jest.mock('@intercom/messenger-js-sdk', () => ({
  __esModule: true,
  ...mockSdk,
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
        apiGetCustomerJWT: () => mockApiGetCustomerJWT(),
      },
    },
  },
}));
jest.mock('../../errors', () => ({ OneKeyLocalError: Error }));
jest.mock('./openFailure', () => ({
  notifyIntercomOpenFailed: (error: unknown) => mockNotifyOpenFailed(error),
}));
jest.mock('./utils', () => ({
  getInstanceId: async () => 'test-instance',
  getIntercomLanguageOverride: async () => 'en',
}));

function createToken(userId: string) {
  return `header.${Buffer.from(JSON.stringify({ user_id: userId })).toString(
    'base64url',
  )}.signature`;
}

async function flushEvents() {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

describe('desktop Intercom identity ownership', () => {
  let subject: typeof import('.');
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');

  beforeEach(async () => {
    jest.resetModules();
    jest.clearAllMocks();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {},
    });
    mockUnreadCallbacks.length = 0;
    mockUserId = 'A';
    mockApiGetCustomerJWT.mockReset();
    mockApiGetCustomerJWT.mockImplementation(async () => ({
      token: createToken(`intercom-${mockUserId ?? 'anonymous'}`),
    }));
    subject = await import('.');
  });

  afterEach(() => {
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('retries a boot cancelled by a transient account change', async () => {
    const response = deferred<{ token: string }>();
    mockApiGetCustomerJWT.mockReturnValueOnce(response.promise);
    const starting = subject.initIntercom();
    await flushEvents();
    mockUserId = 'B';
    response.resolve({ token: createToken('intercom-A') });
    await starting;
    expect(mockSdk.default).not.toHaveBeenCalled();
    mockUserId = 'A';
    await subject.initIntercom();
    expect(mockSdk.default).toHaveBeenCalledWith(
      expect.objectContaining({ intercom_user_jwt: createToken('intercom-A') }),
    );
  });

  it('keeps messages hidden until the UI allows them', async () => {
    await subject.initIntercom();
    expect(mockSdk.default).toHaveBeenCalledWith(
      expect.objectContaining({ hide_notifications: true }),
    );
    const command = jest.fn();
    globalThis.window.Intercom = command;
    await subject.setIntercomInAppMessageVisibility(true);
    expect(command).toHaveBeenLastCalledWith('hideNotifications', false);
    await subject.setIntercomInAppMessageVisibility(false);
    expect(command).toHaveBeenLastCalledWith('hideNotifications', true);
  });

  it('uses the latest visibility when a boot JWT arrives after locking', async () => {
    const response = deferred<{ token: string }>();
    mockApiGetCustomerJWT.mockReturnValueOnce(response.promise);
    await subject.setIntercomInAppMessageVisibility(true);
    const starting = subject.initIntercom();
    await flushEvents();
    await subject.setIntercomInAppMessageVisibility(false);
    response.resolve({ token: createToken('intercom-A') });
    await starting;
    expect(mockSdk.default).toHaveBeenCalledWith(
      expect.objectContaining({ hide_notifications: true }),
    );
  });

  it('clears A unread, boots B, and ignores late callbacks from A', async () => {
    const listener = jest.fn();
    const unsubscribe = subject.subscribeToIntercomUnreadCount(listener);
    await Promise.all([subject.initIntercom(), subject.initIntercom()]);
    expect(mockSdk.default).toHaveBeenCalledTimes(1);
    listener.mockClear();
    const onUnreadA = mockUnreadCallbacks[0];
    onUnreadA(4);
    await flushEvents();
    expect(subject.getIntercomUnreadCount()).toBe(4);
    expect(listener).toHaveBeenCalledTimes(1);

    onUnreadA(8);
    mockUserId = 'B';
    await subject.initIntercom();
    expect(subject.getIntercomUnreadCount()).toBe(0);
    expect(mockSdk.shutdown).toHaveBeenCalledTimes(1);
    expect(mockSdk.boot).toHaveBeenLastCalledWith(
      expect.objectContaining({ intercom_user_jwt: createToken('intercom-B') }),
    );
    const onUnreadB = mockUnreadCallbacks[1];
    onUnreadB(2);
    onUnreadA(8);
    await flushEvents();
    expect(subject.getIntercomUnreadCount()).toBe(2);
    unsubscribe();
  });

  it('clears identified session cookies on logout without touching other cookies', async () => {
    const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const oldLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
    const writes: string[] = [];
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        get cookie() {
          return 'intercom-id-test=old-id; intercom-session-test=old-session; other-cookie=value';
        },
        set cookie(value: string) {
          writes.push(value);
        },
      },
    });
    Object.defineProperty(globalThis, 'location', {
      configurable: true,
      value: { hostname: 'app.onekey.so' },
    });
    try {
      await subject.initIntercom();
      mockUserId = null;
      await subject.initIntercom();
      expect(mockSdk.shutdown).toHaveBeenCalledTimes(1);
      expect(mockSdk.boot.mock.calls[0][0]).not.toHaveProperty(
        'intercom_user_jwt',
      );
      expect(subject.getIntercomUnreadCount()).toBe(0);
      expect(writes).toContain('intercom-id-test=; max-age=0; path=/');
      expect(writes).toContain(
        'intercom-session-test=; max-age=0; path=/; domain=onekey.so',
      );
      expect(writes.every((value) => value.startsWith('intercom-'))).toBe(true);
    } finally {
      if (oldDocument) {
        Object.defineProperty(globalThis, 'document', oldDocument);
      } else {
        Reflect.deleteProperty(globalThis, 'document');
      }
      if (oldLocation) {
        Object.defineProperty(globalThis, 'location', oldLocation);
      } else {
        Reflect.deleteProperty(globalThis, 'location');
      }
    }
  });

  it('preserves anonymous activity when identifying the same visitor', async () => {
    mockUserId = null;
    await subject.initIntercom();
    mockUserId = 'A';
    await subject.initIntercom();
    expect(mockSdk.shutdown).not.toHaveBeenCalled();
    expect(mockSdk.boot).toHaveBeenLastCalledWith(
      expect.objectContaining({ intercom_user_jwt: createToken('intercom-A') }),
    );
  });

  it('does not boot A when their JWT arrives after the account changed to B', async () => {
    const response = deferred<{ token: string }>();
    mockApiGetCustomerJWT.mockReturnValueOnce(response.promise);
    const previousSession = subject.initIntercom();
    await flushEvents();
    mockUserId = 'B';
    const nextSession = subject.initIntercom();
    response.resolve({ token: createToken('intercom-A') });
    await Promise.all([previousSession, nextSession]);
    expect(mockSdk.default).toHaveBeenCalledTimes(1);
    expect(mockSdk.default).toHaveBeenCalledWith(
      expect.objectContaining({ intercom_user_jwt: createToken('intercom-B') }),
    );
  });

  it('clears A before a failed JWT request for B and allows retry', async () => {
    await subject.initIntercom();
    expect(globalThis.window.intercomSettings?.intercom_user_jwt).toBe(
      createToken('intercom-A'),
    );
    mockUserId = 'B';
    mockApiGetCustomerJWT.mockRejectedValueOnce(new Error('offline'));
    await subject.showIntercom();
    expect(mockNotifyOpenFailed).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'offline' }),
    );
    expect(mockSdk.shutdown).toHaveBeenCalledTimes(1);
    expect(subject.getIntercomUnreadCount()).toBe(0);
    expect(mockSdk.show).not.toHaveBeenCalled();
    expect(globalThis.window.intercomSettings).not.toHaveProperty(
      'intercom_user_jwt',
    );
    await subject.showIntercom();
    expect(mockSdk.show).toHaveBeenCalledTimes(1);
    expect(mockSdk.boot).toHaveBeenLastCalledWith(
      expect.objectContaining({ intercom_user_jwt: createToken('intercom-B') }),
    );
    expect(globalThis.window.intercomSettings?.intercom_user_jwt).toBe(
      createToken('intercom-B'),
    );
  });

  it('refreshes authentication before opening a conversation or the default messenger', async () => {
    await subject.showIntercom({ conversationId: 'conversation-123' });
    expect(mockSdk.update).toHaveBeenCalledWith(
      expect.objectContaining({ intercom_user_jwt: createToken('intercom-A') }),
    );
    expect(mockSdk.showConversation).toHaveBeenCalledWith('conversation-123');
    expect(mockSdk.show).not.toHaveBeenCalled();
    expect(mockSdk.update.mock.invocationCallOrder[0]).toBeLessThan(
      mockSdk.showConversation.mock.invocationCallOrder[0],
    );
    await subject.showIntercom();
    expect(mockSdk.show).toHaveBeenCalledTimes(1);
  });

  it('hides the Messenger on lock and keeps in-flight opens closed', async () => {
    await subject.setIntercomMessengerLocked(true);
    expect(mockSdk.hide).not.toHaveBeenCalled();
    await subject.setIntercomMessengerLocked(false);
    await subject.initIntercom();
    await subject.setIntercomMessengerLocked(true);
    expect(mockSdk.hide).toHaveBeenCalledTimes(1);

    await subject.setIntercomMessengerLocked(false);
    const token = deferred<{ token: string }>();
    mockApiGetCustomerJWT.mockReturnValueOnce(token.promise);
    const opening = subject.showIntercom();
    await flushEvents();
    await subject.setIntercomMessengerLocked(true);
    token.resolve({ token: createToken('intercom-A') });
    await opening;
    expect(mockSdk.show).not.toHaveBeenCalled();
  });
});
