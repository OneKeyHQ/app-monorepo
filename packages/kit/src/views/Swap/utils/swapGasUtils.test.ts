import type {
  IFetchQuoteResult,
  ISwapTxInfo,
} from '@onekeyhq/shared/types/swap/types';

import {
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
