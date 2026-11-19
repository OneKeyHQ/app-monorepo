import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { runTradingViewEmbedPrefetch } from './tradingViewEmbedPrefetch';

describe('runTradingViewEmbedPrefetch', () => {
  test('replies after bootstrap readiness without waiting for the full cache', async () => {
    let resolveCompletion;
    const completion = new Promise((resolve) => {
      resolveCompletion = resolve;
    });
    let resolveReply;
    const reply = new Promise((resolve) => {
      resolveReply = resolve;
    });
    const postMessage = jest.fn(() => resolveReply());
    const complete = jest.fn(() => completion);

    const prefetchPromise = runTradingViewEmbedPrefetch({
      getErrorCode: () => 'unused',
      prepare: async () => ({ complete, version: 'test-v2' }),
      replyPort: { postMessage },
    });
    await reply;

    expect(postMessage).toHaveBeenCalledWith({
      ok: true,
      version: 'test-v2',
    });
    expect(complete).toHaveBeenCalledTimes(1);
    let settled = false;
    void prefetchPromise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);

    resolveCompletion();
    await prefetchPromise;
    expect(settled).toBe(true);
  });

  test('reports bootstrap preparation failures', async () => {
    const postMessage = jest.fn();

    await runTradingViewEmbedPrefetch({
      getErrorCode: () => 'bootstrap_failed',
      prepare: async () => {
        throw new OneKeyLocalError('failed');
      },
      replyPort: { postMessage },
    });

    expect(postMessage).toHaveBeenCalledWith({
      error: 'bootstrap_failed',
      ok: false,
    });
  });
});
