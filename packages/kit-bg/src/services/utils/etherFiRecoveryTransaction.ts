import BigNumber from 'bignumber.js';
import { utils } from 'ethers';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { getEtherFiVaultConfig } from '@onekeyhq/shared/src/utils/etherFiVaults';

import { assertEtherFiStakeTransaction } from './etherFiTransactionValidation';

const approveInterface = new utils.Interface([
  'function approve(address spender,uint256 amount)',
]);

export function classifyEtherFiRecoveryTransaction({
  networkId,
  accountAddress,
  vault,
  amount,
  txid,
  phase,
  tx,
  receipt,
}: {
  networkId: string;
  accountAddress: string;
  vault: string;
  amount: string;
  txid: string;
  phase: 'wrap' | 'approve' | 'deposit';
  tx: unknown;
  receipt: unknown;
}): 'pending' | 'success' | 'failed' | 'mismatch' {
  if (!tx || !receipt) return 'pending';
  if (typeof tx !== 'object' || typeof receipt !== 'object') return 'mismatch';
  const transaction = tx as Record<string, unknown>;
  const result = receipt as Record<string, unknown>;
  if (
    !/^0x[0-9a-f]{64}$/i.test(txid) ||
    typeof transaction.hash !== 'string' ||
    transaction.hash.toLowerCase() !== txid.toLowerCase() ||
    typeof result.transactionHash !== 'string' ||
    result.transactionHash.toLowerCase() !== txid.toLowerCase() ||
    typeof transaction.blockHash !== 'string' ||
    !/^0x[0-9a-f]{64}$/i.test(transaction.blockHash) ||
    typeof result.blockHash !== 'string' ||
    result.blockHash.toLowerCase() !== transaction.blockHash.toLowerCase() ||
    typeof transaction.input !== 'string'
  )
    return 'mismatch';
  if (result.status !== '0x0' && result.status !== '0x1') return 'pending';
  const config = /^0x[0-9a-f]{40}$/i.test(vault)
    ? getEtherFiVaultConfig(vault)
    : undefined;
  const amountRaw = new BigNumber(amount).shiftedBy(18);
  if (
    networkId !== getNetworkIdsMap().eth ||
    !/^0x[0-9a-f]{40}$/i.test(accountAddress) ||
    !['wrap', 'approve', 'deposit'].includes(phase) ||
    !config?.inputs.some((asset) => asset.symbol === 'ETH' && !asset.address) ||
    !config.inputs.some(
      (asset) =>
        asset.address.toLowerCase() === EthereumWETH.toLowerCase() &&
        asset.decimals === 18,
    ) ||
    !amountRaw.isFinite() ||
    !amountRaw.isInteger() ||
    amountRaw.lte(0)
  )
    return 'mismatch';
  const encodedTx = { ...transaction, data: transaction.input };
  try {
    if (phase === 'wrap' || phase === 'deposit') {
      assertEtherFiStakeTransaction({
        tx: encodedTx,
        networkId,
        vault,
        accountAddress,
        amount,
        symbol: 'ETH',
        inputTokenAddress: phase === 'deposit' ? EthereumWETH : undefined,
        stakeType: phase === 'wrap' ? 'wrap' : 'normal',
      });
    } else {
      if (
        typeof transaction.from !== 'string' ||
        transaction.from.toLowerCase() !== accountAddress.toLowerCase() ||
        typeof transaction.to !== 'string' ||
        transaction.to.toLowerCase() !== EthereumWETH.toLowerCase() ||
        typeof transaction.value !== 'string' ||
        !new BigNumber(transaction.value).isZero() ||
        (transaction.chainId !== undefined &&
          new BigNumber(String(transaction.chainId)).toFixed() !== '1')
      )
        return 'mismatch';
      const call = approveInterface.parseTransaction({
        data: transaction.input,
      });
      if (
        call.name !== 'approve' ||
        String(call.args[0]).toLowerCase() !==
          EtherFiLiquidReferContract.toLowerCase() ||
        new BigNumber(String(call.args[1])).lt(amountRaw) ||
        approveInterface
          .encodeFunctionData(call.functionFragment, call.args)
          .toLowerCase() !== transaction.input.toLowerCase()
      )
        return 'mismatch';
    }
  } catch {
    return 'mismatch';
  }
  return result.status === '0x1' ? 'success' : 'failed';
}
