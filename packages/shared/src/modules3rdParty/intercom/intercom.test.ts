import {
  getIntercomUnreadCount,
  initIntercom,
  showIntercom,
  subscribeToIntercomUnreadCount,
} from '.';

import * as intercomSdk from '@intercom/messenger-js-sdk';

import openUrlUtils from '../../utils/openUrlUtils';

import { showIntercom as showExtensionIntercom } from './index.ext';
import {
  getCustomerJWT,
  getInstanceId,
  getIntercomLanguageOverride,
} from './utils';
import { showIntercom as showNativeIntercom } from './webView.native';

const mockCustomerJWT = `header.${Buffer.from(
  JSON.stringify({ user_id: 'test-intercom-user' }),
).toString('base64url')}.signature`;
const mockApiGetCustomerJWT = jest.fn(async () => ({ token: mockCustomerJWT }));

jest.mock('../../appGlobals', () => ({
  __esModule: true,
  default: {
    $backgroundApiProxy: {
      servicePrime: {
        getLocalUserInfo: async () => ({
          isLoggedIn: true,
          onekeyUserId: 'test-onekey-user',
        }),
        apiGetCustomerJWT: () => mockApiGetCustomerJWT(),
      },
    },
  },
}));

jest.mock('@intercom/messenger-js-sdk', () => ({
  __esModule: true,
  default: jest.fn(),
  boot: jest.fn(),
  onShow: jest.fn(),
  trackEvent: jest.fn(),
  update: jest.fn(),
  show: jest.fn(),
  showConversation: jest.fn(),
  onUnreadCountChange: jest.fn(),
  shutdown: jest.fn(),
}));
jest.mock('./utils', () => ({
  ...jest.requireActual<typeof import('./utils')>('./utils'),
  getCustomerJWT: jest.fn(async () => 'test-jwt'),
  getInstanceId: jest.fn(async () => 'test-instance'),
  getIntercomLanguageOverride: jest.fn(async () => 'zh-CN'),
}));
jest.mock('../../utils/openUrlUtils', () => ({
  __esModule: true,
  default: { openUrlInApp: jest.fn() },
}));

async function flushEvents() {
  await new Promise<void>((resolve) => {
    setImmediate(resolve);
  });
}

describe('Intercom conversation entry points', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('boots with the current identity and shares live unread state with removable subscribers', async () => {
    await initIntercom();
    expect(intercomSdk.default).toHaveBeenCalledWith(
      expect.objectContaining({ intercom_user_jwt: mockCustomerJWT }),
    );
    const onUnreadCountChange = jest.mocked(intercomSdk.onUnreadCountChange)
      .mock.calls[0][0] as (count: number) => void;
    const listener = jest.fn();
    const unsubscribe = subscribeToIntercomUnreadCount(listener);

    expect(getIntercomUnreadCount()).toBe(0);
    onUnreadCountChange(3);
    await flushEvents();
    expect(getIntercomUnreadCount()).toBe(3);
    expect(listener).toHaveBeenCalledTimes(1);
    onUnreadCountChange(0);
    await flushEvents();
    expect(getIntercomUnreadCount()).toBe(0);
    expect(listener).toHaveBeenCalledTimes(2);

    unsubscribe();
    onUnreadCountChange(2);
    await flushEvents();
    expect(getIntercomUnreadCount()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(2);
    onUnreadCountChange(0);
    await flushEvents();
  });

  it('updates the authenticated identity before opening a conversation on desktop/web', async () => {
    await showIntercom({ conversationId: 'conversation-123' });

    expect(mockApiGetCustomerJWT).toHaveBeenCalledTimes(1);
    expect(intercomSdk.update).toHaveBeenCalledWith({
      intercom_user_jwt: mockCustomerJWT,
      language_override: 'zh-CN',
    });
    expect(intercomSdk.showConversation).toHaveBeenCalledWith(
      'conversation-123',
    );
    expect(intercomSdk.show).not.toHaveBeenCalled();
    expect(
      jest.mocked(intercomSdk.update).mock.invocationCallOrder[0],
    ).toBeLessThan(
      jest.mocked(intercomSdk.showConversation).mock.invocationCallOrder[0],
    );
  });

  it('keeps the normal support launcher behavior without a conversation id', async () => {
    await showIntercom({ requestId: 'test-request' });
    expect(intercomSdk.show).toHaveBeenCalledTimes(1);
    expect(intercomSdk.showConversation).not.toHaveBeenCalled();
    expect(mockApiGetCustomerJWT).toHaveBeenCalledTimes(1);
    expect(getCustomerJWT).not.toHaveBeenCalled();
  });

  it('passes conversation and app identity parameters into the native support page', async () => {
    await showNativeIntercom({
      conversationId: 'conversation-123',
      requestId: 'request&value',
    });
    const [url, title] = jest.mocked(openUrlUtils.openUrlInApp).mock.calls[0];
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://intercom.onekey.so');
    expect(parsed.searchParams.get('conversationId')).toBe('conversation-123');
    expect(parsed.searchParams.get('intercom_user_jwt')).toBe('test-jwt');
    expect(parsed.searchParams.get('instanceId')).toBe('test-instance');
    expect(parsed.searchParams.get('requestId')).toBe('request&value');
    expect(parsed.searchParams.get('language_override')).toBe('zh-CN');
    expect(title).toBe('Support');
  });

  it('passes conversation and identity parameters to the extension website entry', async () => {
    const originalWindow = globalThis.window;
    const open = jest.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { open },
    });
    try {
      await showExtensionIntercom({ conversationId: 'conversation-123' });
      const parsed = new URL(open.mock.calls[0][0] as string);
      expect(parsed.origin).toBe('https://onekey.so');
      expect(parsed.searchParams.has('openMessenger')).toBe(true);
      expect(parsed.searchParams.get('conversationId')).toBe(
        'conversation-123',
      );
      expect(parsed.searchParams.get('intercom_user_jwt')).toBe('test-jwt');
      expect(parsed.searchParams.get('instanceId')).toBe('test-instance');
      expect(getInstanceId).toHaveBeenCalled();
      expect(getIntercomLanguageOverride).not.toHaveBeenCalled();
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
