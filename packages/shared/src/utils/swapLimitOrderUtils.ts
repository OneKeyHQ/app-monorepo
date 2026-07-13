import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import type { IToken } from '@onekeyhq/shared/types/token';

export type IOneKeyLimitOrderTokenMetadata = Pick<
  IToken,
  'logoURI' | 'name' | 'symbol'
>;

export function mergeOneKeyLimitOrderTokenMetadata({
  providerToken,
  oneKeyToken,
}: {
  providerToken: ISwapToken;
  oneKeyToken?: IOneKeyLimitOrderTokenMetadata | null;
}): ISwapToken {
  if (!oneKeyToken) {
    return providerToken;
  }
  return {
    ...providerToken,
    logoURI: oneKeyToken.logoURI || providerToken.logoURI,
    name: oneKeyToken.name || providerToken.name,
    symbol: oneKeyToken.symbol || providerToken.symbol,
  };
}
