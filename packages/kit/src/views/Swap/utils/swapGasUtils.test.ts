import type {
  IFetchBuildTxResponse,
  IFetchQuoteResult,
  ISwapGasInfo,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import {
  applyEvmThorSwapGasLimit,
  canReuseSwapReviewGasInfo,
  getEvmThorSwapGasLimit,
  isSwapGasAccountCandidate,
  isSwapGasAccountSponsored,
  isSwapGasSponsored,
  isSwapMegafuelSponsored,
  shouldRequestSwapGasAccount,
} from './swapGasUtils';

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

describe('applyEvmThorSwapGasLimit (OK-64754)', () => {
  const buildTx = {
    result: { gasLimit: 241_020, gasAccountEnabled: true },
    thorSwapCallData: { vault: '0xvault', amount: '1' },
  } as IFetchBuildTxResponse;
  const gasInfo: ISwapGasInfo = {
    payer: 'user',
    gas: { gasPrice: '2', gasLimit: '30748', gasLimitForDisplay: '30748' },
    gasEIP1559: {
      baseFeePerGas: '1',
      maxFeePerGas: '2',
      maxPriorityFeePerGas: '1',
      gasLimit: '30748',
      gasLimitForDisplay: '30748',
    },
  };
  const apply = (
    overrides: Partial<Parameters<typeof applyEvmThorSwapGasLimit>[0]> = {},
  ) =>
    applyEvmThorSwapGasLimit({
      networkId: 'evm--1',
      buildTx,
      gasInfo,
      ...overrides,
    });

  it('raises both fee types and their display limit without changing gas prices', () => {
    const result = apply();
    expect(result.gas).toEqual({
      ...gasInfo.gas,
      gasLimit: '241020',
      gasLimitForDisplay: '241020',
    });
    expect(result.gasEIP1559).toEqual({
      ...gasInfo.gasEIP1559,
      gasLimit: '241020',
      gasLimitForDisplay: '241020',
    });
    expect(gasInfo.gas?.gasLimit).toBe('30748');
    expect(apply({ gasInfo: result })).toEqual(result);
  });

  it('keeps a higher estimate and its display semantics for each fee type', () => {
    const higherGas = {
      gasPrice: '2',
      gasLimit: '300000',
      gasLimitForDisplay: '280000',
    };
    const result = apply({ gasInfo: { ...gasInfo, gas: higherGas } });
    expect(result.gas).toBe(higherGas);
    expect(result.gasEIP1559?.gasLimit).toBe('241020');
    expect(
      getEvmThorSwapGasLimit({
        networkId: 'evm--1',
        buildTx,
        isSponsored: false,
      }),
    ).toBe('241020');
  });

  it.each([undefined, 0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
    'ignores an invalid build limit: %s',
    (gasLimit) => {
      expect(
        apply({
          buildTx: { ...buildTx, result: { ...buildTx.result, gasLimit } },
        }),
      ).toBe(gasInfo);
    },
  );

  it('leaves other response shapes, non-EVM networks, and missing fees unchanged', () => {
    expect(apply({ buildTx: undefined })).toBe(gasInfo);
    expect(
      apply({ buildTx: { ...buildTx, thorSwapCallData: undefined } }),
    ).toBe(gasInfo);
    expect(apply({ networkId: 'btc--0' })).toBe(gasInfo);
    expect(apply({ gasInfo: { payer: 'user' } })).toEqual({ payer: 'user' });
  });

  it.each<ISwapGasInfo>([
    { payer: 'megafuel' },
    {
      gasAccountEligible: true,
      payer: 'gasAccount',
      gasAccountQuote: { quoteId: 'quote', maxFee: '1', expiresAt: '1' },
    },
  ])('preserves sponsored estimates', (sponsorship) => {
    const sponsored = { ...gasInfo, ...sponsorship };
    expect(apply({ gasInfo: sponsored })).toBe(sponsored);
  });

  it('honors the confirmation page effective sponsorship state', () => {
    expect(apply({ isSponsored: true })).toBe(gasInfo);
    expect(
      getEvmThorSwapGasLimit({
        networkId: 'evm--1',
        buildTx,
        isSponsored: true,
      }),
    ).toBeUndefined();
  });
});

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
