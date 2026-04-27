import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { checkSwapLatestBalanceSufficient } from './swapBalanceUtils';

type IFetchSwapTokenDetailsParams = {
  networkId: string;
  contractAddress: string;
  accountAddress?: string;
  accountId?: string;
  currency?: string;
};

const mockFetchSwapTokenDetails: jest.MockedFunction<
  (params: IFetchSwapTokenDetailsParams) => Promise<{ balanceParsed: string }[]>
> = jest.fn();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchSwapTokenDetails: (params: IFetchSwapTokenDetailsParams) =>
        mockFetchSwapTokenDetails(params),
    },
  },
}));

const ethToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
} as ISwapToken;

describe('checkSwapLatestBalanceSufficient', () => {
  beforeEach(() => {
    mockFetchSwapTokenDetails.mockReset();
  });

  it('returns insufficient when the latest token balance is lower than amount', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue([{ balanceParsed: '0.08' }]);

    await expect(
      checkSwapLatestBalanceSufficient({
        token: ethToken,
        amount: '0.1',
        accountId: 'account-id',
        accountAddress: '0xabc',
      }),
    ).resolves.toEqual({
      isSufficient: false,
      balance: '0.08',
      requiredAmount: '0.1',
      tokenSymbol: 'ETH',
    });
  });

  it('does not block when balance cannot be fetched', async () => {
    mockFetchSwapTokenDetails.mockResolvedValue([]);

    await expect(
      checkSwapLatestBalanceSufficient({
        token: ethToken,
        amount: '0.1',
        accountId: 'account-id',
        accountAddress: '0xabc',
      }),
    ).resolves.toEqual({ isSufficient: true });
  });
});
