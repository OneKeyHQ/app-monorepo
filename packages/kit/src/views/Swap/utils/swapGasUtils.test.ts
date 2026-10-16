import type {
  IFetchQuoteResult,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import {
  canReuseSwapReviewGasInfo,
  getSwapGasLimit,
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

describe('getSwapGasLimit', () => {
  const providerResult = {
    originalGasLimit: 160_648,
    gasLimitRate: 1.5,
    gasLimit: 240_972,
    gasAccountEnabled: true,
  };
  const swapInfo = {
    swapBuildResData: {
      result: providerResult,
    },
  } as unknown as ISwapTxInfo;
  it.each(['evm--1', 'evm--8453', 'evm--42161'])(
    'uses the buffered gasLimit without another buffer or requiring Thor on %s',
    (networkId) => {
      expect(getSwapGasLimit({ networkId, swapInfo })).toBe('240972');
    },
  );
  it('rounds a fractional provider limit up without multiplying it again', () => {
    expect(
      getSwapGasLimit({
        networkId: 'evm--1',
        swapInfo: {
          ...swapInfo,
          swapBuildResData: {
            ...swapInfo.swapBuildResData,
            result: {
              ...swapInfo.swapBuildResData.result,
              gasLimit: 240_973.5,
            },
          },
        },
      }),
    ).toBe('240974');
  });
  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back when gasLimit is %s even if originalGasLimit is present',
    (gasLimit) => {
      expect(
        getSwapGasLimit({
          networkId: 'evm--1',
          swapInfo: {
            ...swapInfo,
            swapBuildResData: {
              ...swapInfo.swapBuildResData,
              result: { ...swapInfo.swapBuildResData.result, gasLimit },
            },
          },
        }),
      ).toBeUndefined();
    },
  );
  it('does not apply swap gas to approvals or non-EVM networks', () => {
    expect(
      getSwapGasLimit({
        networkId: 'evm--1',
        swapInfo,
        isApprove: true,
      }),
    ).toBeUndefined();
    expect(
      getSwapGasLimit({ networkId: 'sol--101', swapInfo }),
    ).toBeUndefined();
  });
  it('does not request a sponsor quote for a provider-priced transaction', async () => {
    expect(
      await shouldRequestSwapGasAccount({ networkId: 'evm--1', swapInfo }),
    ).toBe(false);
    expect(mockGetCustomRpcForNetwork).not.toHaveBeenCalled();
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
