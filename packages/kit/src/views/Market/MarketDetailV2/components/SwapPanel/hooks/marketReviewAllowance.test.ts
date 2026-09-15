const mockFetchApproveAllowance = jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceSwap: {
      fetchApproveAllowance: mockFetchApproveAllowance,
    },
  },
}));

const { resolveMarketReviewAllowanceState } =
  require('./marketReviewAllowance') as typeof import('./marketReviewAllowance');

describe('marketReviewAllowance', () => {
  beforeEach(() => {
    mockFetchApproveAllowance.mockReset();
  });

  it('returns approve-required state from the latest allowance response', async () => {
    mockFetchApproveAllowance.mockResolvedValue({
      isApproved: false,
      allowanceTarget: '0xspender-next',
      shouldResetApprove: false,
    });

    const result = await resolveMarketReviewAllowanceState({
      amount: '1',
      currentState: {
        allowanceTarget: '0xspender-prev',
        shouldApprove: false,
        shouldResetApprove: false,
      },
      spenderAddress: '0xspender-prev',
      token: {
        networkId: 'evm--1',
        contractAddress: '0xtoken',
        symbol: 'USDC',
        decimals: 6,
      },
      walletAddress: '0xuser',
    });

    expect(mockFetchApproveAllowance).toHaveBeenCalledWith({
      networkId: 'evm--1',
      tokenAddress: '0xtoken',
      spenderAddress: '0xspender-prev',
      walletAddress: '0xuser',
      amount: '1',
    });
    expect(result).toEqual({
      allowanceTarget: '0xspender-next',
      shouldApprove: true,
      shouldResetApprove: false,
    });
  });

  it('fails fast when the allowance refresh fails for the same spender', async () => {
    mockFetchApproveAllowance.mockRejectedValue(new Error('network error'));

    await expect(
      resolveMarketReviewAllowanceState({
        amount: '1',
        currentState: {
          allowanceTarget: '0xspender-prev',
          shouldApprove: true,
          shouldResetApprove: true,
        },
        spenderAddress: '0xspender-prev',
        token: {
          networkId: 'evm--1',
          contractAddress: '0xtoken',
          symbol: 'USDC',
          decimals: 6,
        },
        walletAddress: '0xuser',
      }),
    ).rejects.toThrow('Market allowance refresh failed.');
  });

  it('fails fast when the allowance refresh fails for a new spender', async () => {
    mockFetchApproveAllowance.mockRejectedValue(new Error('network error'));

    await expect(
      resolveMarketReviewAllowanceState({
        amount: '1',
        currentState: {
          allowanceTarget: '0xspender-prev',
          shouldApprove: false,
          shouldResetApprove: false,
        },
        spenderAddress: '0xspender-next',
        token: {
          networkId: 'evm--1',
          contractAddress: '0xtoken',
          symbol: 'USDC',
          decimals: 6,
        },
        walletAddress: '0xuser',
      }),
    ).rejects.toThrow('Market allowance refresh failed.');
  });

  it('skips allowance refresh when approve is not applicable', async () => {
    const result = await resolveMarketReviewAllowanceState({
      amount: '0',
      currentState: {
        allowanceTarget: '0xspender-prev',
        shouldApprove: true,
        shouldResetApprove: true,
      },
      spenderAddress: '0xspender-prev',
      token: {
        networkId: 'evm--1',
        contractAddress: '0xtoken',
        symbol: 'USDC',
        decimals: 6,
      },
      walletAddress: '0xuser',
    });

    expect(mockFetchApproveAllowance).not.toHaveBeenCalled();
    expect(result).toEqual({
      allowanceTarget: '0xspender-prev',
      shouldApprove: false,
      shouldResetApprove: false,
    });
  });
});
