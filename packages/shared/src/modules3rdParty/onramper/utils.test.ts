import {
  annotateOnramperSdkErrorMessage,
  getErrorMessageForLog,
  getOnramperErrorFieldsForLog,
  sanitizeOnramperLogRecord,
} from './utils';

import type { IOnramperLogRecord } from './type';

describe('annotateOnramperSdkErrorMessage', () => {
  it('appends the BFFRecoveryError case name behind the NSError index', () => {
    const raw =
      'SDK initialization failed: The operation couldn’t be completed. (OnramperSDK.BFFRecoveryError error 1.)';
    expect(annotateOnramperSdkErrorMessage(raw)).toBe(
      'SDK initialization failed: The operation couldn’t be completed. (OnramperSDK.BFFRecoveryError error 1 = sdkSessionRejected.)',
    );
  });

  it('maps every pinned BFFRecoveryError index', () => {
    const cases = [
      'configurationError',
      'sdkSessionRejected',
      'userTokenRejected',
      'attestationRejected',
      'dpopProofRejected',
      'dpopNonceRequired',
      'deviceBlocked',
    ];
    cases.forEach((name, index) => {
      expect(
        annotateOnramperSdkErrorMessage(
          `(OnramperSDK.BFFRecoveryError error ${index}.)`,
        ),
      ).toBe(`(OnramperSDK.BFFRecoveryError error ${index} = ${name}.)`);
    });
  });

  it('leaves unknown enums and out-of-range indexes untouched', () => {
    const unknownEnum = '(OnramperSDK.SomeOtherError error 1.)';
    expect(annotateOnramperSdkErrorMessage(unknownEnum)).toBe(unknownEnum);
    const outOfRange = '(OnramperSDK.BFFRecoveryError error 99.)';
    expect(annotateOnramperSdkErrorMessage(outOfRange)).toBe(outOfRange);
  });

  it('leaves messages without an SDK enum untouched', () => {
    const plain = 'quoteUnavailable(debugInfo: "OnramperBackend-40003")';
    expect(annotateOnramperSdkErrorMessage(plain)).toBe(plain);
    expect(annotateOnramperSdkErrorMessage('')).toBe('');
  });
});

describe('getErrorMessageForLog', () => {
  it('annotates SDK enum indexes', () => {
    const raw =
      'SDK initialization failed: The operation couldn’t be completed. (OnramperSDK.BFFRecoveryError error 1.)';
    expect(getErrorMessageForLog({ message: raw })).toBe(
      'SDK initialization failed: The operation couldn’t be completed. (OnramperSDK.BFFRecoveryError error 1 = sdkSessionRejected.)',
    );
    expect(getErrorMessageForLog(new Error(raw))).toContain(
      'sdkSessionRejected',
    );
  });

  it('still truncates long messages', () => {
    const long = 'x'.repeat(400);
    expect(getErrorMessageForLog(long)).toBe(`${'x'.repeat(300)}…`);
  });

  it('keeps the case name when the marker ends exactly at the cap', () => {
    const marker = '(OnramperSDK.BFFRecoveryError error 1.)';
    const raw = `${'x'.repeat(300 - marker.length)}${marker}`;
    expect(raw).toHaveLength(300);
    expect(getErrorMessageForLog(raw)).toBe(
      `${'x'.repeat(300 - marker.length)}(OnramperSDK.BFFRecoveryError error 1 = sdkSessionRejected.)`,
    );
  });

  it('leaves a marker that the cap splits unannotated', () => {
    const marker = '(OnramperSDK.BFFRecoveryError error 1.)';
    const raw = `${'x'.repeat(301 - marker.length)}${marker}`;
    expect(getErrorMessageForLog(raw)).toBe(
      `${'x'.repeat(301 - marker.length)}${marker.slice(0, -1)}…`,
    );
  });

  it('returns undefined for empty input', () => {
    expect(getErrorMessageForLog(undefined)).toBeUndefined();
    expect(getErrorMessageForLog(null)).toBeUndefined();
    expect(getErrorMessageForLog({ message: '' })).toBeUndefined();
  });
});

describe('getOnramperErrorFieldsForLog', () => {
  it('carries the annotated message alongside code and info', () => {
    const fields = getOnramperErrorFieldsForLog({
      code: 'initializationFailed',
      message:
        'SDK initialization failed: The operation couldn’t be completed. (OnramperSDK.BFFRecoveryError error 1.)',
      info: { status: 401 },
    });
    expect(fields.errorCode).toBe('initializationFailed');
    expect(fields.errorMessage).toContain('error 1 = sdkSessionRejected');
    expect(fields.errorInfo).toBe('{"status":401}');
  });
});

describe('sanitizeOnramperLogRecord', () => {
  const record: IOnramperLogRecord = {
    timestamp: 1_700_000_000_000,
    level: 'info',
    category: 'checkout',
    event: 'providerEvent',
    message: 'Coinbase rejected card for jane@example.com',
    context: {
      transactionId: '01M4DBV8MVHV30CSPGERNYDBWN',
      statusCode: '402',
      durationMs: '1532',
      status: 'payment_failed',
      path: '/v2/{sessionApiKey}/client-sessions',
      host: 'api.onramper.com',
      email: 'jane@example.com',
      phone: '+1 415 555 0100',
      error: 'Card declined for Jane Doe',
      sessionId: 'sess_123',
    },
  };

  it('keeps only allow-listed keys whose values match their strict format and drops the message by default', () => {
    expect(sanitizeOnramperLogRecord(record, { keepMessage: false })).toEqual({
      level: 'info',
      category: 'checkout',
      event: 'providerEvent',
      context: {
        transactionId: '01M4DBV8MVHV30CSPGERNYDBWN',
        statusCode: '402',
        durationMs: '1532',
        status: 'payment_failed',
        path: '/v2/{sessionApiKey}/client-sessions',
        host: 'api.onramper.com',
      },
    });
  });

  it('keeps the message only when asked (dev builds)', () => {
    expect(
      sanitizeOnramperLogRecord(record, { keepMessage: true }).message,
    ).toBe(record.message);
  });

  it('drops allow-listed keys whose values are free-form or look like personal data', () => {
    const { context } = sanitizeOnramperLogRecord(
      {
        ...record,
        context: {
          // Free text in an identifier / token slot.
          transactionId: 'Jane Doe',
          status: 'declined: contact Jane Doe',
          // Card and phone numbers, with and without formatting.
          supportCode: '4242 4242 4242 4242',
          code: '4242424242424242',
          intentId: 'someone@example.com',
          // Non-numeric where a number is required, and an over-long route.
          statusCode: 'four-oh-two',
          path: `/v2/${'x'.repeat(200)}`,
          // Still fine.
          errorCode: 'providerFailed',
        },
      },
      { keepMessage: false },
    );
    expect(context).toEqual({ errorCode: 'providerFailed' });
  });

  it('omits an empty context', () => {
    expect(
      sanitizeOnramperLogRecord(
        { ...record, context: { email: 'a@b.c' } },
        { keepMessage: false },
      ).context,
    ).toBeUndefined();
  });
});
