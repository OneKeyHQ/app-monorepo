import type { ISwapTokenBase } from '@onekeyhq/shared/types/swap/types';

import { normalizeTokenContractAddress } from './tokenUtils';

export type ISwapTokenIdentity = Partial<
  Pick<ISwapTokenBase, 'networkId' | 'contractAddress' | 'isNative'>
>;

export function getSwapTokenIdentityKey(token?: ISwapTokenIdentity) {
  if (!token?.networkId) {
    return '';
  }
  const contractAddress = normalizeTokenContractAddress({
    networkId: token.networkId,
    contractAddress: token.contractAddress,
  });
  return `${token.networkId}:${contractAddress ?? ''}:${
    token.isNative ? 'native' : 'token'
  }`;
}

export function isValidSwapTokenIdentity(token?: ISwapTokenIdentity) {
  return Boolean(
    token?.networkId &&
    (token.isNative === true || Boolean(token.contractAddress)),
  );
}

export function isSameSwapTokenIdentity({
  token1,
  token2,
}: {
  token1?: ISwapTokenIdentity;
  token2?: ISwapTokenIdentity;
}) {
  if (!isValidSwapTokenIdentity(token1) || !isValidSwapTokenIdentity(token2)) {
    return false;
  }
  const token1Key = getSwapTokenIdentityKey(token1);
  return Boolean(token1Key && token1Key === getSwapTokenIdentityKey(token2));
}

export function isSameSwapTokenPairIdentity({
  fromToken1,
  fromToken2,
  toToken1,
  toToken2,
}: {
  fromToken1?: ISwapTokenIdentity;
  fromToken2?: ISwapTokenIdentity;
  toToken1?: ISwapTokenIdentity;
  toToken2?: ISwapTokenIdentity;
}) {
  return (
    isSameSwapTokenIdentity({ token1: fromToken1, token2: fromToken2 }) &&
    isSameSwapTokenIdentity({ token1: toToken1, token2: toToken2 })
  );
}
