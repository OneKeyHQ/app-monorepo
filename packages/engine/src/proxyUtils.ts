import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';

import type { TxInput, UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import {
  IMPL_ALGO,
  IMPL_BTC,
  IMPL_CFX,
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_SOL,
  IMPL_STC,
} from '@onekeyhq/shared/src/engine/engineConsts';

import type { DBAccount, DBSimpleAccount } from './types/account';
import type { Network } from './types/network';
import type { Token } from './types/token';

export function fillUnsignedTxObj({
  network,
  dbAccount,
  to,
  value,
  valueOnChain,
  token,
  extra,
  shiftFeeDecimals = false,
}: {
  network: Network;
  dbAccount: DBAccount;
  to: string;
  value?: BigNumber;
  valueOnChain?: string;
  token?: Token;
  extra?: { [key: string]: any };
  shiftFeeDecimals?: boolean;
}): UnsignedTx {
  let valueOnChainBN = new BigNumber(0);
  let tokenIdOnNetwork: string | undefined;
  if (valueOnChain) {
    valueOnChainBN = new BigNumber(valueOnChain);
  } else if (!isNil(value)) {
    valueOnChainBN = value;
    if (typeof token !== 'undefined') {
      valueOnChainBN = valueOnChainBN.shiftedBy(token.decimals);
      tokenIdOnNetwork = token.tokenIdOnNetwork;
    } else {
      valueOnChainBN = valueOnChainBN.shiftedBy(network.decimals);
    }
  }

  const { type, nonce, feeLimit, feePricePerUnit, ...payload } = extra as {
    type?: string;
    nonce?: number;
    feeLimit?: BigNumber;
    feePricePerUnit?: BigNumber;
    [key: string]: any;
  };
  const { maxFeePerGas, maxPriorityFeePerGas } = payload as {
    maxFeePerGas: string;
    maxPriorityFeePerGas: string;
  };
  // EIP 1559
  const eip1559 =
    typeof maxFeePerGas === 'string' &&
    typeof maxPriorityFeePerGas === 'string';
  if (eip1559) {
    let maxFeePerGasBN = new BigNumber(maxFeePerGas);
    let maxPriorityFeePerGasBN = new BigNumber(maxPriorityFeePerGas);

    if (shiftFeeDecimals) {
      maxFeePerGasBN = maxFeePerGasBN.shiftedBy(network.feeDecimals);
      maxPriorityFeePerGasBN = maxPriorityFeePerGasBN.shiftedBy(
        network.feeDecimals,
      );
    }
    payload.maxFeePerGas = maxFeePerGasBN;
    payload.maxPriorityFeePerGas = maxPriorityFeePerGasBN;
    payload.EIP1559Enabled = true;
  }
  const input: TxInput = {
    address: dbAccount.address,
    value: valueOnChainBN,
    tokenAddress: tokenIdOnNetwork,
  };
  if (network.impl === IMPL_STC) {
    input.publicKey = (dbAccount as DBSimpleAccount).pub;
  }

  let feePricePerUnitBN = feePricePerUnit;
  if (shiftFeeDecimals) {
    feePricePerUnitBN = feePricePerUnitBN?.shiftedBy(network.feeDecimals);
  }
  // TODO remove hack for eip1559 gasPrice=1
  if (eip1559) {
    feePricePerUnitBN = new BigNumber(1);
  }

  return {
    inputs: [input],
    outputs: [
      {
        address: to || '',
        value: valueOnChainBN,
        tokenAddress: tokenIdOnNetwork,
      },
    ],
    type,
    nonce,
    feeLimit,
    feePricePerUnit: feePricePerUnitBN,
    payload,
  };
}

export function fillUnsignedTx(
  network: Network,
  dbAccount: DBAccount,
  to: string,
  value: BigNumber,
  token?: Token,
  extra?: { [key: string]: any },
): UnsignedTx {
  return fillUnsignedTxObj({
    network,
    dbAccount,
    to,
    value,
    token,
    extra,
  });
}

// blockchain-libs can throw ResponseError and JSONResponseError upon rpc call
// errors/failures. Each error has both message & response properties.
// We read the possible error, categorize it by its message and decide
// what to throw to upper layer.
export function extractResponseError(e: unknown): unknown {
  const { message, response } = e as { message?: string; response?: any };
  if (typeof message === 'undefined' || typeof response === 'undefined') {
    // not what we expected, throw original error out.
    return e;
  }
  if (message === 'Error JSON PRC response') {
    // TODO: avoid this stupid string comparison and there is even an unbearable typo.
    // this is what blockchain-libs can throw upon a JSON RPC call failure
    const { error: rpcError } = response;
    if (typeof rpcError !== 'undefined') {
      return web3Errors.rpc.internal({ data: rpcError });
    }
  }
  // Otherwise, throw the original error out.
  // TODO: see whether to wrap it into a gerinic OneKeyError.
  return e;
}

// IMPL naming aren't necessarily the same.
export const IMPL_MAPPINGS: Record<
  string,
  { implName?: string; defaultClient: string }
> = {
  [IMPL_EVM]: { implName: 'eth', defaultClient: 'Geth' },
  [IMPL_SOL]: { defaultClient: 'Solana' },
  [IMPL_ALGO]: { defaultClient: 'Algod' },
  [IMPL_NEAR]: { defaultClient: 'NearCli' },
  [IMPL_STC]: { defaultClient: 'StcClient' },
  [IMPL_CFX]: { defaultClient: 'Conflux' },
  [IMPL_BTC]: { defaultClient: 'BlockBook' },
};
