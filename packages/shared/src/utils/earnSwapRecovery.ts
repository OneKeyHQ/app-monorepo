import { z } from 'zod';

import {
  EProtocolOfExchange,
  ESwapTxHistoryStatus,
} from '../../types/swap/types';

import type { IEarnSwapRecovery } from '../../types/earn/funding';
import type { ISwapTxHistory } from '../../types/swap/types';

const bounded = z.string().min(1).max(2048);
const token = z
  .object({
    networkId: bounded,
    contractAddress: z.string().max(512),
    symbol: bounded,
    decimals: z.number().int().min(0).max(255),
    isNative: z.boolean().optional(),
    name: bounded.optional(),
    logoURI: bounded.optional(),
  })
  .strict();
const side = z
  .object({
    accountId: bounded,
    networkId: bounded,
    address: bounded,
    amount: bounded,
    token,
  })
  .strict();
const schema = z
  .object({
    sender: side,
    receiver: side,
    provider: z
      .object({
        provider: bounded,
        providerName: bounded,
        providerLogo: bounded.optional(),
      })
      .strict(),
    serviceOrderId: bounded.optional(),
    orderId: bounded.optional(),
    useOrderId: z.boolean(),
    ctx: z.unknown().optional(),
    currency: z.object({ id: bounded, symbol: z.string().max(2048) }).strict(),
    createdAt: z.number().int().nonnegative().safe(),
  })
  .strict();

export function isEarnSwapRecovery(value: unknown): value is IEarnSwapRecovery {
  try {
    const encoded = JSON.stringify(value);
    return Boolean(
      encoded && encoded.length <= 32_768 && schema.safeParse(value).success,
    );
  } catch {
    return false;
  }
}

export function buildRecoveredEarnSwapHistory(
  recovery: IEarnSwapRecovery,
  txId: string,
): ISwapTxHistory {
  return {
    protocol: EProtocolOfExchange.SWAP,
    status: ESwapTxHistoryStatus.PENDING,
    currency: recovery.currency.symbol,
    currencyId: recovery.currency.id,
    accountInfo: {
      sender: {
        accountId: recovery.sender.accountId,
        networkId: recovery.sender.networkId,
      },
      receiver: {
        accountId: recovery.receiver.accountId,
        networkId: recovery.receiver.networkId,
      },
    },
    baseInfo: {
      fromToken: recovery.sender.token,
      toToken: recovery.receiver.token,
      fromAmount: recovery.sender.amount,
      toAmount: recovery.receiver.amount,
    },
    txInfo: {
      txId,
      sender: recovery.sender.address,
      receiver: recovery.receiver.address,
      orderId: recovery.orderId,
      useOrderId: recovery.useOrderId,
    },
    swapInfo: {
      provider: recovery.provider,
      instantRate: '',
      orderId: recovery.serviceOrderId,
    },
    ctx: recovery.ctx,
    date: { created: recovery.createdAt, updated: Date.now() },
  };
}
