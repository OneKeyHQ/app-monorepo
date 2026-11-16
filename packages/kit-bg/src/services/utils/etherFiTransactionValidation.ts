import BigNumber from 'bignumber.js';
import { utils } from 'ethers';

import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EtherFiLiquidReferContract,
  EthereumWETH,
} from '@onekeyhq/shared/src/consts/addresses';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { getEtherFiVaultConfig } from '@onekeyhq/shared/src/utils/etherFiVaults';

const depositInterface = new utils.Interface([
  'function deposit(address teller,address depositAsset,uint256 depositAmount,uint256 minimumMint,address referrer)',
]);
const queueInterface = new utils.Interface([
  'function requestOnChainWithdraw(address assetOut,uint128 amountOfShares,uint16 discount,uint24 secondsToDeadline)',
  'function cancelOnChainWithdraw((uint96 nonce,address user,address assetOut,uint128 amountOfShares,uint128 amountOfAssets,uint40 creationTime,uint24 secondsToMaturity,uint24 secondsToDeadline) request)',
]);
const requestTuple =
  'tuple(uint96 nonce,address user,address assetOut,uint128 amountOfShares,uint128 amountOfAssets,uint40 creationTime,uint24 secondsToMaturity,uint24 secondsToDeadline)';

export function normalizeEtherFiAmount(amount: string): string {
  if (/^\.\d+$/.test(amount)) return `0${amount}`;
  if (/^\d+\.$/.test(amount)) return amount.slice(0, -1);
  return amount;
}

function invalid(): never {
  throw new OneKeyLocalError(
    'EtherFi transaction does not match the requested action',
  );
}

function rawAmount(amount: string, decimals: number) {
  const raw = new BigNumber(amount).shiftedBy(decimals);
  if (!raw.isFinite() || !raw.isInteger() || raw.lte(0)) return invalid();
  return raw.toFixed(0);
}

function parseTransaction(tx: unknown, accountAddress: string) {
  if (!tx || typeof tx !== 'object') return invalid();
  const value = tx as Record<string, unknown>;
  if (
    !/^0x[0-9a-f]{40}$/i.test(accountAddress) ||
    typeof value.from !== 'string' ||
    !/^0x[0-9a-f]{40}$/i.test(value.from) ||
    value.from.toLowerCase() !== accountAddress.toLowerCase() ||
    typeof value.to !== 'string' ||
    !/^0x[0-9a-f]{40}$/i.test(value.to) ||
    typeof value.data !== 'string' ||
    !/^0x[0-9a-f]*$/i.test(value.data) ||
    typeof value.value !== 'string'
  )
    return invalid();
  const amount = new BigNumber(value.value);
  if (!amount.isFinite() || !amount.isInteger() || amount.isNegative())
    return invalid();
  if (
    value.chainId !== undefined &&
    new BigNumber(String(value.chainId)).toFixed() !== '1'
  )
    return invalid();
  return {
    to: value.to.toLowerCase(),
    data: value.data.toLowerCase(),
    value: amount,
  };
}

export function assertEtherFiStakeTransaction({
  tx,
  networkId,
  vault,
  accountAddress,
  symbol,
  amount,
  inputTokenAddress,
  stakeType,
}: {
  tx: unknown;
  networkId: string;
  vault?: string;
  accountAddress: string;
  symbol: string;
  amount: string;
  inputTokenAddress?: string;
  stakeType?: 'wrap' | 'normal';
}) {
  const config = getEtherFiVaultConfig(vault);
  if (networkId !== getNetworkIdsMap().eth || !config) return invalid();
  const decoded = parseTransaction(tx, accountAddress);
  if (stakeType === 'wrap') {
    if (
      !config.inputs.some((item) => item.symbol === 'ETH' && !item.address) ||
      symbol.toUpperCase() !== 'ETH' ||
      inputTokenAddress ||
      decoded.to !== EthereumWETH.toLowerCase() ||
      decoded.data !== '0xd0e30db0' ||
      !decoded.value.eq(rawAmount(amount, 18))
    )
      return invalid();
    return;
  }
  const address = inputTokenAddress?.toLowerCase();
  const asset = config.inputs.find(
    (item) => item.address && item.address.toLowerCase() === address,
  );
  if (
    !asset ||
    (asset.symbol.toLowerCase() !== symbol.toLowerCase() &&
      !(
        symbol.toUpperCase() === 'ETH' && address === EthereumWETH.toLowerCase()
      ))
  )
    return invalid();
  if (
    decoded.to !== EtherFiLiquidReferContract.toLowerCase() ||
    !decoded.value.isZero()
  )
    return invalid();
  try {
    const call = depositInterface.parseTransaction({ data: decoded.data });
    if (
      call.name !== 'deposit' ||
      String(call.args[0]).toLowerCase() !== config.teller ||
      String(call.args[1]).toLowerCase() !== address ||
      String(call.args[2]) !== rawAmount(amount, asset.decimals) ||
      new BigNumber(String(call.args[3])).lte(0) ||
      depositInterface
        .encodeFunctionData(call.functionFragment, call.args)
        .toLowerCase() !== decoded.data
    )
      return invalid();
  } catch {
    return invalid();
  }
}

export function assertEtherFiWithdrawTransaction({
  tx,
  networkId,
  vault,
  accountAddress,
  amount,
  outputTokenAddress,
  withdrawType,
  identity,
}: {
  tx: unknown;
  networkId: string;
  vault?: string;
  accountAddress: string;
  amount: string;
  outputTokenAddress?: string;
  withdrawType?: 'instant' | 'queued' | 'cancel';
  identity?: string;
}) {
  const config = getEtherFiVaultConfig(vault);
  if (networkId !== getNetworkIdsMap().eth || !config) return invalid();
  const decoded = parseTransaction(tx, accountAddress);
  if (decoded.to !== config.queue || !decoded.value.isZero()) return invalid();
  try {
    const call = queueInterface.parseTransaction({ data: decoded.data });
    if (
      queueInterface
        .encodeFunctionData(call.functionFragment, call.args)
        .toLowerCase() !== decoded.data
    )
      return invalid();
    if (withdrawType === 'cancel') {
      if (call.name !== 'cancelOnChainWithdraw' || !identity) return invalid();
      const request = call.args[0];
      if (
        String(request.user).toLowerCase() !== accountAddress.toLowerCase() ||
        utils
          .keccak256(utils.defaultAbiCoder.encode([requestTuple], [request]))
          .toLowerCase() !== identity.toLowerCase()
      )
        return invalid();
      return;
    }
    const address = outputTokenAddress?.toLowerCase();
    if (
      withdrawType !== 'queued' ||
      call.name !== 'requestOnChainWithdraw' ||
      !config.outputs.some(
        (asset) => asset.address.toLowerCase() === address,
      ) ||
      String(call.args[0]).toLowerCase() !== address ||
      String(call.args[1]) !== rawAmount(amount, config.decimals) ||
      String(call.args[2]) !== '0'
    )
      return invalid();
  } catch {
    return invalid();
  }
}
