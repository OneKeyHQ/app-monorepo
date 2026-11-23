import { OneKeyLocalError } from '../../errors';

import { logMarketWidgetEvent } from './diagnostics';

const mockEvent = jest.fn<void, [string, Record<string, unknown>]>();
jest.mock('../../logger/logger', () => ({
  defaultLogger: {
    app: {
      marketWidget: {
        event: (event: string, details: Record<string, unknown>) =>
          mockEvent(event, details),
      },
    },
  },
}));
jest.mock('../../platformEnv', () => ({
  __esModule: true,
  default: { appPlatform: 'android', isNativeBackgroundThread: false },
}));

describe('widget local diagnostics privacy', () => {
  beforeEach(() => mockEvent.mockReset());

  it('correlates a session without exposing its token or exception payload', () => {
    const session = '94c52b8e-fb85-440e-9f7f-a45af4128765';
    const error = Object.assign(
      new Error('secret payload and https://private.example'),
      {
        code: 'MARKET_WIDGET_EDITOR_FAILED',
        userInfo: { session },
      },
    );
    logMarketWidgetEvent('editor.read_failed', { request: 1 }, session, error);
    logMarketWidgetEvent('editor.retry', {}, session);
    const serialized = JSON.stringify(mockEvent.mock.calls);
    expect(serialized).not.toContain(session);
    expect(serialized).not.toContain('secret payload');
    expect(serialized).not.toContain('private.example');
    expect(mockEvent.mock.calls[0][1]).toMatchObject({
      errorCode: 'MARKET_WIDGET_EDITOR_FAILED',
      runtime: 'main',
      sessionRef: expect.stringMatching(/^[a-f0-9]{16}$/),
    });
    expect(mockEvent.mock.calls[0][1].sessionRef).toBe(
      mockEvent.mock.calls[1][1].sessionRef,
    );
  });

  it('does not interrupt editing when logging is unavailable during teardown', () => {
    mockEvent.mockImplementation(() => {
      throw new OneKeyLocalError('logger unavailable');
    });
    expect(() => logMarketWidgetEvent('editor.close')).not.toThrow();
  });
});
