import type { ISwapTxInfo } from '@onekeyhq/shared/types/swap/types';

import { persistEarnSwapHistory } from './earnRouterSwapHistory';

const mockGenerate = jest.fn<
  Promise<{ durable: boolean } | undefined>,
  [unknown, unknown]
>();
jest.mock('../../../Swap/hooks/useSwapTxHistory', () => ({
  generateSwapHistoryItemForContext: (params: unknown, context: unknown) =>
    mockGenerate(params, context),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: { serviceSwap: { fetchSwapNetworks: jest.fn(async () => []) } },
}));

const params = {
  txId: 'swap-tx',
  swapInfo: {} as ISwapTxInfo,
  currencyInfo: { id: 'usd', symbol: '$' },
};

it('requires a durable history record for the accepted swap', async () => {
  mockGenerate.mockResolvedValueOnce({ durable: true });
  await expect(persistEarnSwapHistory(params)).resolves.toBeUndefined();
  expect(mockGenerate).toHaveBeenCalledWith(
    expect.objectContaining({ txId: 'swap-tx', swapTxInfo: params.swapInfo }),
    expect.objectContaining({ currencyInfo: params.currencyInfo }),
  );
});

it.each([{ durable: false }, undefined])(
  'rejects an accepted swap whose history is not durable: %p',
  async (result) => {
    mockGenerate.mockResolvedValueOnce(result);
    await expect(persistEarnSwapHistory(params)).rejects.toThrow(
      'Unable to persist Earn swap history',
    );
  },
);
