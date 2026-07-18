import { sha256 as sha256ByNoble } from '@noble/hashes/sha256';
import { bytesToHex } from '@noble/hashes/utils';

import { ESwapQuoteKind } from '../../types/swap/types';

import bufferUtils from './bufferUtils';
import { stableStringify } from './stringUtils';
import { getSwapTokenIdentityKey } from './swapTokenIdentity';

import type { IFetchSwapQuoteParams } from '../../types/swap/types';

function buildSwapQuoteCanonicalRequest(
  request: IFetchSwapQuoteParams,
  slippage: unknown,
  {
    includeBlockNumber,
    includeInactiveAmount,
  }: {
    includeBlockNumber: boolean;
    includeInactiveAmount: boolean;
  },
) {
  const kind = request.kind ?? ESwapQuoteKind.SELL;
  return {
    protocol: request.protocol,
    kind,
    fromTokenIdentity: getSwapTokenIdentityKey(request.fromToken),
    toTokenIdentity: getSwapTokenIdentityKey(request.toToken),
    fromTokenAmount:
      includeInactiveAmount || kind === ESwapQuoteKind.SELL
        ? request.fromTokenAmount
        : undefined,
    toTokenAmount:
      includeInactiveAmount || kind === ESwapQuoteKind.BUY
        ? request.toTokenAmount
        : undefined,
    accountId: request.accountId,
    userAddress: request.userAddress,
    receivingAddress: request.receivingAddress,
    slippage,
    ...(includeBlockNumber ? { blockNumber: request.blockNumber } : {}),
    expirationTime: request.expirationTime,
    limitPartiallyFillable: request.limitPartiallyFillable,
    userMarketPriceRate: request.userMarketPriceRate,
    incognito: request.incognito,
  };
}

function hashSwapQuoteCanonicalRequest(canonicalRequest: unknown) {
  const serialized = stableStringify(canonicalRequest);
  const bytes = Uint8Array.from(bufferUtils.toBuffer(serialized, 'utf8'));
  return bytesToHex(sha256ByNoble(bytes));
}

export function buildSwapQuoteExecutionFingerprint(
  request: IFetchSwapQuoteParams,
) {
  return hashSwapQuoteCanonicalRequest(
    buildSwapQuoteCanonicalRequest(
      request,
      {
        autoSlippage: request.autoSlippage,
        percentage: request.slippagePercentage,
      },
      { includeBlockNumber: true, includeInactiveAmount: true },
    ),
  );
}

/**
 * Display ownership follows the user's slippage mode. Backend AUTO
 * suggestions may change the concrete percentage between refreshes, but that
 * must not erase the last committed amount. Execution ownership remains exact.
 */
export function buildSwapQuoteDisplayIntentFingerprint(
  request: IFetchSwapQuoteParams,
) {
  return hashSwapQuoteCanonicalRequest(
    buildSwapQuoteCanonicalRequest(
      request,
      request.autoSlippage
        ? { autoSlippage: true }
        : {
            autoSlippage: false,
            percentage: request.slippagePercentage,
          },
      { includeBlockNumber: false, includeInactiveAmount: false },
    ),
  );
}
