import { defaultAbiCoder } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';

import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import type { IToken } from '@onekeyhq/shared/types/token';
import type { IDecodedTxAction } from '@onekeyhq/shared/types/tx';
import { EApproveType, EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import { EErc20MethodSelectors } from './decoder/abi';

import type { BigNumber as EthersBigNumber } from '@ethersproject/bignumber';

export const PERMIT2_APPROVE_SELECTOR = '0x87517c45';

const UNISWAP_PERMIT2_ADDRESS = '0x000000000022D473030F116dDEE9F6B43aC78BA3';
const PANCAKESWAP_PERMIT2_ADDRESS =
  '0x31c2F6fcFf4F8759b3Bd5Bf0e1084A055615c768';
const PERMIT2_APPROVE_DATA_LENGTH = 2 + 8 + 64 * 4;
const UINT48_MAX = new BigNumber(2).pow(48).minus(1);
const networkIdsMap = getNetworkIdsMap();
// The server-side approvals whitelist only returns these two Permit2
// deployments (>99.9% of Permit2 approval records); both are deterministic
// CREATE2 deployments sharing one address across chains.
const TRUSTED_PERMIT2_ADDRESS_LIST: readonly string[] = [
  UNISWAP_PERMIT2_ADDRESS,
  PANCAKESWAP_PERMIT2_ADDRESS,
];
const TRUSTED_PERMIT2_ADDRESSES: Readonly<Record<string, readonly string[]>> = {
  [networkIdsMap.eth]: TRUSTED_PERMIT2_ADDRESS_LIST,
  [networkIdsMap.bsc]: TRUSTED_PERMIT2_ADDRESS_LIST,
  [networkIdsMap.polygon]: TRUSTED_PERMIT2_ADDRESS_LIST,
  [networkIdsMap.arbitrum]: TRUSTED_PERMIT2_ADDRESS_LIST,
  [networkIdsMap.avalanche]: TRUSTED_PERMIT2_ADDRESS_LIST,
  [networkIdsMap.optimism]: TRUSTED_PERMIT2_ADDRESS_LIST,
  [networkIdsMap.base]: TRUSTED_PERMIT2_ADDRESS_LIST,
};

function isSameEvmAddress(left?: string, right?: string) {
  const addressPattern = /^0x[0-9a-fA-F]{40}$/;
  return Boolean(
    left &&
    right &&
    addressPattern.test(left) &&
    addressPattern.test(right) &&
    left.toLowerCase() === right.toLowerCase(),
  );
}

export function resolveTrustedPermit2Address({
  networkId,
  permit2Address,
}: {
  networkId: string;
  permit2Address?: string;
}) {
  const trustedPermit2Addresses = TRUSTED_PERMIT2_ADDRESSES[networkId] ?? [];
  return trustedPermit2Addresses.find((trustedPermit2Address) =>
    isSameEvmAddress(permit2Address, trustedPermit2Address),
  );
}

export function buildErc20ApproveEncodedTx({
  owner,
  spender,
  amount,
  tokenInfo,
  isMax,
}: {
  owner: string;
  spender: string;
  amount: string;
  tokenInfo: IToken;
  isMax?: boolean;
}): IEncodedTxEvm {
  const amountBN = new BigNumber(amount);
  const amountHex = toBigIntHex(
    amountBN.isNaN() || isMax
      ? new BigNumber(2).pow(256).minus(1)
      : amountBN.shiftedBy(tokenInfo.decimals),
  );
  const data = `${EErc20MethodSelectors.tokenApprove}${defaultAbiCoder
    .encode(['address', 'uint256'], [spender, amountHex])
    .slice(2)}`;

  return {
    from: owner,
    to: tokenInfo.address,
    value: '0x0',
    data,
  };
}

export function buildPermit2ApproveEncodedTx({
  owner,
  spender,
  tokenAddress,
  permit2Address,
  expirationSeconds,
}: {
  owner: string;
  spender: string;
  tokenAddress: string;
  permit2Address: string;
  expirationSeconds: string;
}): IEncodedTxEvm {
  const data = `${PERMIT2_APPROVE_SELECTOR}${defaultAbiCoder
    .encode(
      ['address', 'address', 'uint160', 'uint48'],
      [tokenAddress, spender, '0', expirationSeconds],
    )
    .slice(2)}`;

  return {
    from: owner,
    to: permit2Address,
    value: '0x0',
    data,
  };
}

export function buildPermit2ApproveAction({
  encodedTx,
  accountAddress,
  owner,
  spender,
  amount,
  tokenInfo,
  permit2Address,
  expirationSeconds,
}: {
  encodedTx: IEncodedTxEvm;
  accountAddress: string;
  owner: string;
  spender: string;
  amount: string;
  tokenInfo: IToken;
  permit2Address: string;
  expirationSeconds: string;
}): IDecodedTxAction | undefined {
  const { data } = encodedTx;
  if (
    !data ||
    data.length !== PERMIT2_APPROVE_DATA_LENGTH ||
    !/^0x[0-9a-fA-F]+$/.test(data) ||
    data.slice(0, 10).toLowerCase() !== PERMIT2_APPROVE_SELECTOR
  ) {
    return undefined;
  }

  try {
    const [
      decodedToken,
      decodedSpender,
      decodedAmountValue,
      decodedExpiration,
    ] = defaultAbiCoder.decode(
      ['address', 'address', 'uint160', 'uint48'],
      `0x${data.slice(10)}`,
    ) as [string, string, EthersBigNumber, EthersBigNumber];
    const decodedAmount = decodedAmountValue.toString();
    const decodedExpirationSeconds = decodedExpiration.toString();
    const txValue = new BigNumber(encodedTx.value);
    const expectedAmount = new BigNumber(amount);
    const expectedExpiration = new BigNumber(expirationSeconds);
    const isExpectedExpirationValid =
      /^\d+$/.test(expirationSeconds) &&
      expectedExpiration.isFinite() &&
      expectedExpiration.isInteger() &&
      expectedExpiration.gte(0) &&
      expectedExpiration.lte(UINT48_MAX);

    if (
      !isSameEvmAddress(encodedTx.from, owner) ||
      !isSameEvmAddress(owner, accountAddress) ||
      !isSameEvmAddress(encodedTx.to, permit2Address) ||
      !isSameEvmAddress(decodedToken, tokenInfo.address) ||
      !isSameEvmAddress(decodedSpender, spender) ||
      !txValue.isFinite() ||
      !txValue.isZero() ||
      !expectedAmount.isFinite() ||
      !expectedAmount.isZero() ||
      !new BigNumber(decodedAmount).isZero() ||
      !isExpectedExpirationValid ||
      !new BigNumber(decodedExpirationSeconds).eq(expectedExpiration)
    ) {
      return undefined;
    }

    return {
      type: EDecodedTxActionType.TOKEN_APPROVE,
      tokenApprove: {
        from: encodedTx.from,
        to: encodedTx.to,
        spender: decodedSpender,
        amount: decodedAmount,
        icon: tokenInfo.logoURI ?? '',
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        decimals: tokenInfo.decimals,
        tokenIdOnNetwork: decodedToken,
        isInfiniteAmount: false,
        approveType: EApproveType.Approve,
      },
    };
  } catch {
    return undefined;
  }
}
