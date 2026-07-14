import type {
  IFetchLimitOrderRes,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

import { equalTokenNoCaseSensitive } from './tokenUtils';

export type ILimitOrderTokenDisplayMetadata = Pick<
  ISwapToken,
  'logoURI' | 'name' | 'symbol'
>;

export function mergeLimitOrderTokenDisplayMetadata({
  providerToken,
  displayMetadata,
}: {
  providerToken: ISwapToken;
  displayMetadata?: ILimitOrderTokenDisplayMetadata | null;
}): ISwapToken {
  if (!displayMetadata) {
    return providerToken;
  }
  const logoURI = displayMetadata.logoURI || providerToken.logoURI;
  const name = displayMetadata.name || providerToken.name;
  const symbol = displayMetadata.symbol || providerToken.symbol;
  if (
    logoURI === providerToken.logoURI &&
    name === providerToken.name &&
    symbol === providerToken.symbol
  ) {
    return providerToken;
  }
  return {
    ...providerToken,
    logoURI,
    name,
    symbol,
  };
}

export function mergeLimitOrderTokenDisplayMetadataIntoOrder({
  currentOrder,
  metadataOrder,
}: {
  currentOrder: IFetchLimitOrderRes;
  metadataOrder: IFetchLimitOrderRes;
}): IFetchLimitOrderRes {
  if (currentOrder.orderId !== metadataOrder.orderId) {
    return currentOrder;
  }

  const fromTokenInfo = equalTokenNoCaseSensitive({
    token1: currentOrder.fromTokenInfo,
    token2: metadataOrder.fromTokenInfo,
  })
    ? mergeLimitOrderTokenDisplayMetadata({
        providerToken: currentOrder.fromTokenInfo,
        displayMetadata: metadataOrder.fromTokenInfo,
      })
    : currentOrder.fromTokenInfo;
  const toTokenInfo = equalTokenNoCaseSensitive({
    token1: currentOrder.toTokenInfo,
    token2: metadataOrder.toTokenInfo,
  })
    ? mergeLimitOrderTokenDisplayMetadata({
        providerToken: currentOrder.toTokenInfo,
        displayMetadata: metadataOrder.toTokenInfo,
      })
    : currentOrder.toTokenInfo;

  if (
    fromTokenInfo === currentOrder.fromTokenInfo &&
    toTokenInfo === currentOrder.toTokenInfo
  ) {
    return currentOrder;
  }
  return {
    ...currentOrder,
    fromTokenInfo,
    toTokenInfo,
  };
}
