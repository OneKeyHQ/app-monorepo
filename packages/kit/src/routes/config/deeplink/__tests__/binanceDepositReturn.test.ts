import * as Linking from 'expo-linking';

import {
  BINANCE_DEPOSIT_RETURN_HANDLE_TIMEOUT_MS,
  BINANCE_DEPOSIT_RETURN_REASON,
  BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS,
} from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import type { IBinanceDepositReturnReason } from '@onekeyhq/shared/src/consts/binanceDepositConsts';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  IBinanceDepositReturnParams,
  IBinanceDepositReturnResult,
  IBinanceDepositReturnSource,
} from '@onekeyhq/shared/types/exchange';

import {
  handleBinanceDepositReturnFromOS,
  recoverBinanceDepositReturnOnForeground,
} from '../binanceDepositReturn';

jest.mock('expo-linking', () => ({
  getLinkingURL: jest.fn(() => null),
  clearInitialURL: jest.fn(),
}));

jest.mock('../../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceBinanceDeposit: {
      handleDepositReturn: jest.fn(),
      recordReturnDiscardedByMain: jest.fn(),
    },
  },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    fiatCrypto: {
      binanceDeposit: {
        returnDiscarded: jest.fn(),
      },
    },
  },
}));

type IRecordDiscardParams = {
  reason: string;
  otherParamNames: string[];
  source: IBinanceDepositReturnSource;
};
const mockedService = (
  jest.requireMock('../../../../background/instance/backgroundApiProxy') as {
    default: {
      serviceBinanceDeposit: {
        handleDepositReturn: jest.Mock<
          Promise<IBinanceDepositReturnResult>,
          [IBinanceDepositReturnParams]
        >;
        recordReturnDiscardedByMain: jest.Mock<
          Promise<void>,
          [IRecordDiscardParams]
        >;
      };
    };
  }
).default.serviceBinanceDeposit;
const mockedHandleDepositReturn = mockedService.handleDepositReturn;
const mockedRecordDiscardedByMain = mockedService.recordReturnDiscardedByMain;
const mockedReturnDiscarded = (
  jest.requireMock('@onekeyhq/shared/src/logger/logger') as {
    defaultLogger: {
      fiatCrypto: {
        binanceDeposit: {
          returnDiscarded: jest.Mock<
            void,
            [
              {
                source: IBinanceDepositReturnSource;
                reason: string;
                otherParamNames?: readonly string[];
              },
            ]
          >;
        };
      };
    };
  }
).defaultLogger.fiatCrypto.binanceDeposit.returnDiscarded;
const mockedGetLinkingURL = Linking.getLinkingURL as jest.MockedFunction<
  typeof Linking.getLinkingURL
>;
const mockedClearInitialURL = Linking.clearInitialURL as jest.MockedFunction<
  typeof Linking.clearInitialURL
>;

// The module keeps a short-lived record of the returns it has seen, so every
// test works on its own nonce.
let nonceCounter = 0;
function createNonce() {
  nonceCounter += 1;
  return `${String(nonceCounter).padStart(6, '0')}${'aB3-_'.repeat(8)}`.slice(
    0,
    43,
  );
}
function createReturnUrl(nonce: string, extraQuery = '') {
  return `onekey-wallet://binance-connect/deposit-return?rn=${nonce}${extraQuery}`;
}
// A return this runtime drops by itself: its `rn` is too short.
function createMalformedReturnUrl(extraQuery = '') {
  return createReturnUrl(createNonce().slice(0, 30), extraQuery);
}

describe('handleBinanceDepositReturnFromOS', () => {
  let consoleSpies: jest.SpyInstance[] = [];

  function expectNothingPrinted() {
    consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockedHandleDepositReturn.mockResolvedValue({ accepted: true });
    mockedRecordDiscardedByMain.mockResolvedValue(undefined);
    mockedGetLinkingURL.mockReturnValue(null);
    consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (method) => jest.spyOn(console, method).mockImplementation(() => {}),
    );
  });

  afterEach(() => {
    consoleSpies.forEach((spy) => spy.mockRestore());
    jest.useRealTimers();
  });

  it('hands the raw nonce to the background service', async () => {
    const nonce = createNonce();

    await handleBinanceDepositReturnFromOS(createReturnUrl(nonce), 'os_event');

    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(1);
    expect(mockedHandleDepositReturn).toHaveBeenCalledWith({
      returnNonce: nonce,
      otherParamNames: [],
      source: 'os_event',
    });
    expect(mockedReturnDiscarded).not.toHaveBeenCalled();
    // bg records a return it was handed itself.
    expect(mockedRecordDiscardedByMain).not.toHaveBeenCalled();
    expectNothingPrinted();
  });

  it('accepts the trailing-slash and mixed-case spellings', async () => {
    const nonce = createNonce();

    await handleBinanceDepositReturnFromOS(
      `ONEKEY-WALLET://Binance-Connect/deposit-return/?rn=${nonce}`,
      'os_initial',
    );

    expect(mockedHandleDepositReturn).toHaveBeenCalledWith({
      returnNonce: nonce,
      otherParamNames: [],
      source: 'os_initial',
    });
  });

  it('forwards the names of extra parameters but never their values', async () => {
    const nonce = createNonce();

    await handleBinanceDepositReturnFromOS(
      createReturnUrl(nonce, '&state=extra-value-1&utm_source=extra-value-2'),
      'os_event',
    );

    expect(mockedHandleDepositReturn).toHaveBeenCalledWith({
      returnNonce: nonce,
      otherParamNames: ['state', 'utm_source'],
      source: 'os_event',
    });
    expect(JSON.stringify(mockedHandleDepositReturn.mock.calls)).not.toContain(
      'extra-value',
    );
  });

  it.each([
    {
      name: 'a missing rn',
      buildUrl: () => 'onekey-wallet://binance-connect/deposit-return?foo=1',
      reason: 'missing_rn',
      otherParamNames: ['foo'],
    },
    {
      name: 'an empty rn',
      buildUrl: () => 'onekey-wallet://binance-connect/deposit-return?rn=',
      reason: 'malformed_rn',
      otherParamNames: undefined,
    },
    {
      name: 'a short rn',
      buildUrl: (nonce: string) => createReturnUrl(nonce.slice(0, 42)),
      reason: 'malformed_rn',
      otherParamNames: undefined,
    },
    {
      name: 'a percent-encoded rn',
      buildUrl: (nonce: string) =>
        createReturnUrl(`${nonce.slice(0, 40)}%2D`, '&foo=1'),
      reason: 'malformed_rn',
      otherParamNames: ['foo'],
    },
    {
      name: 'a duplicated rn',
      buildUrl: (nonce: string) => createReturnUrl(nonce, `&rn=${nonce}`),
      reason: 'duplicate_rn',
      otherParamNames: undefined,
    },
    {
      name: 'a nonce outside the query',
      buildUrl: (nonce: string) =>
        `onekey-wallet://binance-connect/deposit-return#rn=${nonce}`,
      reason: 'missing_rn',
      otherParamNames: undefined,
    },
    {
      name: 'an altered path',
      buildUrl: (nonce: string) =>
        `onekey-wallet://binance-connect/Deposit-Return?rn=${nonce}`,
      reason: 'not_return_url',
      otherParamNames: undefined,
    },
  ])(
    'discards a return with $name without handing anything to the bind',
    async ({ buildUrl, reason, otherParamNames }) => {
      const nonce = createNonce();
      const url = buildUrl(nonce);

      await handleBinanceDepositReturnFromOS(url, 'os_event');

      expect(mockedHandleDepositReturn).not.toHaveBeenCalled();
      expect(mockedReturnDiscarded).toHaveBeenCalledTimes(1);
      expect(mockedReturnDiscarded).toHaveBeenCalledWith({
        source: 'os_event',
        reason,
        otherParamNames,
      });
      const logged = JSON.stringify(mockedReturnDiscarded.mock.calls);
      expect(logged).not.toContain(nonce.slice(0, 40));
      expect(logged).not.toContain('://');

      // The same discard is mirrored into the service's debug events, with
      // the reason, the parameter names and the source and nothing else.
      expect(mockedRecordDiscardedByMain).toHaveBeenCalledTimes(1);
      expect(mockedRecordDiscardedByMain).toHaveBeenCalledWith({
        source: 'os_event',
        reason,
        otherParamNames: otherParamNames ?? [],
      });
      const reported = JSON.stringify(mockedRecordDiscardedByMain.mock.calls);
      expect(reported).not.toContain(nonce.slice(0, 40));
      expect(reported).not.toContain('://');
      expectNothingPrinted();
    },
  );

  it('settles a malformed return even when the background report fails', async () => {
    const url = createMalformedReturnUrl('&foo=1');
    mockedRecordDiscardedByMain.mockRejectedValue(
      new Error(`could not record ${url}`),
    );

    await expect(
      handleBinanceDepositReturnFromOS(url, 'os_event'),
    ).resolves.toBeUndefined();
    await handleBinanceDepositReturnFromOS(url, 'os_event');

    // Settled: the repeat is ignored, and the failure left no trace.
    expect(mockedRecordDiscardedByMain).toHaveBeenCalledTimes(1);
    expect(mockedReturnDiscarded).toHaveBeenCalledTimes(1);
    expect(mockedReturnDiscarded).toHaveBeenCalledWith({
      source: 'os_event',
      reason: 'malformed_rn',
      otherParamNames: ['foo'],
    });
    expectNothingPrinted();
  });

  it('settles a malformed return when the background report throws synchronously', async () => {
    mockedRecordDiscardedByMain.mockImplementation(() => {
      throw new OneKeyLocalError('proxy is not ready');
    });

    await expect(
      handleBinanceDepositReturnFromOS(
        createMalformedReturnUrl(),
        'os_initial',
      ),
    ).resolves.toBeUndefined();

    expect(mockedReturnDiscarded).toHaveBeenCalledTimes(1);
    expect(mockedRecordDiscardedByMain).toHaveBeenCalledTimes(1);
    expect(mockedHandleDepositReturn).not.toHaveBeenCalled();
    expectNothingPrinted();
  });

  it('stops waiting for the background report after the timeout', async () => {
    jest.useFakeTimers();
    mockedRecordDiscardedByMain.mockReturnValue(new Promise(() => {}));
    let finished = false;

    const pending = handleBinanceDepositReturnFromOS(
      createMalformedReturnUrl(),
      'os_event',
    ).then(() => {
      finished = true;
    });
    // The local log line is written before the wait starts.
    expect(mockedReturnDiscarded).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(
      BINANCE_DEPOSIT_RETURN_HANDLE_TIMEOUT_MS - 1,
    );
    expect(finished).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await pending;

    expect(finished).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not report a discard decided by the background service', async () => {
    mockedHandleDepositReturn.mockResolvedValue({
      accepted: false,
      reason: BINANCE_DEPOSIT_RETURN_REASON.NoWaitingSession,
    });

    await handleBinanceDepositReturnFromOS(
      createReturnUrl(createNonce()),
      'os_event',
    );

    expect(mockedRecordDiscardedByMain).not.toHaveBeenCalled();
  });

  it('handles one event delivered to several listeners only once', async () => {
    const nonce = createNonce();
    const url = createReturnUrl(nonce);

    await Promise.all([
      handleBinanceDepositReturnFromOS(url, 'os_event'),
      handleBinanceDepositReturnFromOS(url, 'os_event'),
      handleBinanceDepositReturnFromOS(url, 'os_initial'),
    ]);

    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(1);
  });

  it('logs a malformed return delivered to several listeners only once', async () => {
    const url = createReturnUrl(createNonce().slice(0, 30));

    await Promise.all([
      handleBinanceDepositReturnFromOS(url, 'os_event'),
      handleBinanceDepositReturnFromOS(url, 'os_event'),
    ]);

    expect(mockedReturnDiscarded).toHaveBeenCalledTimes(1);
  });

  it('does not let one return shadow a different one', async () => {
    await Promise.all([
      handleBinanceDepositReturnFromOS(
        createReturnUrl(createNonce()),
        'os_event',
      ),
      handleBinanceDepositReturnFromOS(
        createReturnUrl(createNonce()),
        'os_event',
      ),
    ]);

    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(2);
  });

  it('ignores a replay of a settled return for a short while only', async () => {
    jest.useFakeTimers();
    const url = createReturnUrl(createNonce());

    await handleBinanceDepositReturnFromOS(url, 'os_initial');
    jest.advanceTimersByTime(1000);
    await handleBinanceDepositReturnFromOS(url, 'os_initial');
    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(1);

    // Later replays reach bg again, which deduplicates by nonce itself.
    jest.advanceTimersByTime(60_000);
    await handleBinanceDepositReturnFromOS(url, 'os_initial');
    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(2);
  });

  it.each<IBinanceDepositReturnReason>([
    BINANCE_DEPOSIT_RETURN_REASON.NoWaitingSession,
    BINANCE_DEPOSIT_RETURN_REASON.NonceAlreadyRejected,
    BINANCE_DEPOSIT_RETURN_REASON.MalformedNonce,
  ])('treats a return discarded as %s as settled', async (reason) => {
    mockedHandleDepositReturn.mockResolvedValue({ accepted: false, reason });
    const url = createReturnUrl(createNonce());

    await handleBinanceDepositReturnFromOS(url, 'os_event');
    await handleBinanceDepositReturnFromOS(url, 'os_event');

    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(1);
    // bg has already logged the discard.
    expect(mockedReturnDiscarded).not.toHaveBeenCalled();
  });

  it.each<IBinanceDepositReturnReason>([
    BINANCE_DEPOSIT_RETURN_REASON.QueueFull,
    BINANCE_DEPOSIT_RETURN_REASON.LocalError,
    BINANCE_DEPOSIT_RETURN_REASON.EndpointMismatch,
  ])(
    'lets a return discarded as %s be delivered again right away',
    async (reason) => {
      mockedHandleDepositReturn.mockResolvedValue({ accepted: false, reason });
      const url = createReturnUrl(createNonce());

      await handleBinanceDepositReturnFromOS(url, 'os_event');
      await handleBinanceDepositReturnFromOS(url, 'foreground_fallback');

      expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(2);
      // bg has already logged the discard.
      expect(mockedReturnDiscarded).not.toHaveBeenCalled();
      expect(mockedRecordDiscardedByMain).not.toHaveBeenCalled();
    },
  );

  // The handler branches on the shared set, so the three reasons above are
  // exactly the ones the service may answer with to ask for another try.
  it('takes the retryable reasons from the shared constants', () => {
    expect([...BINANCE_DEPOSIT_RETURN_RETRYABLE_REASONS].toSorted()).toEqual(
      [
        BINANCE_DEPOSIT_RETURN_REASON.EndpointMismatch,
        BINANCE_DEPOSIT_RETURN_REASON.LocalError,
        BINANCE_DEPOSIT_RETURN_REASON.QueueFull,
      ].toSorted(),
    );
  });

  it('does not put a return refused for the server environment into the repeat window', async () => {
    jest.useFakeTimers();
    mockedHandleDepositReturn.mockResolvedValue({
      accepted: false,
      reason: BINANCE_DEPOSIT_RETURN_REASON.EndpointMismatch,
    });
    const nonce = createNonce();
    const url = createReturnUrl(nonce);

    // Every delivery reaches the service, however close together.
    await handleBinanceDepositReturnFromOS(url, 'os_initial');
    await handleBinanceDepositReturnFromOS(url, 'os_initial');
    jest.advanceTimersByTime(1000);
    await handleBinanceDepositReturnFromOS(url, 'os_event');
    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(3);

    // Delivered again once the app is back on the session's environment, the
    // same URL is taken in, and only then counts as settled. Only iOS still
    // has it to deliver by then: on Android the switch restarts the process,
    // and the URL the system handed over is gone with it.
    mockedHandleDepositReturn.mockResolvedValue({ accepted: true });
    await handleBinanceDepositReturnFromOS(url, 'foreground_fallback');
    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(4);
    expect(mockedHandleDepositReturn).toHaveBeenLastCalledWith({
      returnNonce: nonce,
      otherParamNames: [],
      source: 'foreground_fallback',
    });
    await handleBinanceDepositReturnFromOS(url, 'foreground_fallback');
    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(4);
  });

  it('swallows a background failure without logging the error', async () => {
    const nonce = createNonce();
    const url = createReturnUrl(nonce, '&foo=1');
    mockedHandleDepositReturn.mockRejectedValueOnce(
      new Error(`bind failed for ${nonce} via ${url}`),
    );

    await expect(
      handleBinanceDepositReturnFromOS(url, 'os_event'),
    ).resolves.toBeUndefined();

    expect(mockedReturnDiscarded).toHaveBeenCalledTimes(1);
    expect(mockedReturnDiscarded).toHaveBeenCalledWith({
      source: 'os_event',
      reason: 'bg_call_failed',
      otherParamNames: ['foo'],
    });
    expect(JSON.stringify(mockedReturnDiscarded.mock.calls)).not.toContain(
      nonce,
    );
    expectNothingPrinted();

    // Nothing was settled, so the same URL may be tried again at once.
    await handleBinanceDepositReturnFromOS(url, 'foreground_fallback');
    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(2);
  });

  it('swallows a synchronous throw of the background proxy', async () => {
    mockedHandleDepositReturn.mockImplementationOnce(() => {
      throw new OneKeyLocalError('proxy is not ready');
    });

    await expect(
      handleBinanceDepositReturnFromOS(
        createReturnUrl(createNonce()),
        'os_event',
      ),
    ).resolves.toBeUndefined();

    expect(mockedReturnDiscarded).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'bg_call_failed' }),
    );
  });

  it('stops waiting for the background service after the timeout', async () => {
    jest.useFakeTimers();
    mockedHandleDepositReturn.mockReturnValueOnce(new Promise(() => {}));
    const url = createReturnUrl(createNonce());
    let finished = false;

    const pending = handleBinanceDepositReturnFromOS(url, 'os_initial').then(
      () => {
        finished = true;
      },
    );
    await jest.advanceTimersByTimeAsync(
      BINANCE_DEPOSIT_RETURN_HANDLE_TIMEOUT_MS - 1,
    );
    expect(finished).toBe(false);

    await jest.advanceTimersByTimeAsync(1);
    await pending;

    expect(finished).toBe(true);
    expect(mockedReturnDiscarded).toHaveBeenCalledWith({
      source: 'os_initial',
      reason: 'bg_call_timeout',
      otherParamNames: undefined,
    });

    await handleBinanceDepositReturnFromOS(url, 'foreground_fallback');
    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(2);
  });

  it('leaves no timer behind once the background service answered', async () => {
    jest.useFakeTimers();

    await handleBinanceDepositReturnFromOS(
      createReturnUrl(createNonce()),
      'os_event',
    );

    expect(jest.getTimerCount()).toBe(0);
  });

  it('never rejects, even when logging itself fails', async () => {
    mockedReturnDiscarded.mockImplementationOnce(() => {
      throw new OneKeyLocalError('logger is broken');
    });

    await expect(
      handleBinanceDepositReturnFromOS(
        'onekey-wallet://binance-connect/deposit-return',
        'os_event',
      ),
    ).resolves.toBeUndefined();
    expect(mockedHandleDepositReturn).not.toHaveBeenCalled();
  });

  describe('expo-linking cached url', () => {
    beforeEach(() => {
      jest.replaceProperty(platformEnv, 'isNative', true);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('drops a settled return from the native cache', async () => {
      const url = createReturnUrl(createNonce());
      mockedGetLinkingURL.mockReturnValue(url);

      await handleBinanceDepositReturnFromOS(url, 'os_event');

      expect(mockedClearInitialURL).toHaveBeenCalledTimes(1);
    });

    it('drops a malformed return from the native cache', async () => {
      const url = createReturnUrl(createNonce().slice(0, 20));
      mockedGetLinkingURL.mockReturnValue(url);

      await handleBinanceDepositReturnFromOS(url, 'os_event');

      expect(mockedClearInitialURL).toHaveBeenCalledTimes(1);
    });

    it('keeps a newer url that replaced the settled one', async () => {
      mockedGetLinkingURL.mockReturnValue(createReturnUrl(createNonce()));

      await handleBinanceDepositReturnFromOS(
        createReturnUrl(createNonce()),
        'os_event',
      );

      expect(mockedClearInitialURL).not.toHaveBeenCalled();
    });

    it('keeps an unsettled return for the foreground fallback', async () => {
      const url = createReturnUrl(createNonce());
      mockedGetLinkingURL.mockReturnValue(url);
      mockedHandleDepositReturn.mockRejectedValueOnce(new Error('failed'));

      await handleBinanceDepositReturnFromOS(url, 'os_event');

      expect(mockedClearInitialURL).not.toHaveBeenCalled();
    });

    it('keeps a return refused for the server environment until it can be taken in', async () => {
      const url = createReturnUrl(createNonce());
      mockedGetLinkingURL.mockReturnValue(url);
      mockedHandleDepositReturn.mockResolvedValue({
        accepted: false,
        reason: BINANCE_DEPOSIT_RETURN_REASON.EndpointMismatch,
      });

      await handleBinanceDepositReturnFromOS(url, 'os_initial');
      await recoverBinanceDepositReturnOnForeground();

      // Still in the native cache. On iOS the restart that switches the app
      // back keeps the process, and this is where the return is read from
      // again when the self-test page opens. On Android that restart kills
      // the process and the cache with it: the return cannot be recovered
      // there, and the session has to be abandoned and created anew.
      expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(2);
      expect(mockedClearInitialURL).not.toHaveBeenCalled();

      // Back on the session's environment the fallback delivers it.
      mockedHandleDepositReturn.mockResolvedValue({ accepted: true });
      await recoverBinanceDepositReturnOnForeground();

      expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(3);
      expect(mockedHandleDepositReturn).toHaveBeenLastCalledWith(
        expect.objectContaining({ source: 'foreground_fallback' }),
      );
      expect(mockedClearInitialURL).toHaveBeenCalledTimes(1);
    });

    it('tolerates a native module without the cache methods', async () => {
      mockedGetLinkingURL.mockImplementation(() => {
        throw new TypeError('getLinkingURL is not a function');
      });

      await expect(
        handleBinanceDepositReturnFromOS(
          createReturnUrl(createNonce()),
          'os_event',
        ),
      ).resolves.toBeUndefined();
      expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(1);
    });
  });
});

describe('recoverBinanceDepositReturnOnForeground', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedHandleDepositReturn.mockResolvedValue({ accepted: true });
    mockedRecordDiscardedByMain.mockResolvedValue(undefined);
    mockedGetLinkingURL.mockReturnValue(null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('does nothing outside the native apps', async () => {
    mockedGetLinkingURL.mockReturnValue(createReturnUrl(createNonce()));

    await recoverBinanceDepositReturnOnForeground();

    expect(mockedGetLinkingURL).not.toHaveBeenCalled();
    expect(mockedHandleDepositReturn).not.toHaveBeenCalled();
  });

  describe('on native', () => {
    beforeEach(() => {
      jest.replaceProperty(platformEnv, 'isNative', true);
    });

    it('delivers the cached return as a foreground fallback', async () => {
      const nonce = createNonce();
      mockedGetLinkingURL.mockReturnValue(createReturnUrl(nonce));

      await recoverBinanceDepositReturnOnForeground();

      expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(1);
      expect(mockedHandleDepositReturn).toHaveBeenCalledWith({
        returnNonce: nonce,
        otherParamNames: [],
        source: 'foreground_fallback',
      });
      expect(mockedClearInitialURL).toHaveBeenCalledTimes(1);
    });

    it('reports a cached return it cannot use', async () => {
      mockedGetLinkingURL.mockReturnValue(
        createReturnUrl(createNonce().slice(0, 20)),
      );

      await recoverBinanceDepositReturnOnForeground();

      expect(mockedHandleDepositReturn).not.toHaveBeenCalled();
      expect(mockedReturnDiscarded).toHaveBeenCalledWith({
        source: 'foreground_fallback',
        reason: 'malformed_rn',
        otherParamNames: undefined,
      });
      expect(mockedRecordDiscardedByMain).toHaveBeenCalledWith({
        source: 'foreground_fallback',
        reason: 'malformed_rn',
        otherParamNames: [],
      });
    });

    it.each([
      null,
      '',
      'onekey-wallet://prime_subscription',
      'https://app.onekey.so/wc/connect/wc?uri=wc%3Aabc',
    ])('ignores a cached url that is not a return: %s', async (url) => {
      mockedGetLinkingURL.mockReturnValue(url);

      await recoverBinanceDepositReturnOnForeground();

      expect(mockedHandleDepositReturn).not.toHaveBeenCalled();
      expect(mockedReturnDiscarded).not.toHaveBeenCalled();
      expect(mockedClearInitialURL).not.toHaveBeenCalled();
    });

    it('fails silently when the cached url cannot be read', async () => {
      mockedGetLinkingURL.mockImplementation(() => {
        throw new TypeError('getLinkingURL is not a function');
      });

      await expect(
        recoverBinanceDepositReturnOnForeground(),
      ).resolves.toBeUndefined();
      expect(mockedHandleDepositReturn).not.toHaveBeenCalled();
    });

    it('fails silently when the background service fails', async () => {
      mockedGetLinkingURL.mockReturnValue(createReturnUrl(createNonce()));
      mockedHandleDepositReturn.mockRejectedValueOnce(new Error('failed'));

      await expect(
        recoverBinanceDepositReturnOnForeground(),
      ).resolves.toBeUndefined();
    });
  });
});
