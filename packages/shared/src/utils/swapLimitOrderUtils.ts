import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

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
  return {
    ...providerToken,
    logoURI: displayMetadata.logoURI || providerToken.logoURI,
    name: displayMetadata.name || providerToken.name,
    symbol: displayMetadata.symbol || providerToken.symbol,
  };
}
