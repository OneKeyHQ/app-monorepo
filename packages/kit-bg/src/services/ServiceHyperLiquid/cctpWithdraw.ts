import BigNumber from 'bignumber.js';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  CCTP_WITHDRAW_GAS_LIMIT,
  CCTP_WITHDRAW_HOOK_DATA,
  USDC_WITHDRAW_GAS_RESERVE,
  getUsdcWithdrawDestination,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type {
  ICctpWithdrawDestinationConfig,
  IUsdcWithdrawDestinationConfig,
  IUsdcWithdrawDestinationId,
  IUsdcWithdrawFeeComponent,
  IUsdcWithdrawFeeQuote,
} from '@onekeyhq/shared/types/hyperliquid/perp.constants';
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

const CORE_DEPOSIT_WALLET_ADDRESS =
  '0x6B9E773128f453f5c2C60935Ee2DE2CBc5390A24';
const CCTP_WITHDRAW_FEE_SELECTOR = 'e26f7d23';
const CCTP_WITHDRAW_FEE_CACHE_TTL_MS = 5 * 60 * 1000;
const USDC_DECIMALS = 6;

export type IHyperEvmRpcCall = (
  method: string,
  params: unknown[],
) => Promise<unknown>;

interface ICctpWithdrawFeeCacheEntry {
  fee: number;
  fetchedAt: number;
}

export interface ICctpWithdrawDestinationActionFields {
  config: ICctpWithdrawDestinationConfig;
  destinationRecipient: string;
  addressEncoding: 'hex';
  destinationChainId: number;
  gasLimit: number;
  data: IHex;
}

const cachedFees = new Map<
  IUsdcWithdrawDestinationId,
  ICctpWithdrawFeeCacheEntry
>();
const inFlightFeeRequests = new Map<
  IUsdcWithdrawDestinationId,
  Promise<IUsdcWithdrawFeeComponent>
>();

export function requireUsdcWithdrawDestination(
  destinationId: string,
): IUsdcWithdrawDestinationConfig {
  const config = getUsdcWithdrawDestination(destinationId);
  if (!config) {
    throw new OneKeyLocalError(
      `Unsupported USDC withdrawal destination: ${destinationId}`,
    );
  }
  return config;
}

function encodeWithdrawFeeCall(destinationDomain: number): IHex {
  const useForwarding = '1'.padStart(64, '0');
  const domain = destinationDomain.toString(16).padStart(64, '0');
  return `0x${CCTP_WITHDRAW_FEE_SELECTOR}${useForwarding}${domain}` as IHex;
}

function parseWithdrawFee(result: unknown): number {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result)) {
    throw new OneKeyLocalError('Invalid CCTP withdrawal fee response');
  }
  const fee = new BigNumber(result.slice(2), 16)
    .shiftedBy(-USDC_DECIMALS)
    .toNumber();
  if (!Number.isFinite(fee) || fee < 0) {
    throw new OneKeyLocalError('Invalid CCTP withdrawal fee value');
  }
  return fee;
}

async function fetchCctpWithdrawFee(
  config: ICctpWithdrawDestinationConfig,
  rpcCall: IHyperEvmRpcCall,
): Promise<number> {
  const result = await rpcCall('eth_call', [
    {
      to: CORE_DEPOSIT_WALLET_ADDRESS,
      data: encodeWithdrawFeeCall(config.domain),
    },
    'latest',
  ]);
  return parseWithdrawFee(result);
}

async function getCctpWithdrawFee(
  destinationId: IUsdcWithdrawDestinationId,
  rpcCall: IHyperEvmRpcCall,
): Promise<IUsdcWithdrawFeeComponent> {
  const config = requireUsdcWithdrawDestination(destinationId);
  if (config.transferType !== 'cctp') {
    throw new OneKeyLocalError(
      `Destination does not have a CCTP fee: ${destinationId}`,
    );
  }
  const cached = cachedFees.get(destinationId);
  const now = Date.now();
  if (cached && now - cached.fetchedAt < CCTP_WITHDRAW_FEE_CACHE_TTL_MS) {
    return {
      kind: 'cctpForwarding',
      amount: cached.fee.toString(),
      token: 'USDC',
      debitedFrom: 'withdrawAmount',
      isEstimate: false,
    };
  }

  const inFlight = inFlightFeeRequests.get(destinationId);
  if (inFlight) {
    return inFlight;
  }

  const request = fetchCctpWithdrawFee(config, rpcCall)
    .then((fee) => {
      cachedFees.set(destinationId, { fee, fetchedAt: Date.now() });
      return {
        kind: 'cctpForwarding' as const,
        amount: fee.toString(),
        token: 'USDC' as const,
        debitedFrom: 'withdrawAmount' as const,
        isEstimate: false,
      };
    })
    .catch(() => ({
      kind: 'cctpForwarding' as const,
      amount: config.fallbackFee.toString(),
      token: 'USDC' as const,
      debitedFrom: 'withdrawAmount' as const,
      isEstimate: true,
    }))
    .finally(() => {
      inFlightFeeRequests.delete(destinationId);
    });
  inFlightFeeRequests.set(destinationId, request);
  return request;
}

export async function getUsdcWithdrawFee(
  destinationId: IUsdcWithdrawDestinationId,
  rpcCall: IHyperEvmRpcCall,
): Promise<IUsdcWithdrawFeeQuote> {
  const config = requireUsdcWithdrawDestination(destinationId);
  if (config.transferType === 'hyperEvm') {
    return {
      components: [
        {
          kind: 'hyperEvmGas',
          amount: USDC_WITHDRAW_GAS_RESERVE.toString(),
          token: 'USDC',
          debitedFrom: 'spotHypeOrSourceUsdc',
          isEstimate: true,
          displayAsLessThan: true,
        },
      ],
      quotedAt: Date.now(),
    };
  }
  const cctpFee = await getCctpWithdrawFee(destinationId, rpcCall);
  return {
    components: [cctpFee],
    quotedAt: Date.now(),
  };
}

// The contract can update per-domain fees, so submission must not quote a cached
// or fallback value.
export async function getLiveUsdcWithdrawFee(
  destinationId: IUsdcWithdrawDestinationId,
  rpcCall: IHyperEvmRpcCall,
): Promise<IUsdcWithdrawFeeQuote> {
  const config = requireUsdcWithdrawDestination(destinationId);
  if (config.transferType === 'hyperEvm') {
    return {
      components: [
        {
          kind: 'hyperEvmGas',
          amount: USDC_WITHDRAW_GAS_RESERVE.toString(),
          token: 'USDC',
          debitedFrom: 'spotHypeOrSourceUsdc',
          isEstimate: true,
          displayAsLessThan: true,
        },
      ],
      quotedAt: Date.now(),
    };
  }
  const cctpFee = await fetchCctpWithdrawFee(config, rpcCall);
  cachedFees.set(destinationId, { fee: cctpFee, fetchedAt: Date.now() });
  return {
    components: [
      {
        kind: 'cctpForwarding',
        amount: cctpFee.toString(),
        token: 'USDC',
        debitedFrom: 'withdrawAmount',
        isEstimate: false,
      },
    ],
    quotedAt: Date.now(),
  };
}

export function buildCctpWithdrawDestination({
  destinationId,
  ownerAddress,
}: {
  destinationId: IUsdcWithdrawDestinationId;
  ownerAddress: string;
}): ICctpWithdrawDestinationActionFields {
  const config = requireUsdcWithdrawDestination(destinationId);
  if (config.transferType !== 'cctp') {
    throw new OneKeyLocalError(
      `Destination does not use CCTP: ${destinationId}`,
    );
  }

  return {
    config,
    destinationRecipient: ownerAddress,
    addressEncoding: config.addressEncoding,
    destinationChainId: config.domain,
    gasLimit: CCTP_WITHDRAW_GAS_LIMIT,
    data: CCTP_WITHDRAW_HOOK_DATA,
  };
}

export function clearUsdcWithdrawFeeCacheForTest() {
  cachedFees.clear();
  inFlightFeeRequests.clear();
}
