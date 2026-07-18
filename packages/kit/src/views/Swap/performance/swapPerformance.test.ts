import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import {
  SwapPerformanceMonitor,
  runSwapPerformanceSafely,
} from './swapPerformance';

const SWAP_ALLOWED_PAYLOAD_KEYS = new Set([
  'durationMs',
  'errorCode',
  'expectedProviderCount',
  'firstQuoteMs',
  'pageVisible',
  'quoteMode',
  'receivedProviderCount',
  'result',
  'sampleRate',
  'scenario',
  'settledMs',
  'staleDiscardCount',
  'successProviderCount',
]);

function expectAllowedPayloadKeys(payload: Record<string, unknown>) {
  expect(Object.keys(payload).sort()).toEqual(
    Object.keys(payload).filter((key) => SWAP_ALLOWED_PAYLOAD_KEYS.has(key)).sort(),
  );
}

const intent = {
  amountKey: '1',
  fromNetworkKey: 'network-a',
  fromTokenKey: 'token-a',
  quoteKind: 'sell',
  quoteMode: 'market' as const,
  toNetworkKey: 'network-b',
  toTokenKey: 'token-b',
};

describe('SwapPerformanceMonitor', () => {
  it('does not let an old eventId finish the new intent', () => {
    const reporter = jest.fn();
    const monitor = new SwapPerformanceMonitor(reporter);
    const oldRunId = monitor.beginIntent(intent);
    monitor.expectedProviders({ count: 1, eventId: 'old', intent, runId: oldRunId });
    monitor.beginIntent({ ...intent, amountKey: '2' });
    reporter.mockClear();

    const accepted = monitor.settled({
      eventId: 'old',
      intent: { ...intent, amountKey: '2' },
    });

    expect(accepted).toBe(false);
    expect(reporter).not.toHaveBeenCalled();
    monitor.cancelIntent();
  });

  it('separates first actionable quote from provider settlement', () => {
    const reporter = jest.fn();
    const monitor = new SwapPerformanceMonitor(reporter);
    const runId = monitor.beginIntent(intent);
    monitor.expectedProviders({ count: 2, eventId: 'current', intent, runId });
    monitor.quotesReceived({
      eventId: 'current',
      intent,
      runId,
      quotes: [{ actionable: true, providerKey: 'provider-a' }],
    });

    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter.mock.calls[0][0]).toBe('swapPerfFirstQuote');
    monitor.quotesReceived({
      eventId: 'current',
      intent,
      runId,
      quotes: [{ actionable: false, providerKey: 'provider-b' }],
    });
    expect(reporter).toHaveBeenCalledTimes(2);
    expect(reporter.mock.calls[1][0]).toBe('swapPerfQuoteSettled');
    expect(reporter.mock.calls[1][1].result).toBe('partial');
    monitor.cancelIntent();
  });

  it('does not let an old run bind the same intent after manual refresh', () => {
    const reporter = jest.fn();
    const monitor = new SwapPerformanceMonitor(reporter);
    const oldRunId = monitor.beginIntent(intent);
    const newRunId = monitor.beginIntent({ ...intent, manualRefresh: true });
    reporter.mockClear();

    expect(
      monitor.expectedProviders({
        count: 1,
        eventId: 'old-first-arrival',
        intent,
        runId: oldRunId,
      }),
    ).toBe(false);
    expect(reporter).not.toHaveBeenCalled();

    expect(
      monitor.expectedProviders({
        count: 1,
        eventId: 'current',
        intent: { ...intent, manualRefresh: true },
        runId: newRunId,
      }),
    ).toBe(true);
    monitor.quotesReceived({
      eventId: 'current',
      intent: { ...intent, manualRefresh: true },
      runId: newRunId,
      quotes: [{ actionable: true, providerKey: 'provider-a' }],
    });
    expect(reporter).toHaveBeenCalledTimes(2);
    monitor.cancelIntent();
  });

  it('reports only allowed swap terminal payload keys', () => {
    const reporter = jest.fn();
    const monitor = new SwapPerformanceMonitor(reporter);
    const runId = monitor.beginIntent(intent);

    monitor.expectedProviders({ count: 1, eventId: 'current', intent, runId });
    monitor.quotesReceived({
      eventId: 'current',
      intent,
      runId,
      quotes: [{ actionable: true, providerKey: 'provider-a' }],
    });

    expect(reporter).toHaveBeenCalledTimes(2);
    expectAllowedPayloadKeys(reporter.mock.calls[0][1]);
    expectAllowedPayloadKeys(reporter.mock.calls[1][1]);
    monitor.cancelIntent();
  });

  it('isolates instrumentation failures from the caller', () => {
    const businessAction = jest.fn();
    runSwapPerformanceSafely(() => {
      throw new OneKeyLocalError('instrumentation failed');
    });
    businessAction();
    expect(businessAction).toHaveBeenCalledTimes(1);
  });
});
