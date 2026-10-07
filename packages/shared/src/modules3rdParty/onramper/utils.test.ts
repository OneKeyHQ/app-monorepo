import {
  annotateOnramperSdkErrorMessage,
  getErrorMessageForLog,
  getOnramperErrorFieldsForLog,
} from './utils';

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
  it('annotates SDK enum indexes before truncation', () => {
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
