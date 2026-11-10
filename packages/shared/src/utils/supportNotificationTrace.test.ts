import { defaultLogger } from '../logger/logger';

import {
  describeSupportPayload,
  normalizeSupportConversationId,
  pickSupportParams,
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

  it('normalizes string and safe-integer conversation ids', () => {
    expect(normalizeSupportConversationId(' 499 ')).toBe('499');
    expect(normalizeSupportConversationId(499)).toBe('499');
    expect(normalizeSupportConversationId('   ')).toBeUndefined();
    expect(normalizeSupportConversationId(Number.NaN)).toBeUndefined();
    expect(
      normalizeSupportConversationId(Number.MAX_SAFE_INTEGER + 2),
    ).toBeUndefined();
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
    expect(summary).toMatchObject({
      hasPayload: true,
      parseOk: true,
      action: 'openSupportConversation',
      conversationId: '2154123456789012',
      payloadConversationIdSource: 'data',
      dataKeys: ['conversationId'],
      conversationIdType: 'string',
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
      payloadConversationIdSource: 'data',
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
      payloadConversationIdSource: 'payload',
    });
  });

  it('rejects ids that already lost numeric precision', () => {
    const summary = describeSupportPayload(
      JSON.stringify({
        action: 'openSupportConversation',
        data: { conversationId: Number.MAX_SAFE_INTEGER + 2 },
      }),
    );
    expect(summary.conversationId).toBeUndefined();
    expect(summary.conversationIdType).toBe('other');
  });

  it('never returns payload or extras values, only shape fields', () => {
    const summary = describeSupportPayload(
      JSON.stringify({
        action: 'openSupportConversation',
        data: {
          conversationId: '499',
          phone: '+86 138 0000 0000',
          address: '0x1234567890abcdef',
          email: 'user@example.com',
          token: 'secret-jwt-value',
        },
      }),
    );
    expect(summary.conversationId).toBe('499');
    const serialized = JSON.stringify(summary);
    expect(serialized).not.toContain('138 0000 0000');
    expect(serialized).not.toContain('0x1234567890abcdef');
    expect(serialized).not.toContain('user@example.com');
    expect(serialized).not.toContain('secret-jwt-value');
    // Key names are allowed: they are structural diagnostics, not values.
    expect(summary.dataKeys).toEqual([
      'conversationId',
      'phone',
      'address',
      'email',
      'token',
    ]);
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

  it('keeps only routing ids from extras.params', () => {
    expect(
      pickSupportParams({
        conversationId: '2154123456789012',
        msgId: 'msg-abcdef',
        phone: '+86 138 0000 0000',
        address: '0x1234567890abcdef',
        accountId: 'hd-1',
        authorization: 'Bearer secret',
      }),
    ).toEqual({
      paramsConversationId: '2154123456789012',
      msgId: 'msg-abcdef',
    });
    expect(
      pickSupportParams({ conversationId: 499, msgId: 'msg-abcdef' }),
    ).toEqual({ paramsConversationId: '499', msgId: 'msg-abcdef' });
    expect(pickSupportParams(undefined)).toEqual({});
    expect(pickSupportParams({})).toEqual({});
  });

  it('writes a flat allowlisted detail through defaultLogger', () => {
    traceSupportNotification('payload-received', {
      ...describeSupportPayload(
        JSON.stringify({
          action: 'openSupportConversation',
          data: { conversationId: '2154123456789012' },
        }),
      ),
      ...pickSupportParams({
        conversationId: '2154123456789012',
        msgId: 'msg-abcdef',
      }),
      conversationIdSource: 'data',
      conversationId: '2154123456789012',
      hasConversationId: true,
    });
    expect(mockTraceLogger).toHaveBeenCalledTimes(1);
    const [phase, detail] = mockTraceLogger.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(phase).toBe('payload-received');
    expect(detail).toMatchObject({
      action: 'openSupportConversation',
      conversationId: '2154123456789012',
      conversationIdSource: 'data',
      hasConversationId: true,
      platform: expect.any(String),
      runtime: expect.any(String),
    });
    Object.values(detail).forEach((value) => {
      expect(['string', 'number', 'boolean', 'undefined', 'object']).toContain(
        typeof value,
      );
      if (typeof value === 'object' && value !== null) {
        expect(Array.isArray(value)).toBe(true);
        const items = value as unknown[];
        items.forEach((item) => expect(typeof item).toBe('string'));
      }
    });
    expect(JSON.stringify(detail)).toContain('2154123456789012');
    // msgId is explicitly allowlisted for server-side correlation.
    expect(JSON.stringify(detail)).toContain('msg-abcdef');
  });

  it('never throws when the logger is unavailable', () => {
    mockTraceLogger.mockImplementationOnce(() => {
      // eslint-disable-next-line onekey/no-raw-error
      throw new Error('logger unavailable');
    });
    expect(() => traceSupportNotification('payload-received')).not.toThrow();
  });
});
