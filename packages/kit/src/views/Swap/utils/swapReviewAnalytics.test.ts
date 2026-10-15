import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  ISwapReviewClose,
  ISwapReviewConfirm,
  ISwapReviewOpen,
  ISwapReviewReady,
} from '@onekeyhq/shared/types/swap/reviewAnalytics';
import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';

const mockEstimateFee = jest.fn();
const mockSendTx = jest.fn();

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    swap: {
      swapReview: {},
      swapEstimateFee: { swapEstimateFee: mockEstimateFee },
      swapSendTx: { swapSendTx: mockSendTx },
    },
  },
}));
jest.mock(
  '@onekeyhq/shared/src/logger/scopes/swap/scenes/swapEstimateFee',
  () => ({ ESwapEventAPIStatus: { SUCCESS: 'success', FAIL: 'fail' } }),
);
jest.mock('@onekeyhq/shared/src/utils/miscUtils', () => ({
  generateUUID: () => 'generated-review-id',
}));
jest.mock('./swapTypeUtils', () => ({
  getSwapExecutionTypeFromQuoteResult: () => 'swap',
}));

const {
  createSwapReviewAnalytics,
  getSwapReviewErrorMessage,
  getSwapReviewOrderId,
  measureSwapReviewStage,
  trackSwapReviewApi,
} = require('./swapReviewAnalytics') as typeof import('./swapReviewAnalytics');

const openParams: Omit<ISwapReviewOpen, 'reviewSessionId' | 'openDelayMs'> = {
  quoteId: 'quote-1',
  swapProvider: 'provider',
  swapType: 'swap',
  sourceChain: 'evm--1',
  receivedChain: 'evm--1',
  sourceTokenSymbol: 'ETH',
  receivedTokenSymbol: 'USDC',
  createFrom: 'swapPage',
  walletType: 'hd',
  supportPreBuild: true,
  needApprove: false,
};
const readyState = {
  ready: true,
  error: false,
  loading: false,
  fallback: false,
  supportPreBuild: true,
  quoteId: 'quote-1',
  orderId: 'order-1',
};

function createHarness(reviewSessionId = 'review-1') {
  let time = 0;
  const logger = {
    swapReviewOpen: jest.fn<void, [ISwapReviewOpen]>(),
    swapReviewReady: jest.fn<void, [ISwapReviewReady]>(),
    swapReviewConfirm: jest.fn<void, [ISwapReviewConfirm]>(),
    swapReviewClose: jest.fn<void, [ISwapReviewClose]>(),
  };
  return {
    session: createSwapReviewAnalytics({
      clock: () => time,
      logger,
      reviewSessionId,
    }),
    logger,
    at: (nextTime: number) => {
      time = nextTime;
    },
  };
}

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve: () => resolve() };
}

describe('swap review analytics lifecycle', () => {
  it('preserves confirmation and once-only state when lifecycle logging throws', () => {
    const { session, logger } = createHarness();
    Object.values(logger).forEach((log) => {
      log.mockImplementation(() => {
        throw new OneKeyLocalError('Telemetry unavailable');
      });
    });

    expect(() => session.open(openParams)).not.toThrow();
    expect(session.beginPreparation()).toBeDefined();
    expect(() => session.observe(readyState)).not.toThrow();
    expect(() => session.confirm()).not.toThrow();
    expect(session.isConfirmed()).toBe(true);
    expect(() => session.close()).not.toThrow();
    session.open(openParams);
    session.observe(readyState);
    session.confirm();

    expect(logger.swapReviewOpen).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewReady).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewConfirm).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewClose).not.toHaveBeenCalled();
  });

  it('finishes an unconfirmed close even when the close logger throws', () => {
    const { session, logger } = createHarness();
    logger.swapReviewClose.mockImplementation(() => {
      throw new OneKeyLocalError('Telemetry unavailable');
    });
    session.open(openParams);
    expect(() => session.close('reviewChanged')).not.toThrow();
    session.close('user');
    session.observe(readyState);
    session.confirm();

    expect(session.isConfirmed()).toBe(false);
    expect(logger.swapReviewClose).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewReady).not.toHaveBeenCalled();
    expect(logger.swapReviewConfirm).not.toHaveBeenCalled();
  });

  it('does not emit events for work that never opens a review', () => {
    const { session, logger } = createHarness();
    expect(session.beginPreparation()).toBeUndefined();
    session.observe(readyState);
    session.confirm();
    session.close('focusLost');
    session.open(openParams);
    Object.values(logger).forEach((log) => expect(log).not.toHaveBeenCalled());
  });

  it('emits Open, Ready, and Confirm once and excludes confirmed exits', () => {
    const { session, logger, at } = createHarness();
    at(100);
    session.open(openParams);
    session.open({ ...openParams, quoteId: 'later-quote' });
    at(300);
    session.observe(readyState);
    session.observe(readyState);
    at(550);
    session.confirm('quote-1', 'order-1');
    session.confirm('quote-2', 'order-2');
    session.close('user');
    expect(logger.swapReviewOpen).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewOpen).toHaveBeenCalledWith({
      ...openParams,
      reviewSessionId: 'review-1',
      openDelayMs: 100,
    });
    expect(logger.swapReviewReady).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewReady).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'ready', totalMs: 200 }),
    );
    expect(logger.swapReviewConfirm).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewConfirm).toHaveBeenCalledWith({
      reviewSessionId: 'review-1',
      quoteId: 'quote-1',
      orderId: 'order-1',
      sinceOpenMs: 450,
      sinceReadyMs: 250,
    });
    expect(logger.swapReviewClose).not.toHaveBeenCalled();
  });

  it('keeps an initial failure but measures confirmation from retry readiness', () => {
    const { session, logger, at } = createHarness();
    session.open(openParams);
    session.beginPreparation()?.fail('buildTx', new Error('Build failed'));
    at(40);
    session.observe({
      ...readyState,
      ready: false,
      error: true,
      fallback: true,
    });
    at(60);
    session.observe({ ...readyState, ready: false, loading: true });
    at(100);
    session.observe(readyState);
    at(160);
    session.confirm();
    expect(logger.swapReviewReady).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewReady).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        failedStage: 'buildTx',
        message: 'Unknown error',
      }),
    );
    expect(logger.swapReviewConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ sinceReadyMs: 60 }),
    );
  });

  it('reports readiness from the usable UI after a recoverable preparation error', () => {
    const { session, logger } = createHarness();
    session.open(openParams);
    session.beginPreparation()?.fail('estimateFee', new Error('RPC failure'));
    session.observe(readyState);
    session.close();
    expect(logger.swapReviewReady).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'ready',
        failedStage: undefined,
        message: undefined,
      }),
    );
    expect(logger.swapReviewClose).toHaveBeenCalledWith(
      expect.objectContaining({ closeStage: 'ready' }),
    );
  });

  it('reports a successful fallback even when its first preparation failed', () => {
    const { session, logger } = createHarness();
    session.open(openParams);
    session
      .beginPreparation()
      ?.fail('estimateFee', new Error('Batch unsupported'));
    session.observe({ ...readyState, fallback: true });
    expect(logger.swapReviewReady).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'fallback', failedStage: undefined }),
    );
  });

  it('preserves ready while an idle editor hides the primary button', () => {
    const { session, logger } = createHarness();
    session.open(openParams);
    session.observe(readyState);
    session.observe({ ...readyState, ready: false });
    session.close('user');
    expect(logger.swapReviewClose).toHaveBeenCalledWith(
      expect.objectContaining({ closeStage: 'ready', closeReason: 'user' }),
    );
  });

  it.each([
    { loading: true, error: false, closeStage: 'loading' },
    { loading: false, error: true, closeStage: 'error' },
  ])('classifies a later $closeStage state when closing', (state) => {
    const { session, logger } = createHarness();
    session.open(openParams);
    session.observe(readyState);
    session.observe({ ...readyState, ready: false, ...state });
    session.close('reviewChanged');
    session.close('user');
    session.observe(readyState);
    expect(logger.swapReviewClose).toHaveBeenCalledTimes(1);
    expect(logger.swapReviewClose).toHaveBeenCalledWith(
      expect.objectContaining({
        closeStage: state.closeStage,
        closeReason: 'reviewChanged',
      }),
    );
    expect(logger.swapReviewReady).toHaveBeenCalledTimes(1);
  });

  it('keeps late callbacks on the captured old session', () => {
    const old = createHarness('old');
    const current = createHarness('current');
    old.session.open(openParams);
    const onOldDialogClose = () => old.session.close('user');
    old.session.close('reviewChanged');
    current.session.open(openParams);
    onOldDialogClose();
    current.session.observe(readyState);
    current.session.confirm();
    expect(old.logger.swapReviewClose).toHaveBeenCalledTimes(1);
    expect(current.logger.swapReviewClose).not.toHaveBeenCalled();
    expect(current.logger.swapReviewConfirm).toHaveBeenCalledTimes(1);
  });

  it('omits stage timings when no prebuild is supported', async () => {
    const { session, logger } = createHarness();
    session.open({ ...openParams, supportPreBuild: false });
    const preparation = session.beginPreparation();
    expect(preparation).toBeUndefined();
    await expect(
      measureSwapReviewStage(preparation, 'buildTx', async () => 'result'),
    ).resolves.toBe('result');
    session.observe({ ...readyState, supportPreBuild: false });
    const [event] = logger.swapReviewReady.mock.calls[0];
    expect(event).not.toHaveProperty('buildTxMs');
    expect(event).not.toHaveProperty('balanceCheckMs');
    expect(event).not.toHaveProperty('approveTxMs');
    expect(event).not.toHaveProperty('prepareTxMs');
    expect(event).not.toHaveProperty('estimateFeeMs');
  });

  it('counts overlapping stage work once and adds disjoint work', async () => {
    const { session, logger, at } = createHarness();
    session.open(openParams);
    const preparation = session.beginPreparation();
    const first = deferred();
    const second = deferred();
    at(10);
    const firstMeasured = measureSwapReviewStage(
      preparation,
      'prepareTx',
      () => first.promise,
    );
    at(30);
    const secondMeasured = measureSwapReviewStage(
      preparation,
      'prepareTx',
      () => second.promise,
    );
    at(60);
    second.resolve();
    await secondMeasured;
    at(100);
    first.resolve();
    await firstMeasured;
    at(120);
    await measureSwapReviewStage(preparation, 'prepareTx', async () => {
      at(140);
    });
    session.observe(readyState);
    expect(logger.swapReviewReady).toHaveBeenCalledWith(
      expect.objectContaining({ prepareTxMs: 110, totalMs: 140 }),
    );
  });

  it('preserves the original error and first failed stage', async () => {
    const { session, logger, at } = createHarness();
    session.open(openParams);
    const preparation = session.beginPreparation();
    const failure = new Error('RPC failed');
    await expect(
      measureSwapReviewStage(preparation, 'estimateFee', async () => {
        at(20);
        throw failure;
      }),
    ).rejects.toBe(failure);
    preparation?.fail('prepareTx', new Error('Later failure'));
    session.observe({ ...readyState, ready: false, error: true });
    expect(logger.swapReviewReady).toHaveBeenCalledWith(
      expect.objectContaining({
        estimateFeeMs: 20,
        failedStage: 'estimateFee',
        message: 'Network error',
      }),
    );
  });

  it('ignores preparation completion after the review closes', async () => {
    const { session, logger } = createHarness();
    session.open(openParams);
    const pending = deferred();
    const work = measureSwapReviewStage(
      session.beginPreparation(),
      'buildTx',
      () => pending.promise,
    );
    session.close('focusLost');
    pending.resolve();
    await work;
    session.observe(readyState);
    session.confirm();
    expect(logger.swapReviewReady).not.toHaveBeenCalled();
    expect(logger.swapReviewConfirm).not.toHaveBeenCalled();
    expect(logger.swapReviewClose).toHaveBeenCalledTimes(1);
  });
});

const swapInfo = {
  reviewAnalyticsContext: {
    reviewSessionId: 'review-1',
    quoteId: 'quote-1',
    orderId: 'service-order',
  },
  sender: { amount: '1', token: { networkId: 'evm--1', symbol: 'ETH' } },
  receiver: { amount: '2', token: { networkId: 'evm--1', symbol: 'USDC' } },
  swapBuildResData: {
    orderId: 'business-order',
    result: { quoteId: 'quote-1', info: { provider: 'provider' } },
  },
} as ISwapTxInfo;

describe('swap review API correlation', () => {
  beforeEach(() => {
    mockEstimateFee.mockClear();
    mockSendTx.mockClear();
  });

  it.each([
    [
      'RPC unavailable for 0x1111111111111111111111111111111111111111',
      'Network error',
    ],
    ['insufficient balance for private-account', 'Insufficient balance'],
    ['checkLatestNativeTokenBalance failed', 'Insufficient balance'],
    [
      'User rejected request containing private-payload',
      'Transaction rejected',
    ],
    [
      'request timed out at https://private.invalid?token=secret',
      'Request timed out',
    ],
    ['Empty build response', 'Empty build response'],
    ['x'.repeat(400), 'Unknown error'],
    ['private@example.invalid password=private', 'Unknown error'],
  ])('only emits a fixed category for %s', (message, expected) => {
    const error = new Error(message);
    expect(getSwapReviewErrorMessage(error)).toBe(expected);
    expect(
      getSwapReviewErrorMessage(JSON.parse(JSON.stringify({ message }))),
    ).toBe(expected);
    expect(getSwapReviewErrorMessage({ message: expected })).toBe(expected);
    expect(error.message).toBe(message);
    expect(getSwapReviewErrorMessage({ name: message, code: message })).toBe(
      'Unknown error',
    );
  });

  it('uses only real service order IDs when analytics context is present', () => {
    expect(getSwapReviewOrderId(swapInfo)).toBe('service-order');
    expect(
      getSwapReviewOrderId({
        ...swapInfo,
        reviewAnalyticsContext: { reviewSessionId: 'review-1' },
      }),
    ).toBeUndefined();
    expect(
      getSwapReviewOrderId({ ...swapInfo, reviewAnalyticsContext: undefined }),
    ).toBe('business-order');
  });

  it('reports one successful request and returns its result unchanged', async () => {
    const response = { txId: 'tx-1' };
    await expect(
      trackSwapReviewApi('sendTx', swapInfo, async () => response),
    ).resolves.toBe(response);
    expect(mockSendTx).toHaveBeenCalledTimes(1);
    expect(mockSendTx).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'success',
        reviewSessionId: 'review-1',
        orderId: 'service-order',
      }),
    );
  });

  it('preserves request outcomes even if telemetry fails', async () => {
    const telemetryFailure = new Error('Telemetry unavailable');
    const requestFailure = new Error('RPC failure');
    const response = { txId: 'tx-1' };
    mockSendTx.mockImplementationOnce(() => {
      throw telemetryFailure;
    });
    await expect(
      trackSwapReviewApi('sendTx', swapInfo, async () => response),
    ).resolves.toBe(response);
    mockSendTx.mockImplementationOnce(() => {
      throw telemetryFailure;
    });
    await expect(
      trackSwapReviewApi('sendTx', swapInfo, async () => {
        throw requestFailure;
      }),
    ).rejects.toBe(requestFailure);
  });

  it('skips cancellation telemetry but rethrows the original cancellation', async () => {
    const cancelled = new Error('User cancelled');
    await expect(
      trackSwapReviewApi(
        'sendTx',
        swapInfo,
        async () => {
          throw cancelled;
        },
        undefined,
        { shouldReportError: (error) => error !== cancelled },
      ),
    ).rejects.toBe(cancelled);
    expect(mockSendTx).not.toHaveBeenCalled();
  });

  it('reports other request failures once and rethrows the original error', async () => {
    const failure = new Error('Service unavailable');
    await expect(
      trackSwapReviewApi(
        'estimateFee',
        swapInfo,
        async () => {
          throw failure;
        },
        true,
        { shouldReportError: () => true },
      ),
    ).rejects.toBe(failure);
    expect(mockEstimateFee).toHaveBeenCalledTimes(1);
    expect(mockEstimateFee).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fail',
        isBatch: true,
        message: 'Network error',
      }),
    );
  });
});
