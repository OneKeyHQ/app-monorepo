/* eslint-disable import/first */

jest.mock('@onekeyhq/shared/src/utils/timerUtils', () => ({
  __esModule: true,
  default: {
    wait: jest.fn(async () => undefined),
  },
}));

import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { pollSolTxFinalization } from './pollSolTxFinalization';

describe('pollSolTxFinalization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('retries on transient RPC errors and resolves finalized once available', async () => {
    const onStatusError = jest.fn();
    const getSignatureStatuses = jest
      .fn()
      .mockRejectedValueOnce(new Error('rpc unavailable'))
      .mockResolvedValueOnce([{ confirmationStatus: 'finalized' }]);

    await expect(
      pollSolTxFinalization({
        txId: 'tx-id',
        maxAttempts: 2,
        intervalMs: 10,
        getSignatureStatuses,
        onStatusError,
      }),
    ).resolves.toBe('finalized');

    expect(onStatusError).toHaveBeenCalledTimes(1);
    expect(timerUtils.wait).toHaveBeenCalledTimes(1);
  });

  it('returns timeout instead of throwing when every status request errors', async () => {
    const getSignatureStatuses = jest
      .fn()
      .mockRejectedValue(new Error('rpc unavailable'));

    await expect(
      pollSolTxFinalization({
        txId: 'tx-id',
        maxAttempts: 2,
        intervalMs: 10,
        getSignatureStatuses,
      }),
    ).resolves.toBe('timeout');
  });
});
