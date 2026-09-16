import { CanceledError } from 'axios';

import { EOneKeyErrorClassNames } from '../errors/types/errorTypes';
import errorToastUtils from '../errors/utils/errorToastUtils';
import { isRequestCanceledError } from '../errors/utils/errorUtils';

import { runSwapPreviewTask, unwrapSwapPreviewTask } from './swapPreviewTask';

describe('Swap preview RPC result', () => {
  it.each([true, false, undefined])(
    'preserves error metadata and autoToast=%s across serialization',
    async (autoToast) => {
      const error = Object.assign(new Error('Insufficient native balance'), {
        code: 1234,
        key: 'global.test',
        info: { symbol: 'ETH' },
        autoToast,
        requestId: 'request-test',
        httpStatusCode: 400,
        data: { requestUrl: '/wallet/estimate-fee', required: '0.01' },
        $$autoToastErrorTriggered: true,
        config: { headers: { Authorization: 'must-not-be-copied' } },
      });
      const result = await runSwapPreviewTask(() => Promise.reject(error));
      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('Authorization');
      expect(error.autoToast).toBe(autoToast);
      await expect(
        unwrapSwapPreviewTask(Promise.resolve(JSON.parse(serialized))),
      ).rejects.toMatchObject({
        message: error.message,
        code: error.code,
        key: error.key,
        info: error.info,
        requestId: error.requestId,
        httpStatusCode: error.httpStatusCode,
        data: error.data,
        $$autoToastErrorTriggered: true,
        ...(autoToast !== undefined ? { autoToast } : {}),
      });
    },
  );

  it('retains cancellation semantics without mutating the original error', async () => {
    const error = new CanceledError('review closed');
    const result = await runSwapPreviewTask(() => Promise.reject(error));
    const restored = JSON.parse(JSON.stringify(result)) as typeof result;
    expect(restored.ok).toBe(false);
    if (!restored.ok) {
      expect(isRequestCanceledError(restored.error)).toBe(true);
      expect(errorToastUtils.isUserCancelStyleError(restored.error)).toBe(true);
      expect(restored.error.className).toBe(
        EOneKeyErrorClassNames.AxiosAbortCancelError,
      );
    }
    expect(error).not.toHaveProperty('className');
  });

  it('preserves successful data and readable non-Error failures', async () => {
    const value = { nonce: 0 };
    await expect(
      unwrapSwapPreviewTask(runSwapPreviewTask(async () => value)),
    ).resolves.toBe(value);
    await expect(
      unwrapSwapPreviewTask(
        runSwapPreviewTask(() => Promise.reject(new Error('offline'))),
      ),
    ).rejects.toThrow('offline');
    await expect(
      unwrapSwapPreviewTask(
        runSwapPreviewTask(() => {
          // eslint-disable-next-line prefer-promise-reject-errors
          return Promise.reject('offline');
        }),
      ),
    ).rejects.toThrow('offline');
  });
});
