import type {
  IFetchQuoteResult,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import {
  canReuseSwapReviewGasInfo,
  isSwapGasAccountCandidate,
  isSwapGasAccountSponsored,
  isSwapGasSponsored,
  isSwapMegafuelSponsored,
  shouldRequestSwapGasAccount,
} from './swapGasUtils';
import {
  applySwapProviderGasLimit,
  applySwapProviderGasLimitToEstimate,
  isSwapBuildForQuote,
  parseSwapGasLimit,
  selectSwapGasLimit,
} from './swapProviderGasUtils';

const mockGetCustomRpcForNetwork: jest.MockedFunction<
  (
    networkId: string,
  ) => Promise<{ rpc?: string; enabled?: boolean } | undefined>
> = jest.fn();

jest.mock('../../../background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceCustomRpc: {
      getCustomRpcForNetwork: (networkId: string) =>
        mockGetCustomRpcForNetwork(networkId),
    },
  },
}));

describe('isSwapGasSponsored', () => {
  it('recognizes final estimate-fee sponsorship signals', () => {
    expect(
      isSwapGasSponsored({
        gasAccountEligible: true,
        payer: 'gasAccount',
        gasAccountQuote: {
          quoteId: 'quote-id',
          maxFee: '1',
          expiresAt: String(Date.now() + 60_000),
        },
      }),
    ).toBe(true);
    expect(
      isSwapGasSponsored({
        megafuelEligible: { sponsorable: true, sponsorName: 'OneKey' },
      }),
    ).toBe(true);
    expect(isSwapGasSponsored({ payer: 'megafuel' })).toBe(true);
  });

  it('does not mark a user-paid fee as sponsored', () => {
    expect(isSwapGasSponsored({ gasAccountEligible: true })).toBe(false);
    expect(
      isSwapGasSponsored({
        gasAccountEligible: true,
        payer: 'gasAccount',
      }),
    ).toBe(false);
    expect(isSwapGasSponsored({ payer: 'user' })).toBe(false);
    expect(isSwapGasSponsored()).toBe(false);
  });

  it('separates MegaFuel sponsorship from Gas Account sponsorship', () => {
    expect(isSwapMegafuelSponsored({ gasAccountEligible: true })).toBe(false);
    expect(isSwapMegafuelSponsored({ payer: 'megafuel' })).toBe(true);
    expect(isSwapGasAccountSponsored({ gasAccountEligible: true })).toBe(false);
    expect(
      isSwapGasAccountSponsored({
        gasAccountEligible: true,
        payer: 'gasAccount',
        gasAccountQuote: {
          quoteId: 'quote-id',
          maxFee: '1',
          expiresAt: String(Date.now() + 60_000),
        },
      }),
    ).toBe(true);
  });
});

describe('isSwapGasAccountCandidate (OK-62562)', () => {
  const sponsoredSwapInfo = {
    swapBuildResData: { result: { gasAccountEnabled: true } },
  } as unknown as ISwapTxInfo;

  it('requires the backend provider pre-check', () => {
    expect(isSwapGasAccountCandidate({ swapInfo: undefined })).toBe(false);
    expect(
      isSwapGasAccountCandidate({
        swapInfo: {
          swapBuildResData: { result: {} },
        } as unknown as ISwapTxInfo,
      }),
    ).toBe(false);
  });

  it('accepts a single swap tx without approval', () => {
    expect(isSwapGasAccountCandidate({ swapInfo: sponsoredSwapInfo })).toBe(
      true,
    );
    expect(
      isSwapGasAccountCandidate({
        swapInfo: sponsoredSwapInfo,
        quoteResult: { allowanceResult: undefined } as IFetchQuoteResult,
        hasApproveTx: false,
      }),
    ).toBe(true);
  });

  it('opts out when the review bundles approve txs', () => {
    expect(
      isSwapGasAccountCandidate({
        swapInfo: sponsoredSwapInfo,
        hasApproveTx: true,
      }),
    ).toBe(false);
  });

  it('opts out when the quote still needs an allowance', () => {
    const allowanceResult = { allowanceTarget: '0xspender', amount: '0' };
    expect(
      isSwapGasAccountCandidate({
        swapInfo: sponsoredSwapInfo,
        quoteResult: { allowanceResult } as unknown as IFetchQuoteResult,
      }),
    ).toBe(false);
    expect(
      isSwapGasAccountCandidate({
        swapInfo: {
          swapBuildResData: {
            result: { gasAccountEnabled: true, allowanceResult },
          },
        } as unknown as ISwapTxInfo,
      }),
    ).toBe(false);
  });
});

describe('shouldRequestSwapGasAccount (OK-62562)', () => {
  const sponsoredSwapInfo = {
    swapBuildResData: { result: { gasAccountEnabled: true } },
  } as unknown as ISwapTxInfo;

  beforeEach(() => {
    mockGetCustomRpcForNetwork.mockReset();
  });

  it('requests sponsorship when no custom RPC is enabled', async () => {
    mockGetCustomRpcForNetwork.mockResolvedValueOnce(undefined);
    await expect(
      shouldRequestSwapGasAccount({
        networkId: 'evm--1',
        swapInfo: sponsoredSwapInfo,
      }),
    ).resolves.toBe(true);

    mockGetCustomRpcForNetwork.mockResolvedValueOnce({
      rpc: 'https://rpc.example.com',
      enabled: false,
    });
    await expect(
      shouldRequestSwapGasAccount({
        networkId: 'evm--1',
        swapInfo: sponsoredSwapInfo,
      }),
    ).resolves.toBe(true);
    expect(mockGetCustomRpcForNetwork).toHaveBeenCalledWith('evm--1');
  });

  it('skips the request when a custom RPC is enabled for the network', async () => {
    mockGetCustomRpcForNetwork.mockResolvedValueOnce({
      rpc: 'https://rpc.example.com',
      enabled: true,
    });
    await expect(
      shouldRequestSwapGasAccount({
        networkId: 'evm--1',
        swapInfo: sponsoredSwapInfo,
      }),
    ).resolves.toBe(false);
  });

  it('falls back to user-paid gas when the custom RPC lookup fails', async () => {
    mockGetCustomRpcForNetwork.mockRejectedValueOnce(
      new Error('custom rpc storage unavailable'),
    );
    await expect(
      shouldRequestSwapGasAccount({
        networkId: 'evm--1',
        swapInfo: sponsoredSwapInfo,
      }),
    ).resolves.toBe(false);
  });

  it('does not look up the custom RPC for a non-candidate swap', async () => {
    await expect(
      shouldRequestSwapGasAccount({
        networkId: 'evm--1',
        swapInfo: sponsoredSwapInfo,
        hasApproveTx: true,
      }),
    ).resolves.toBe(false);
    expect(mockGetCustomRpcForNetwork).not.toHaveBeenCalled();
  });
});

describe('canReuseSwapReviewGasInfo (OK-62562)', () => {
  const userPaidGasInfo = {
    payer: 'user',
    gas: { gasPrice: '1', gasLimit: '21000' },
  } as const;
  const gasAccountSponsoredGasInfo = {
    payer: 'gasAccount',
    gasAccountEligible: true,
    gasAccountQuote: {
      quoteId: 'review-quote-id',
      maxFee: '1',
      expiresAt: String(Date.now() + 60_000),
    },
  } as const;

  it('reuses a user-paid review gas when the send requests no sponsorship', () => {
    expect(
      canReuseSwapReviewGasInfo({
        cachedGasInfo: userPaidGasInfo,
        isGasAccountEnabled: false,
      }),
    ).toBe(true);
  });

  it('re-estimates when there is no cached gas or the step needs fresh gas', () => {
    expect(
      canReuseSwapReviewGasInfo({
        cachedGasInfo: undefined,
        isGasAccountEnabled: false,
      }),
    ).toBe(false);
    expect(
      canReuseSwapReviewGasInfo({
        cachedGasInfo: userPaidGasInfo,
        needFetchGas: true,
        isGasAccountEnabled: false,
      }),
    ).toBe(false);
  });

  it('re-estimates for a fresh quote when the send requests Gas Account', () => {
    expect(
      canReuseSwapReviewGasInfo({
        cachedGasInfo: gasAccountSponsoredGasInfo,
        isGasAccountEnabled: true,
      }),
    ).toBe(false);
  });

  it('never reuses a cached Gas Account sponsorship once the send stops requesting it', () => {
    // e.g. a custom RPC was enabled after the review: the review quote must
    // not reach the custom RPC broadcast, so the send re-estimates user-paid.
    expect(
      canReuseSwapReviewGasInfo({
        cachedGasInfo: gasAccountSponsoredGasInfo,
        isGasAccountEnabled: false,
      }),
    ).toBe(false);
  });

  it('keeps reusing a MegaFuel review gas, which needs no fresh quote', () => {
    expect(
      canReuseSwapReviewGasInfo({
        cachedGasInfo: { payer: 'megafuel' },
        isGasAccountEnabled: false,
      }),
    ).toBe(true);
  });
});

describe('EVM swap provider gas floor', () => {
  const token = {
    networkId: 'evm--1',
    contractAddress: '',
    isNative: true,
    symbol: 'ETH',
    decimals: 18,
  };
  const result: IFetchQuoteResult = {
    quoteId: 'gas-build',
    fromTokenInfo: token,
    toTokenInfo: token,
    fromAmount: '0.02',
    toAmount: '0.02',
    info: { provider: 'Chainflip', providerName: 'Chainflip' },
    gasLimit: 240_996,
  } as IFetchQuoteResult;
  const swapInfo: ISwapTxInfo = {
    sender: {
      token,
      amount: '0.02',
      accountInfo: { accountId: 'test-account', networkId: 'evm--1' },
    },
    receiver: {
      token,
      amount: '0.02',
      accountInfo: { accountId: 'test-account', networkId: 'evm--1' },
    },
    accountAddress: '0x1111111111111111111111111111111111111111',
    receivingAddress: '0x1111111111111111111111111111111111111111',
    swapBuildResData: {
      result,
      tx: {
        to: '0x2222222222222222222222222222222222222222',
        value: '20000000000000000',
        data: '0x1234',
      },
    },
  } as ISwapTxInfo;
  const encodedTx = {
    from: swapInfo.accountAddress,
    to: '0x2222222222222222222222222222222222222222',
    value: '0x470de4df820000',
    data: '0x1234',
    chainId: '0x1',
  };
  const context = {
    networkId: 'evm--1',
    accountId: 'test-account',
    swapInfo,
    encodedTx,
  };

  it.each([
    undefined,
    null,
    '',
    '1e6',
    '0x3ad64',
    '240996 wei',
    ' 240996',
    0,
    -1,
    240_996.5,
    NaN,
    Infinity,
    -Infinity,
    1e12,
    Number.MAX_SAFE_INTEGER + 1,
  ])('rejects malformed provider gas %s', (value) => {
    expect(parseSwapGasLimit(value)).toBeUndefined();
    expect(selectSwapGasLimit('30748', value)).toBe('30748');
  });
  it.each([
    [30_748, 240_996],
    [300_000, 300_000],
  ])('selects max(node %i, already-adjusted provider)', (node, expected) => {
    expect(selectSwapGasLimit(String(node), 240_996)).toBe(String(expected));
  });
  it.each(['0', 'NaN', 'Infinity', '-1', '21000.5'])(
    'does not manufacture a successful node estimate from %s',
    (node) => {
      expect(selectSwapGasLimit(node, 240_996)).toBe(node);
    },
  );
  it('updates legacy gas and display without multiplying or changing the price', () => {
    const adjusted = applySwapProviderGasLimit({
      ...context,
      gasInfo: {
        gas: { gasLimit: '30748', gasLimitForDisplay: '30748', gasPrice: '2' },
      },
    });
    expect(adjusted.gas).toEqual({
      gasLimit: '240996',
      gasLimitForDisplay: '240996',
      gasPrice: '2',
    });
  });
  it('updates EIP-1559 gas and display while preserving fee sources', () => {
    const gas = {
      gasLimit: '30748',
      gasLimitForDisplay: '30748',
      baseFeePerGas: '1',
      maxFeePerGas: '3',
      maxPriorityFeePerGas: '2',
    };
    expect(
      applySwapProviderGasLimit({ ...context, gasInfo: { gasEIP1559: gas } })
        .gasEIP1559,
    ).toEqual({ ...gas, gasLimit: '240996', gasLimitForDisplay: '240996' });
  });
  it.each([
    { networkId: 'evm--56' },
    { accountId: 'other-account' },
    { encodedTx: { ...encodedTx, from: encodedTx.to } },
    { encodedTx: { ...encodedTx, to: encodedTx.from } },
    { encodedTx: { ...encodedTx, data: '0xabcd' } },
    { encodedTx: { ...encodedTx, value: '0x0' } },
    { encodedTx: { ...encodedTx, chainId: '0x38' } },
    { swapInfo: undefined },
    { networkId: 'sol--101' },
  ])('ignores a floor for mismatched transaction context %j', (override) => {
    const gasInfo = { gas: { gasLimit: '30748', gasPrice: '2' } };
    expect(
      applySwapProviderGasLimit({ ...context, ...override, gasInfo }),
    ).toBe(gasInfo);
  });
  it('uses a proven current payload even when the build has no quoteId', () => {
    const current = {
      ...swapInfo,
      swapBuildResData: {
        ...swapInfo.swapBuildResData,
        result: { ...result, quoteId: undefined },
      },
    };
    expect(
      applySwapProviderGasLimit({
        ...context,
        swapInfo: current,
        gasInfo: { gas: { gasLimit: '30748', gasPrice: '2' } },
      }).gas?.gasLimit,
    ).toBe('240996');
  });
  it('validates the actual payload when optional build fromAmount is absent', () => {
    const current = {
      ...swapInfo,
      swapBuildResData: {
        ...swapInfo.swapBuildResData,
        result: { ...result, fromAmount: undefined },
      },
    };
    expect(
      applySwapProviderGasLimit({
        ...context,
        swapInfo: current,
        gasInfo: { gas: { gasLimit: '30748', gasPrice: '2' } },
      }).gas?.gasLimit,
    ).toBe('240996');
  });
  it('invalidates an eligible but unselected sponsor quote after gas changes', () => {
    const adjusted = applySwapProviderGasLimit({
      ...context,
      gasInfo: {
        payer: 'user',
        gasAccountEligible: true,
        gasAccountQuote: {
          quoteId: 'old',
          maxFee: '1',
          expiresAt: '9999999999',
        },
        gas: { gasLimit: '30748', gasPrice: '2' },
      },
    });
    expect(adjusted.gasAccountEligible).toBe(false);
    expect(adjusted.gasAccountQuote).toBeUndefined();
  });
  it('does not reuse a build after a route, provider, or quote identity change', () => {
    for (const changed of [
      { quoteId: undefined },
      { quoteId: 'new' },
      { quoteResultCtx: { route: 'new' } },
      { info: { provider: 'other', providerName: 'other' } },
    ]) {
      expect(
        isSwapBuildForQuote({
          ...context,
          accountAddress: encodedTx.from,
          quoteResult: { ...result, ...changed },
        }),
      ).toBe(false);
    }
  });
  it('drops the stale sponsor quote and restores all legacy fee levels', () => {
    const feesInfo = {
      payer: 'megafuel' as const,
      megafuelEligible: { sponsorable: true, sponsorName: 'test' },
      gas: [
        { gasLimit: '30748', gasPrice: '0', originalGasPrice: '1' },
        { gasLimit: '300000', gasPrice: '0', originalGasPrice: '2' },
      ],
    };
    const adjusted = applySwapProviderGasLimitToEstimate({
      ...context,
      feesInfo,
    });
    expect(adjusted.payer).toBe('user');
    expect(adjusted.megafuelEligible).toBeUndefined();
    expect(adjusted.gas?.map((item) => [item.gasLimit, item.gasPrice])).toEqual(
      [
        ['240996', '1'],
        ['300000', '2'],
      ],
    );
  });
  it('fails closed when a changed sponsor payload has no user gas price', () => {
    expect(() =>
      applySwapProviderGasLimit({
        ...context,
        gasInfo: {
          payer: 'megafuel',
          gas: { gasLimit: '30748', gasPrice: '0' },
        },
      }),
    ).toThrow();
  });
  it('does not create fees when node estimation supplied no gas', () => {
    const gasInfo = {};
    expect(applySwapProviderGasLimit({ ...context, gasInfo })).toBe(gasInfo);
  });
});
