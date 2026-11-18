import {
  getOnramperInitRetryDelayMs,
  getOnramperQuoteRetryDelayMs,
} from './retryPolicy';

// What the SDK reports when the partner session was minted under a key other
// than the one the build carries (1.3.x wording, then the 1.2.x NSError text).
const SESSION_REJECTED = {
  code: 'initializationFailed',
  message: 'SDK initialization failed: BFFRecoveryError.sdkSessionRejected',
};
const SESSION_REJECTED_LEGACY = {
  code: 'initializationFailed',
  message:
    'SDK initialization failed: The operation couldn’t be completed. (OnramperSDK.BFFRecoveryError error 1.)',
};
const MINT_NETWORK_ERROR = {
  code: 'sessionMintFailed',
  message: 'Network error',
};

describe('getOnramperInitRetryDelayMs', () => {
  it('backs off twice, then gives up', () => {
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 1,
        elapsedMs: 2000,
        error: MINT_NETWORK_ERROR,
      }),
    ).toBe(1000);
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 2,
        elapsedMs: 5000,
        error: MINT_NETWORK_ERROR,
      }),
    ).toBe(2000);
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 3,
        elapsedMs: 9000,
        error: MINT_NETWORK_ERROR,
      }),
    ).toBeUndefined();
  });

  it('stops retrying once the wait has run long, whatever the attempt', () => {
    // Device-observed session mint timeouts: 10.0 s and 15.8 s.
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 1,
        elapsedMs: 10_019,
        error: MINT_NETWORK_ERROR,
      }),
    ).toBe(1000);
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 1,
        elapsedMs: 15_773,
        error: MINT_NETWORK_ERROR,
      }),
    ).toBeUndefined();
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 2,
        elapsedMs: 11_000,
        error: MINT_NETWORK_ERROR,
      }),
    ).toBeUndefined();
  });

  it('retries an initialize failure that names no lasting cause', () => {
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 1,
        elapsedMs: 3000,
        error: { code: 'initializationFailed' },
      }),
    ).toBe(1000);
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 1,
        elapsedMs: 3000,
        error: {
          code: 'initializationFailed',
          message:
            'SDK initialization failed: BFFRecoveryError.dpopNonceRequired',
        },
      }),
    ).toBe(1000);
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 1,
        elapsedMs: 3000,
        error: { code: 'networkError', message: 'offline' },
      }),
    ).toBe(1000);
  });

  it('never retries a session the backend rejects for this build', () => {
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 1,
        elapsedMs: 2000,
        error: SESSION_REJECTED,
      }),
    ).toBeUndefined();
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 1,
        elapsedMs: 2000,
        error: SESSION_REJECTED_LEGACY,
      }),
    ).toBeUndefined();
  });

  it('never retries a structural failure', () => {
    for (const code of [
      'deviceBlocked',
      'configurationError',
      'attestationFailed',
      'platformUnsupported',
      'checkoutForbidden',
    ]) {
      expect(
        getOnramperInitRetryDelayMs({
          attempt: 1,
          elapsedMs: 1000,
          error: { code },
        }),
      ).toBeUndefined();
    }
    expect(
      getOnramperInitRetryDelayMs({
        attempt: 1,
        elapsedMs: 1000,
        error: {
          code: 'initializationFailed',
          message: 'SDK initialization failed: BFFRecoveryError.deviceBlocked',
        },
      }),
    ).toBeUndefined();
  });
});

describe('getOnramperQuoteRetryDelayMs', () => {
  it('retries a transient quote failure once', () => {
    for (const code of ['temporaryFailure', 'networkError', 'timeout']) {
      expect(
        getOnramperQuoteRetryDelayMs({ attempt: 1, error: { code } }),
      ).toBe(1000);
      expect(
        getOnramperQuoteRetryDelayMs({ attempt: 2, error: { code } }),
      ).toBeUndefined();
    }
  });

  // Device logs 2026-10-30: all 9 quote failures were `quoteUnavailable`, and
  // within a session every amount tried next failed the same way (it followed
  // the tester's region), so a retry only delays the actionable copy.
  it('leaves an answer about the request itself to the user', () => {
    for (const code of [
      'quoteUnavailable',
      'amountOutOfRange',
      'invalidRequest',
      'unrecoverable',
      'intentInvalidated',
    ]) {
      expect(
        getOnramperQuoteRetryDelayMs({ attempt: 1, error: { code } }),
      ).toBeUndefined();
    }
    expect(
      getOnramperQuoteRetryDelayMs({ attempt: 1, error: undefined }),
    ).toBeUndefined();
  });

  it('never retries a structural failure', () => {
    expect(
      getOnramperQuoteRetryDelayMs({
        attempt: 1,
        error: { code: 'checkoutForbidden' },
      }),
    ).toBeUndefined();
  });
});
