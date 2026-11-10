import { defaultLogger } from '../logger/logger';

import {
  describeSupportPayload,
  normalizeSupportConversationId,
  summarizeSupportParams,
  traceSupportNotification,
} from './supportNotificationTrace';

jest.mock('../logger/logger', () => ({
  defaultLogger: {
    notification: {
      common: {
        supportNotificationTrace: jest.fn(),
      },
    },
  },
}));

const mockTraceLogger = defaultLogger.notification.common[
  'supportNotificationTrace'
] as unknown as jest.Mock;

describe('support notification trace', () => {
  beforeEach(() => {
    mockTraceLogger.mockClear();
  });

  it('normalizes string and numeric conversation ids', () => {
    expect(normalizeSupportConversationId(' 499 ')).toBe('499');
    expect(normalizeSupportConversationId(499)).toBe('499');
    expect(normalizeSupportConversationId('   ')).toBeUndefined();
    expect(normalizeSupportConversationId(Number.NaN)).toBeUndefined();
    expect(normalizeSupportConversationId({ id: 1 })).toBeUndefined();
    expect(normalizeSupportConversationId(null)).toBeUndefined();
  });

  it('reads the agreed command payload and keeps the conversation id', () => {
    const summary = describeSupportPayload(
      JSON.stringify({
        action: 'openSupportConversation',
        data: { conversationId: '2154123456789012' },
      }),
    );
    expect(summary.parseOk).toBe(true);
    expect(summary.action).toBe('openSupportConversation');
    expect(summary.conversationId).toBe('2154123456789012');
    expect(summary.conversationIdSource).toBe('data');
    expect(summary.dataKeys).toEqual(['conversationId']);
    expect(summary.payload).toEqual({
      action: 'openSupportConversation',
      data: { conversationId: '2154123456789012' },
    });
  });

  it('reads a numeric id and an id placed next to the action', () => {
    expect(
      describeSupportPayload(
        JSON.stringify({
          action: 'openSupportConversation',
          data: { conversationId: 123 },
        }),
      ),
    ).toMatchObject({
      parseOk: true,
      conversationId: '123',
      conversationIdType: 'number',
      conversationIdSource: 'data',
    });
    expect(
      describeSupportPayload(
        JSON.stringify({
          action: 'openSupportConversation',
          conversationId: '499',
        }),
      ),
    ).toMatchObject({
      hasData: false,
      conversationId: '499',
      conversationIdSource: 'payload',
    });
  });

  it('describes empty and malformed payloads without throwing', () => {
    const emptyPayload = describeSupportPayload(undefined);
    expect(emptyPayload.hasPayload).toBe(false);
    expect(emptyPayload.conversationId).toBeUndefined();

    const malformedPayload = describeSupportPayload('{oops');
    expect(malformedPayload).toMatchObject({
      hasPayload: true,
      parseOk: false,
    });
    expect(malformedPayload.conversationId).toBeUndefined();

    const actionOnlyPayload = describeSupportPayload(
      JSON.stringify({ action: 'openSupportConversation' }),
    );
    expect(actionOnlyPayload).toMatchObject({ parseOk: true, hasData: false });
    expect(actionOnlyPayload.conversationId).toBeUndefined();

    expect(describeSupportPayload('[1,2]')).toMatchObject({
      hasPayload: true,
      parseOk: false,
    });
  });

  it('redacts credentials defensively but keeps ids', () => {
    const summary = describeSupportPayload(
      JSON.stringify({
        action: 'openSupportConversation',
        data: {
          conversationId: '499',
          token: 'secret-jwt-value',
          intercom_user_jwt: 'secret-jwt-value',
        },
        email: 'user@example.com',
      }),
    );
    expect(summary.conversationId).toBe('499');
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('secret-jwt-value');
    expect(serialized).not.toContain('user@example.com');
    expect(serialized).toContain('499');
  });

  it('summarizes extras.params with redaction and keeps the conversation id', () => {
    const summary = summarizeSupportParams({
      msgId: 'msg-abcdef',
      conversationId: '2154123456789012',
      authorization: 'Bearer secret',
      accountId: 'hd-1',
    });
    expect(summary).toMatchObject({
      msgId: 'msg-abcdef',
      conversationId: '2154123456789012',
      accountId: 'hd-1',
      authorization: '[redacted]',
    });
    expect(JSON.stringify(summary)).not.toContain('Bearer secret');
    expect(summarizeSupportParams(undefined)).toBeUndefined();
  });

  it('writes through defaultLogger with the raw conversation id', () => {
    traceSupportNotification('payload-received', {
      hasConversationId: true,
      conversationId: '2154123456789012',
      action: 'openSupportConversation',
    });
    expect(mockTraceLogger).toHaveBeenCalledTimes(1);
    const [phase, detail] = mockTraceLogger.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(phase).toBe('payload-received');
    expect(detail).toMatchObject({
      hasConversationId: true,
      conversationId: '2154123456789012',
      action: 'openSupportConversation',
    });
    expect(detail.platform).toBeDefined();
    expect(detail.runtime).toBeDefined();
    expect(JSON.stringify(detail)).toContain('2154123456789012');
  });

  it('never throws when the logger is unavailable', () => {
    mockTraceLogger.mockImplementationOnce(() => {
      // eslint-disable-next-line onekey/no-raw-error
      throw new Error('logger unavailable');
    });
    expect(() => traceSupportNotification('payload-received')).not.toThrow();
  });
});
