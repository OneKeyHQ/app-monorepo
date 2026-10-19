import {
  ARC_ERC20_USDC_CONTRACT_ADDRESS,
  ARC_NETWORK_ID,
  swapDefaultSetTokens,
} from '../../types/swap/SwapProvider.constants';

import { equalTokenNoCaseSensitive } from './tokenUtils';

import type { ISwapToken } from '../../types/swap/types';

type ISwapEntryTokenIdentity = {
  networkId?: string;
  contractAddress?: string;
  isNative?: boolean;
};

// Arc's ERC-20 USDC spends the same balance as its native gas token.
// Keep the ERC-20 identity for quoting, approvals and transaction building.
export function shouldReserveSwapGas(token?: ISwapEntryTokenIdentity) {
  return Boolean(
    token?.isNative ||
    (token?.networkId === ARC_NETWORK_ID &&
      token?.contractAddress?.toLowerCase() ===
        ARC_ERC20_USDC_CONTRACT_ADDRESS),
  );
}

export function isSwapEntryDisabledToken(token: ISwapEntryTokenIdentity) {
  if (token.networkId !== ARC_NETWORK_ID) {
    return false;
  }

  // Arc exposes one USDC balance through native and ERC-20 identities, but
  // Swap providers and transaction builders support only the ERC-20 identity.
  return token.isNative === true || token.contractAddress === '';
}

export function getSwapConfiguredDefaultToToken(
  fromToken: ISwapToken,
): ISwapToken | undefined {
  if (fromToken.networkId !== ARC_NETWORK_ID) {
    return undefined;
  }

  const defaultTokens = swapDefaultSetTokens[fromToken.networkId];
  if (
    !defaultTokens?.fromToken ||
    !equalTokenNoCaseSensitive({
      token1: fromToken,
      token2: defaultTokens.fromToken,
    })
  ) {
    return undefined;
  }

  return defaultTokens.toToken;
}
