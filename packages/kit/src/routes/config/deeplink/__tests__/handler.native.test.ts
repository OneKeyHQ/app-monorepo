import * as Linking from 'expo-linking';

import type {
  IBinanceDepositReturnParams,
  IBinanceDepositReturnResult,
  IBinanceDepositReturnSource,
} from '@onekeyhq/shared/types/exchange';

import { handleBinanceDepositReturnFromOS } from '../binanceDepositReturn';
// jest does not resolve platform extensions, so the native entry is imported
// by its full name; './handler' would be the empty web implementation.
import { registerHandler } from '../handler.native';

jest.mock('expo-linking', () => ({
  getInitialURL: jest.fn(async () => null),
  addEventListener: jest.fn(),
  getLinkingURL: jest.fn(() => null),
  clearInitialURL: jest.fn(),
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

// The native entry loads this module with a dynamic import, which jest runs
// as a deferred require, so the mock below is what it receives.
jest.mock('../binanceDepositReturn', () => {
  const actual = jest.requireActual<typeof import('../binanceDepositReturn')>(
    '../binanceDepositReturn',
  );
  return {
    ...actual,
    handleBinanceDepositReturnFromOS: jest.fn(
      actual.handleBinanceDepositReturnFromOS,
    ),
  };
});

const mockedGetInitialURL = Linking.getInitialURL as jest.MockedFunction<
  typeof Linking.getInitialURL
>;
const mockedAddEventListener = Linking.addEventListener as jest.MockedFunction<
  typeof Linking.addEventListener
>;
const mockedHandleReturnFromOS =
  handleBinanceDepositReturnFromOS as jest.MockedFunction<
    typeof handleBinanceDepositReturnFromOS
  >;
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
          [
            {
              reason: string;
              otherParamNames: string[];
              source: IBinanceDepositReturnSource;
            },
          ]
        >;
      };
    };
  }
).default.serviceBinanceDeposit;
const mockedHandleDepositReturn = mockedService.handleDepositReturn;
const mockedRecordDiscardedByMain = mockedService.recordReturnDiscardedByMain;

// A full turn of the event loop: the handler is reached through a dynamic
// import, which takes more microtask turns than a direct call.
function flushAsyncTasks() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });
}

let nonceCounter = 0;
function createReturnUrl() {
  nonceCounter += 1;
  const nonce = `${String(nonceCounter).padStart(6, '0')}${'xY7-_'.repeat(8)}`;
  return {
    nonce: nonce.slice(0, 43),
    url: `onekey-wallet://binance-connect/deposit-return?rn=${nonce.slice(0, 43)}`,
  };
}

function getUrlListener() {
  const [eventType, listener] = mockedAddEventListener.mock.calls[0];
  expect(eventType).toBe('url');
  return listener;
}

describe('native deep link handler', () => {
  const handleDeepLinkUrl = jest.fn();
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetInitialURL.mockResolvedValue(null);
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('consumes a cold start Binance deposit return at the OS entry', async () => {
    const { nonce, url } = createReturnUrl();
    mockedGetInitialURL.mockResolvedValue(url);

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    await flushAsyncTasks();

    expect(mockedHandleReturnFromOS).toHaveBeenCalledTimes(1);
    expect(mockedHandleReturnFromOS).toHaveBeenCalledWith(url, 'os_initial');
    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(1);
    expect(mockedHandleDepositReturn).toHaveBeenCalledWith({
      returnNonce: nonce,
      otherParamNames: [],
      source: 'os_initial',
    });
    expect(handleDeepLinkUrl).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('consumes a warm start Binance deposit return at the OS entry', async () => {
    const { nonce, url } = createReturnUrl();

    registerHandler(handleDeepLinkUrl);
    getUrlListener()({ url });
    await flushAsyncTasks();

    expect(mockedHandleReturnFromOS).toHaveBeenCalledTimes(1);
    expect(mockedHandleReturnFromOS).toHaveBeenCalledWith(url, 'os_event');
    expect(mockedHandleDepositReturn).toHaveBeenCalledWith({
      returnNonce: nonce,
      otherParamNames: [],
      source: 'os_event',
    });
    expect(handleDeepLinkUrl).not.toHaveBeenCalled();
    expect(consoleLogSpy).not.toHaveBeenCalled();
  });

  it('tells a cold start return from a warm start one of the same session', async () => {
    const cold = createReturnUrl();
    const warm = createReturnUrl();
    mockedGetInitialURL.mockResolvedValue(cold.url);

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    getUrlListener()({ url: warm.url });
    await flushAsyncTasks();

    expect(mockedHandleReturnFromOS.mock.calls).toEqual([
      [cold.url, 'os_initial'],
      [warm.url, 'os_event'],
    ]);
    expect(
      mockedHandleDepositReturn.mock.calls.map(([params]) => params.source),
    ).toEqual(['os_initial', 'os_event']);
    expect(handleDeepLinkUrl).not.toHaveBeenCalled();
  });

  it('calls the background service once when the handler was registered twice', async () => {
    const { url } = createReturnUrl();

    registerHandler(handleDeepLinkUrl);
    registerHandler(handleDeepLinkUrl);
    mockedAddEventListener.mock.calls.forEach(([, listener]) =>
      listener({ url }),
    );
    await flushAsyncTasks();

    expect(mockedHandleReturnFromOS).toHaveBeenCalledTimes(2);
    expect(mockedHandleDepositReturn).toHaveBeenCalledTimes(1);
    expect(handleDeepLinkUrl).not.toHaveBeenCalled();
  });

  it.each([
    'onekey-wallet://binance-connect/deposit-return?rn=short',
    'onekey-wallet://binance-connect/deposit-return',
    'onekey-wallet://binance-connect/Deposit-Return?rn=whatever',
    'onekey-wallet://binance-connect',
  ])(
    'keeps a malformed return away from the pipeline and the bind call: %s',
    async (url) => {
      registerHandler(handleDeepLinkUrl);
      getUrlListener()({ url });
      await flushAsyncTasks();

      expect(mockedHandleReturnFromOS).toHaveBeenCalledWith(url, 'os_event');
      expect(mockedHandleDepositReturn).not.toHaveBeenCalled();
      // Dropped in this runtime, and mirrored into the service's events.
      expect(mockedRecordDiscardedByMain).toHaveBeenCalledTimes(1);
      expect(mockedRecordDiscardedByMain).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'os_event' }),
      );
      expect(handleDeepLinkUrl).not.toHaveBeenCalled();
    },
  );

  it('answers the OS before the return handler has been loaded', async () => {
    const { url } = createReturnUrl();

    registerHandler(handleDeepLinkUrl);
    // The listener itself stays synchronous; the handler runs later.
    expect(getUrlListener()({ url })).toBe(url);
    expect(mockedHandleReturnFromOS).not.toHaveBeenCalled();
    expect(handleDeepLinkUrl).not.toHaveBeenCalled();

    await flushAsyncTasks();
    expect(mockedHandleReturnFromOS).toHaveBeenCalledTimes(1);
    expect(mockedHandleReturnFromOS).toHaveBeenCalledWith(url, 'os_event');
  });

  it.each([
    'onekey-wallet://prime_subscription',
    'onekey-wallet://wc?uri=wc%3Aabc',
    'https://app.onekey.so/r/R7EKUT',
    'onekey-wallet://binance-connect-other/deposit-return?rn=whatever',
  ])('passes every other url on to the pipeline: %s', async (url) => {
    mockedGetInitialURL.mockResolvedValue(url);

    registerHandler(handleDeepLinkUrl);
    await flushAsyncTasks();
    getUrlListener()({ url });
    await flushAsyncTasks();

    expect(handleDeepLinkUrl).toHaveBeenCalledTimes(2);
    expect(handleDeepLinkUrl).toHaveBeenNthCalledWith(1, { url });
    expect(handleDeepLinkUrl).toHaveBeenNthCalledWith(2, { url });
    expect(mockedHandleReturnFromOS).not.toHaveBeenCalled();
    expect(mockedHandleDepositReturn).not.toHaveBeenCalled();
  });
});
