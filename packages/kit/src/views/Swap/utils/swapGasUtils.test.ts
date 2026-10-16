import { FailedToEstimatedGasError } from '@onekeyhq/shared/src/errors';
import type {
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
  resolveEvmThorSwapGasInfo,
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

describe('EVM Thor build gas limit', () => {
  const swapInfo = {
    swapBuildResData: {
      thorSwapCallData: { vault: '0xvault', amount: '20000000000000000' },
      result: {
        gasLimit: 240_972,
        originalGasLimit: 160_648,
        gasLimitRate: 1.5,
      },
    },
  } as unknown as ISwapTxInfo;
  const params = { networkId: 'evm--1', accountId: 'hd-review--0', swapInfo };

  it('uses the buffered build limit exactly once', () => {
    const gasInfo = {
      common: { baseFee: '123' },
      gas: { gasPrice: '7', gasLimit: '30748', gasLimitForDisplay: '25623' },
    };
    const result = applyEvmThorSwapGasLimit({ ...params, gasInfo });
    expect(result.gas).toEqual({
      gasPrice: '7',
      gasLimit: '240972',
      gasLimitForDisplay: '240972',
    });
    expect(result.common).toBe(gasInfo.common);
    expect(gasInfo.gas.gasLimit).toBe('30748');
    expect(applyEvmThorSwapGasLimit({ ...params, gasInfo: result })).toEqual(
      result,
    );
  });

  it('preserves EIP-1559 tier prices and count when updating defaults', () => {
    const gasInfo = {
      gasEIP1559: [1, 2, 3, 4, 5].map((priority) => ({
        baseFeePerGas: '10',
        maxFeePerGas: `${10 + priority}`,
        maxPriorityFeePerGas: `${priority}`,
        gasLimit: '30748',
        gasLimitForDisplay: '25623',
      })),
    };
    const result = applyEvmThorSwapGasLimit({ ...params, gasInfo });
    expect(result.gasEIP1559).toHaveLength(5);
    expect(result.gasEIP1559).toEqual(
      gasInfo.gasEIP1559.map((fee) => ({
        ...fee,
        gasLimit: '240972',
        gasLimitForDisplay: '240972',
      })),
    );
  });

  it.each([
    {
      payer: 'gasAccount' as const,
      gasAccountQuote: {
        quoteId: 'bound-quote',
        maxFee: '1',
        expiresAt: '999',
      },
    },
    { payer: 'megafuel' as const },
    { megafuelEligible: { sponsorable: true, sponsorName: 'sponsor' } },
  ])('keeps a sponsored limit and its binding unchanged: %j', (sponsorship) => {
    const gasInfo = {
      gas: { gasPrice: '1', gasLimit: '50000' },
      ...sponsorship,
    };
    expect(applyEvmThorSwapGasLimit({ ...params, gasInfo })).toBe(gasInfo);
  });

  it('preserves MegaFuel zero-fee tiers when sponsor flags were not retained', () => {
    const gas = { gasPrice: '0', originalGasPrice: '7', gasLimit: '50000' };
    for (const gasInfo of [{ gas }, { gas: [gas] }]) {
      expect(applyEvmThorSwapGasLimit({ ...params, gasInfo })).toBe(gasInfo);
    }
    expect(
      applyEvmThorSwapGasLimit({
        ...params,
        gasInfo: { gas: { ...gas, gasPrice: '7' } },
      }).gas.gasLimit,
    ).toBe('240972');
  });

  it('uses the resolved payer when the confirm page disables sponsorship', () => {
    const gasInfo = {
      payer: 'gasAccount' as const,
      gasAccountQuote: {
        quoteId: 'unused-quote',
        maxFee: '1',
        expiresAt: '999',
      },
      gas: { gasPrice: '7', gasLimit: '50000' },
    };
    const result = applyEvmThorSwapGasLimit({
      ...params,
      gasInfo,
      isSponsored: false,
    });
    expect(result.gas).toEqual({
      gasPrice: '7',
      gasLimit: '240972',
      gasLimitForDisplay: '240972',
    });
    expect(result.gasAccountQuote).toBe(gasInfo.gasAccountQuote);
    expect(
      applyEvmThorSwapGasLimit({ ...params, gasInfo, isSponsored: true }),
    ).toBe(gasInfo);
  });

  it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'leaves estimation unchanged for invalid build gasLimit %s',
    (gasLimit) => {
      const gasInfo = { gas: { gasPrice: '7', gasLimit: '30748' } };
      const input = {
        ...params,
        gasInfo,
        swapInfo: {
          ...swapInfo,
          swapBuildResData: {
            ...swapInfo.swapBuildResData,
            result: { ...swapInfo.swapBuildResData.result, gasLimit },
          },
        },
      };
      expect(getEvmThorSwapGasLimit(input)).toBeUndefined();
      expect(applyEvmThorSwapGasLimit(input)).toBe(gasInfo);
    },
  );

  it('rounds a fractional provider buffer up without applying another buffer', () => {
    expect(
      getEvmThorSwapGasLimit({
        ...params,
        swapInfo: {
          ...swapInfo,
          swapBuildResData: {
            ...swapInfo.swapBuildResData,
            result: {
              ...swapInfo.swapBuildResData.result,
              gasLimit: 240_972.5,
            },
          },
        },
      }),
    ).toBe('240973');
  });

  it('excludes approvals, non-EVM networks and other build formats', () => {
    expect(
      getEvmThorSwapGasLimit({ ...params, isApprove: true }),
    ).toBeUndefined();
    expect(
      getEvmThorSwapGasLimit({ ...params, networkId: 'btc--0' }),
    ).toBeUndefined();
    expect(
      getEvmThorSwapGasLimit({
        ...params,
        swapInfo: {
          ...swapInfo,
          swapBuildResData: {
            ...swapInfo.swapBuildResData,
            thorSwapCallData: undefined,
            tx: { to: '0xrouter', data: '0x1234', value: '0x0' },
          },
        },
      }),
    ).toBeUndefined();
  });

  describe('resolveEvmThorSwapGasInfo', () => {
    const sponsoredGasInfo = {
      gas: {
        gasPrice: '0',
        originalGasPrice: '7',
        gasLimit: '50000',
        gasLimitForDisplay: '45000',
      },
      payer: 'megafuel',
      megafuelEligible: { sponsorable: true, sponsorName: 'OneKey' },
      gasAccountEligible: true,
      gasAccountQuote: {
        quoteId: 'bound-quote',
        maxFee: '1',
        expiresAt: '999',
      },
    } satisfies ISwapGasInfo;

    beforeEach(() => {
      mockGetCustomRpcForNetwork.mockReset();
      mockGetCustomRpcForNetwork.mockResolvedValue({
        rpc: 'https://rpc.example.com',
        enabled: true,
      });
    });

    it('restores user-paid gas for custom RPC without mutating the cached sponsor fee', async () => {
      const gasInfo = Object.freeze({
        ...sponsoredGasInfo,
        gas: Object.freeze({ ...sponsoredGasInfo.gas }),
      });
      const result = await resolveEvmThorSwapGasInfo({ ...params, gasInfo });

      expect(result).toEqual({
        ...gasInfo,
        gas: {
          ...gasInfo.gas,
          gasPrice: '7',
          gasLimit: '240972',
          gasLimitForDisplay: '240972',
        },
        payer: 'user',
        megafuelEligible: undefined,
        gasAccountEligible: false,
        gasAccountQuote: undefined,
      });
      expect(mockGetCustomRpcForNetwork).toHaveBeenCalledWith('evm--1');
      expect(gasInfo).toEqual(sponsoredGasInfo);
      await expect(
        resolveEvmThorSwapGasInfo({ ...params, gasInfo: result }),
      ).resolves.toEqual(result);
    });

    it('preserves an already selected nonzero custom gas price', async () => {
      const result = await resolveEvmThorSwapGasInfo({
        ...params,
        gasInfo: {
          ...sponsoredGasInfo,
          gas: { ...sponsoredGasInfo.gas, gasPrice: '11' },
        },
      });
      expect(result.gas).toEqual({
        ...sponsoredGasInfo.gas,
        gasPrice: '11',
        gasLimit: '240972',
        gasLimitForDisplay: '240972',
      });
      expect(result.payer).toBe('user');
    });

    it.each([false, true])(
      'uses paid fees for external wallets even with useDefaultRpc=%s',
      async (useDefaultRpc) => {
        const result = await resolveEvmThorSwapGasInfo({
          ...params,
          accountId: 'external--review',
          gasInfo: sponsoredGasInfo,
          useDefaultRpc,
        });
        expect(result).toEqual(
          expect.objectContaining({
            payer: 'user',
            megafuelEligible: undefined,
            gasAccountEligible: false,
            gasAccountQuote: undefined,
            gas: {
              ...sponsoredGasInfo.gas,
              gasPrice: '7',
              gasLimit: '240972',
              gasLimitForDisplay: '240972',
            },
          }),
        );
        expect(mockGetCustomRpcForNetwork).not.toHaveBeenCalled();
      },
    );

    it.each([
      { customValue: '12', expectedPrice: '12' },
      { customValue: '0', expectedPrice: '7' },
      { customValue: '-1', expectedPrice: '7' },
      { customValue: 'NaN', expectedPrice: '7' },
      { customValue: '1001', expectedPrice: '7' },
    ])(
      'applies external custom price $customValue after restoring the regular fee',
      async ({ customValue, expectedPrice }) => {
        const request = {
          ...params,
          accountId: 'external--review',
          gasInfo: sponsoredGasInfo,
          customPriorityFee: { customValue },
        };
        const result = await resolveEvmThorSwapGasInfo(request);
        expect(result.gas).toEqual({
          ...sponsoredGasInfo.gas,
          gasPrice: expectedPrice,
          gasLimit: '240972',
          gasLimitForDisplay: '240972',
        });
        expect(result.payer).toBe('user');
        expect(result.gasAccountQuote).toBeUndefined();
        expect(sponsoredGasInfo.gas.gasPrice).toBe('0');
        await expect(
          resolveEvmThorSwapGasInfo({ ...request, gasInfo: result }),
        ).resolves.toEqual(result);
      },
    );

    it.each([undefined, 0])(
      'keeps the external custom price without a valid build limit: %s',
      async (gasLimit) => {
        const result = await resolveEvmThorSwapGasInfo({
          ...params,
          accountId: 'external--review',
          gasInfo: sponsoredGasInfo,
          customPriorityFee: { customValue: '12' },
          swapInfo: {
            ...swapInfo,
            swapBuildResData: {
              ...swapInfo.swapBuildResData,
              result: { ...swapInfo.swapBuildResData.result, gasLimit },
            },
          },
        });
        expect(result.gas).toEqual({
          ...sponsoredGasInfo.gas,
          gasPrice: '12',
        });
      },
    );

    it('keeps external EIP-1559 custom fees stable across preview and send', async () => {
      const request = {
        ...params,
        accountId: 'external--review',
        customPriorityFee: { customValue: '12' },
        gasInfo: {
          ...sponsoredGasInfo,
          gasEIP1559: {
            baseFeePerGas: '10',
            maxFeePerGas: '22',
            maxPriorityFeePerGas: '2',
            gasLimit: '50000',
            gasLimitForDisplay: '45000',
          },
        },
      };
      const preview = await resolveEvmThorSwapGasInfo(request);
      expect(preview.gas?.gasPrice).toBe('7');
      expect(preview.gasEIP1559).toEqual({
        baseFeePerGas: '10',
        maxFeePerGas: '32',
        maxPriorityFeePerGas: '12',
        gasLimit: '240972',
        gasLimitForDisplay: '240972',
      });
      await expect(
        resolveEvmThorSwapGasInfo({ ...request, gasInfo: preview }),
      ).resolves.toEqual(preview);
    });

    it('restores a zero-price tier even when sponsor flags were not retained', async () => {
      const result = await resolveEvmThorSwapGasInfo({
        ...params,
        gasInfo: { gas: sponsoredGasInfo.gas },
      });
      expect(result.gas).toEqual({
        ...sponsoredGasInfo.gas,
        gasPrice: '7',
        gasLimit: '240972',
        gasLimitForDisplay: '240972',
      });
      expect(result.payer).toBe('user');
    });

    it('clears stale MegaFuel flags for a paid custom price without disabling Gas Account', async () => {
      const gasInfo = {
        ...sponsoredGasInfo,
        gas: { ...sponsoredGasInfo.gas, gasPrice: '12' },
      };
      const paid = await resolveEvmThorSwapGasInfo({
        ...params,
        gasInfo,
        useDefaultRpc: true,
      });
      expect(paid.payer).toBe('user');
      expect(paid.megafuelEligible).toBeUndefined();
      expect(paid.gas).toEqual({
        ...gasInfo.gas,
        gasLimit: '240972',
        gasLimitForDisplay: '240972',
      });
      const gasAccountInfo = { ...gasInfo, payer: 'gasAccount' as const };
      await expect(
        resolveEvmThorSwapGasInfo({
          ...params,
          gasInfo: gasAccountInfo,
          useDefaultRpc: true,
        }),
      ).resolves.toBe(gasAccountInfo);
    });

    it.each([undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
      'still restores user-paid fees when the build gasLimit is %s',
      async (gasLimit) => {
        const result = await resolveEvmThorSwapGasInfo({
          ...params,
          gasInfo: sponsoredGasInfo,
          swapInfo: {
            ...swapInfo,
            swapBuildResData: {
              ...swapInfo.swapBuildResData,
              result: { ...swapInfo.swapBuildResData.result, gasLimit },
            },
          },
        });
        expect(result).toEqual({
          ...sponsoredGasInfo,
          gas: { ...sponsoredGasInfo.gas, gasPrice: '7' },
          payer: 'user',
          megafuelEligible: undefined,
          gasAccountEligible: false,
          gasAccountQuote: undefined,
        });
      },
    );

    it.each([
      undefined,
      { rpc: 'https://rpc.example.com', enabled: false },
      { enabled: true },
    ])(
      'preserves valid sponsorship without an active custom RPC: %j',
      async (rpcInfo) => {
        mockGetCustomRpcForNetwork.mockResolvedValue(rpcInfo);
        for (const gasInfo of [
          sponsoredGasInfo,
          {
            ...sponsoredGasInfo,
            payer: 'gasAccount' as const,
            megafuelEligible: undefined,
            gas: { ...sponsoredGasInfo.gas, gasPrice: '7' },
          },
        ]) {
          await expect(
            resolveEvmThorSwapGasInfo({
              ...params,
              gasInfo,
              customPriorityFee: { customValue: '12' },
            }),
          ).resolves.toBe(gasInfo);
        }
      },
    );

    it('keeps the sponsored quote when Market explicitly uses the default RPC', async () => {
      await expect(
        resolveEvmThorSwapGasInfo({
          ...params,
          gasInfo: sponsoredGasInfo,
          useDefaultRpc: true,
        }),
      ).resolves.toBe(sponsoredGasInfo);
      expect(mockGetCustomRpcForNetwork).not.toHaveBeenCalled();
    });

    it.each([
      { ...params, isApprove: true },
      { ...params, networkId: 'btc--0' },
      {
        ...params,
        swapInfo: {
          ...swapInfo,
          swapBuildResData: {
            ...swapInfo.swapBuildResData,
            thorSwapCallData: undefined,
          },
        },
      },
    ])(
      'does not inspect RPC settings outside the Thor swap scope: %j',
      async (input) => {
        await expect(
          resolveEvmThorSwapGasInfo({
            ...input,
            accountId: 'external--review',
            gasInfo: sponsoredGasInfo,
            customPriorityFee: { customValue: '12' },
          }),
        ).resolves.toBe(sponsoredGasInfo);
        expect(mockGetCustomRpcForNetwork).not.toHaveBeenCalled();
      },
    );

    it.each([undefined, '', '0', '-1', 'NaN', 'Infinity'])(
      'rejects sponsored zero-price gas when its originalGasPrice is %s',
      async (originalGasPrice) => {
        await expect(
          resolveEvmThorSwapGasInfo({
            ...params,
            gasInfo: {
              ...sponsoredGasInfo,
              gas: { ...sponsoredGasInfo.gas, originalGasPrice },
            },
          }),
        ).rejects.toThrow(FailedToEstimatedGasError);
      },
    );
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
