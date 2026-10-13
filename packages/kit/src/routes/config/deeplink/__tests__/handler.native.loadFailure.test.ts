import * as Linking from 'expo-linking';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { IBinanceDepositReturnSource } from '@onekeyhq/shared/types/exchange';

// jest does not resolve platform extensions, so the native entry is imported
// by its full name; './handler' would be the empty web implementation.
import { registerHandler } from '../handler.native';

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(),
}));

jest.mock('../../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceBinanceDeposit: {
      handleDepositReturn: jest.fn(async () => ({ accepted: true })),
      recordReturnDiscardedByMain: jest.fn(async () => undefined),
    },
  },
}));

// The native entry loads the return handler with a dynamic import, which jest
// runs as a deferred require. A factory that throws stands for a chunk that
// cannot be loaded; it is called again for every attempt.
const mockLoadReturnHandler = jest.fn();
jest.mock('../binanceDepositReturn', (): unknown => mockLoadReturnHandler());
// Nothing the native entry imports statically may bring the handler's
// dependencies along either.
jest.mock('@onekeyhq/shared/src/utils/binanceDepositUtils', () => {
  throw new TypeError('binanceDepositUtils was loaded by the native entry');
});
// The scene the native entry writes its one log line to. It is replaced
// because the real one is built on the module guarded above; the last test
// checks that the real logger itself does not load it.
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    fiatCrypto: {
      binanceDeposit: {
        returnDiscarded: jest.fn(),
      },
    },
  },
}));

const mockedGetInitialURL = Linking.getInitialURL as jest.MockedFunction<
  typeof Linking.getInitialURL
>;
const mockedAddEventListener = Linking.addEventListener as jest.MockedFunction<
  typeof Linking.addEventListener
>;
const mockedService = (
  jest.requireMock('../../../../background/instance/backgroundApiProxy') as {
    default: {
      serviceBinanceDeposit: {
        handleDepositReturn: jest.Mock;
        recordReturnDiscardedByMain: jest.Mock;
      };
    };
  }
).default.serviceBinanceDeposit;
const mockedReturnDiscarded = (
  jest.requireMock('@onekeyhq/shared/src/logger/logger') as {
    defaultLogger: {
      fiatCrypto: {
        binanceDeposit: {
          returnDiscarded: jest.Mock<
            void,
            [{ source: IBinanceDepositReturnSource; reason: string }]
          >;
        };
      };
    };
  }
).defaultLogger.fiatCrypto.binanceDeposit.returnDiscarded;

// The wait between the two attempts to load the handler.
const RETRY_DELAY_MS = 600;

// Lets everything that is due run, without moving the clock.
function flushAsyncTasks() {
  return jest.advanceTimersByTimeAsync(0);
}

const NONCE = `000001${'xY7-_'.repeat(8)}`.slice(0, 43);
const RETURN_URL = `onekey-wallet://binance-connect/deposit-return?rn=${NONCE}`;
const OTHER_URL = 'onekey-wallet://prime_subscription';

describe('native deep link handler without a loadable return handler', () => {
  const handleDeepLinkUrl = jest.fn();
  const handleReturnFromOS = jest.fn<
    Promise<void>,
    [string, IBinanceDepositReturnSource]
  >();
  let consoleSpies: jest.SpyInstance[] = [];
  const unhandledRejections: unknown[] = [];
  const onUnhandledRejection = (reason: unknown) => {
    unhandledRejections.push(reason);
  };

  function failToLoad() {
    // What a failed load reports may describe the URL being handled.
    throw new OneKeyLocalError(`chunk failed to load for ${RETURN_URL}`);
  }

  function load() {
    return { handleBinanceDepositReturnFromOS: handleReturnFromOS };
  }

  function getUrlListener() {
    const [, listener] = mockedAddEventListener.mock.calls[0];
    return listener;
  }

  function expectNoTrace() {
    expect(unhandledRejections).toEqual([]);
    consoleSpies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  }

  // Attempts that ended in a failed load, which is what the segment loader
  // counts against the segment.
  function countFailedLoads() {
    return mockLoadReturnHandler.mock.results.filter(
      (result) => result.type === 'throw',
    ).length;
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    // A handler that loaded in one test must not be served from the module
    // registry to the next one.
    jest.resetModules();
    unhandledRejections.length = 0;
    mockedGetInitialURL.mockResolvedValue(null);
    mockLoadReturnHandler.mockImplementation(failToLoad);
    handleReturnFromOS.mockResolvedValue(undefined);
    consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(
      (method) => jest.spyOn(console, method).mockImplementation(() => {}),
    );
    process.on('unhandledRejection', onUnhandledRejection);
  });

  afterEach(async () => {
    // The native entry is one module instance for the whole file and keeps
    // the round of attempts it is running. A test that stopped half way must
    // not leave one behind for the next test to wait on.
    await jest.runAllTimersAsync();
    process.off('unhandledRejection', onUnhandledRejection);
    consoleSpies.forEach((spy) => spy.mockRestore());
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('tries twice in all for a cold start and a warm start delivery, then drops both with one log line each', async () => {
    mockedGetInitialURL.mockResolvedValue(RETURN_URL);

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    // The first attempt, made right away for the cold start delivery.
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(1);
    // The warm start delivery arrives while that round waits to try again.
    expect(getUrlListener()({ url: RETURN_URL })).toBe(RETURN_URL);
    await flushAsyncTasks();

    // It joined the round instead of starting one of its own.
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(1);
    expect(mockedReturnDiscarded).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(1);
    // Not given up on yet.
    expect(mockedReturnDiscarded).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    // Two attempts for the two deliveries together: one is left of the three
    // failures the segment loader allows before it gives the segment up.
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(countFailedLoads()).toBe(2);

    // One line per delivery: where it came from and a fixed reason.
    expect(mockedReturnDiscarded.mock.calls).toEqual([
      [{ source: 'os_initial', reason: 'handler_load_failed' }],
      [{ source: 'os_event', reason: 'handler_load_failed' }],
    ]);
    const logged = JSON.stringify(mockedReturnDiscarded.mock.calls);
    expect(logged).not.toContain(NONCE.slice(0, 16));
    expect(logged).not.toContain('onekey-wallet');
    expect(logged).not.toContain('chunk failed');

    // And that is the end of it.
    await jest.advanceTimersByTimeAsync(60_000);
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(mockedReturnDiscarded).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(0);
    // The return never falls back to the generic pipeline, which logs URLs.
    expect(handleDeepLinkUrl).not.toHaveBeenCalled();
    expect(handleReturnFromOS).not.toHaveBeenCalled();
    expect(mockedService.handleDepositReturn).not.toHaveBeenCalled();
    expect(mockedService.recordReturnDiscardedByMain).not.toHaveBeenCalled();
    expectNoTrace();
  });

  it('runs one round for deliveries that arrive in the same tick', async () => {
    // Registered twice, as in split view: one return, two deliveries.
    registerHandler(handleDeepLinkUrl);
    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    mockedAddEventListener.mock.calls.forEach(([, listener]) => {
      listener({ url: RETURN_URL });
    });
    await flushAsyncTasks();
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(60_000);

    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(countFailedLoads()).toBe(2);
    expect(mockedReturnDiscarded.mock.calls).toEqual([
      [{ source: 'os_event', reason: 'handler_load_failed' }],
      [{ source: 'os_event', reason: 'handler_load_failed' }],
    ]);
    expect(handleReturnFromOS).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expectNoTrace();
  });

  it('handles every delivery of a round that loaded the handler, and counts no failure after that', async () => {
    mockedGetInitialURL.mockResolvedValue(RETURN_URL);
    mockLoadReturnHandler
      .mockImplementationOnce(failToLoad)
      .mockImplementation(load);

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    getUrlListener()({ url: RETURN_URL });
    await flushAsyncTasks();
    expect(handleReturnFromOS).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS);

    // Both deliveries waited for the same two attempts, and both are handed
    // to the handler, which is the one to tell that they are the same return.
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(handleReturnFromOS.mock.calls).toEqual([
      [RETURN_URL, 'os_initial'],
      [RETURN_URL, 'os_event'],
    ]);
    expect(countFailedLoads()).toBe(1);

    // A delivery after the round ended: the handler is there, nothing is
    // retried and nothing more is counted as a failed load.
    getUrlListener()({ url: RETURN_URL });
    await flushAsyncTasks();
    expect(jest.getTimerCount()).toBe(0);
    expect(handleReturnFromOS.mock.calls).toEqual([
      [RETURN_URL, 'os_initial'],
      [RETURN_URL, 'os_event'],
      [RETURN_URL, 'os_event'],
    ]);
    await jest.advanceTimersByTimeAsync(60_000);
    expect(handleReturnFromOS).toHaveBeenCalledTimes(3);
    expect(countFailedLoads()).toBe(1);
    expect(mockedReturnDiscarded).not.toHaveBeenCalled();
    expect(handleDeepLinkUrl).not.toHaveBeenCalled();
    expectNoTrace();
  });

  it('handles the return once when the second attempt loads the handler', async () => {
    mockLoadReturnHandler
      .mockImplementationOnce(failToLoad)
      .mockImplementation(load);

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    getUrlListener()({ url: RETURN_URL });
    await flushAsyncTasks();
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(1);
    expect(handleReturnFromOS).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS - 1);
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);

    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(handleReturnFromOS.mock.calls).toEqual([[RETURN_URL, 'os_event']]);

    // No third attempt, no second delivery and nothing reported as dropped.
    await jest.advanceTimersByTimeAsync(60_000);
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(handleReturnFromOS).toHaveBeenCalledTimes(1);
    expect(mockedReturnDiscarded).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(handleDeepLinkUrl).not.toHaveBeenCalled();
    expectNoTrace();
  });

  it('gives up after the second attempt, and leaves the third for a later delivery', async () => {
    mockedGetInitialURL.mockResolvedValue(RETURN_URL);
    mockLoadReturnHandler
      .mockImplementationOnce(failToLoad)
      .mockImplementationOnce(failToLoad)
      .mockImplementation(load);

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS);
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(mockedReturnDiscarded.mock.calls).toEqual([
      [{ source: 'os_initial', reason: 'handler_load_failed' }],
    ]);

    // A third attempt would have loaded the handler, and it is not made.
    await jest.advanceTimersByTimeAsync(60_000);
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(handleReturnFromOS).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);

    // The failed round is not kept: the next delivery of the return starts a
    // new one, which is the first to use what was left.
    getUrlListener()({ url: RETURN_URL });
    await flushAsyncTasks();
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(3);
    expect(handleReturnFromOS.mock.calls).toEqual([[RETURN_URL, 'os_event']]);
    expect(mockedReturnDiscarded).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    expectNoTrace();
  });

  it('does not try again when the loaded handler itself fails', async () => {
    mockLoadReturnHandler.mockImplementation(load);
    handleReturnFromOS.mockRejectedValue(
      new OneKeyLocalError(`could not handle ${RETURN_URL}`),
    );

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    getUrlListener()({ url: RETURN_URL });
    await jest.advanceTimersByTimeAsync(60_000);

    // Loading is what is retried, never the handling of the return.
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(1);
    expect(handleReturnFromOS).toHaveBeenCalledTimes(1);
    expect(mockedReturnDiscarded).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expectNoTrace();
  });

  it('keeps serving every other deep link while it retries and after it gave up', async () => {
    mockedGetInitialURL.mockResolvedValue(OTHER_URL);

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    expect(handleDeepLinkUrl).toHaveBeenCalledTimes(1);
    const listener = getUrlListener();

    // In the same tick as the return, before anything was loaded.
    listener({ url: RETURN_URL });
    expect(listener({ url: OTHER_URL })).toBe(OTHER_URL);
    expect(handleDeepLinkUrl).toHaveBeenCalledTimes(2);

    // Between the two attempts: the first one failed and the next is waiting.
    await flushAsyncTasks();
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1);
    listener({ url: OTHER_URL });
    expect(handleDeepLinkUrl).toHaveBeenCalledTimes(3);

    // Part of the way through that wait.
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS / 2);
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(1);
    listener({ url: OTHER_URL });
    expect(handleDeepLinkUrl).toHaveBeenCalledTimes(4);

    // After the last attempt failed.
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS / 2);
    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(mockedReturnDiscarded).toHaveBeenCalledTimes(1);
    listener({ url: OTHER_URL });
    expect(handleDeepLinkUrl).toHaveBeenCalledTimes(5);

    // Each of them went through as it was, and the return never did.
    expect(handleDeepLinkUrl.mock.calls).toEqual(
      Array.from({ length: 5 }, () => [{ url: OTHER_URL }]),
    );
    expectNoTrace();
  });

  it('does not load the return handler for other deep links', async () => {
    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    const listener = getUrlListener();
    listener({ url: 'onekey-wallet://wc?uri=wc%3Aabc' });
    listener({
      url: 'onekey-wallet://binance-connect-other/deposit-return?rn=whatever',
    });
    await jest.advanceTimersByTimeAsync(60_000);

    expect(mockLoadReturnHandler).not.toHaveBeenCalled();
    expect(mockedReturnDiscarded).not.toHaveBeenCalled();
    expect(handleDeepLinkUrl).toHaveBeenCalledTimes(2);
  });

  it('never rejects when the log line cannot be written either', async () => {
    mockedReturnDiscarded.mockImplementation(() => {
      throw new OneKeyLocalError('logger is broken');
    });

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    getUrlListener()({ url: RETURN_URL });
    await jest.advanceTimersByTimeAsync(RETRY_DELAY_MS);

    expect(mockLoadReturnHandler).toHaveBeenCalledTimes(2);
    expect(mockedReturnDiscarded).toHaveBeenCalledTimes(1);
    expect(handleDeepLinkUrl).not.toHaveBeenCalled();
    expectNoTrace();
  });

  it('imports a logger that does not load the deposit scene by itself', () => {
    // The real module, as the native entry imports it statically. Had it
    // pulled in the deposit scene, the guard on binanceDepositUtils above
    // would have thrown here.
    const { defaultLogger } = jest.requireActual<
      typeof import('@onekeyhq/shared/src/logger/logger')
    >('@onekeyhq/shared/src/logger/logger');

    expect(defaultLogger).toBeDefined();
  });
});
