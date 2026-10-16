import { ENotificationPushMessageMode } from '../../types/notification';

import { parseNotificationPayload } from './notificationsUtils';

const mockEmit = jest.fn<void, unknown[]>();
const mockLog = jest.fn<void, unknown[]>();

jest.mock('../appGlobals', () => ({ __esModule: true, default: {} }));
jest.mock('@react-navigation/native', () => ({}));
jest.mock('../locale', () => ({}));
jest.mock('../routes', () => ({}));
jest.mock('../routes/notifications', () => ({}));
jest.mock('../routes/root', () => ({}));
jest.mock('./extUtils', () => ({}));
jest.mock('./openUrlUtils', () => ({}));
jest.mock('./routeUtils', () => ({}));
jest.mock('../eventBus/appEventBus', () => ({
  EAppEventBusNames: { ShowNotificationInDappPage: 'show-dapp' },
  appEventBus: {
    emit: (...args: unknown[]) => mockEmit(...args),
    on: jest.fn(),
  },
}));
jest.mock('../logger/logger', () => ({
  defaultLogger: {
    app: { error: { log: (...args: unknown[]) => mockLog(...args) } },
  },
}));

describe('notification DApp URL rejection', () => {
  beforeEach(() => jest.clearAllMocks());

  test.each([
    'http://example.com/private-path?token=private-value',
    'https://localhost/private-path?token=private-value',
    'https://user:private-value@example.com/private-path',
  ])('rejects %s without including the payload in diagnostics', (url) => {
    const fallback = jest.fn();
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.openInDapp,
        url,
        fallback,
      ),
    ).toBe(false);
    expect(mockLog).toHaveBeenCalledWith(
      'parseNotificationPayload: blocked unsafe url in openInDapp',
    );
    expect(mockLog).toHaveBeenCalledTimes(1);
    expect(mockEmit).not.toHaveBeenCalled();
    expect(fallback).not.toHaveBeenCalled();
  });

  test('continues opening an allowed DApp URL', () => {
    const url = 'https://example.com/dapp';
    expect(
      parseNotificationPayload(
        ENotificationPushMessageMode.openInDapp,
        url,
        jest.fn(),
      ),
    ).toBe(true);
    expect(mockEmit).toHaveBeenCalledWith('show-dapp', url);
    expect(mockLog).not.toHaveBeenCalled();
  });
});
