import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import { ETokenDappType } from '@onekeyhq/shared/types/token';
import type { ITokenDappType } from '@onekeyhq/shared/types/token';

export type ISwapKLineToken = ISwapToken & {
  defiMarked?: boolean;
  dappName?: string | null;
  dappType?: ITokenDappType;
};

export function isKnownSwapKLineUnsupportedToken(token?: ISwapKLineToken) {
  if (!token) {
    return false;
  }
  if (token.dappType === ETokenDappType.WalletToken) {
    return false;
  }
  return Boolean(token.defiMarked || token.dappName?.trim() || token.dappType);
}

export async function fetchSwapKLineTokenIsStable(
  token?: ISwapKLineToken,
): Promise<boolean> {
  if (!token?.networkId) {
    return false;
  }

  return false;
}

export function getDefaultSwapKLineSide({
  fromToken,
  fromTokenIsStable = false,
  toToken,
  toTokenIsStable = false,
}: {
  fromToken?: ISwapKLineToken;
  fromTokenIsStable?: boolean;
  toToken?: ISwapKLineToken;
  toTokenIsStable?: boolean;
}): ESwapDirectionType {
  if (!toToken) {
    return ESwapDirectionType.FROM;
  }
  if (!fromToken) {
    return ESwapDirectionType.TO;
  }

  const fromIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(fromToken);
  const toIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(toToken);

  if (toIsKnownUnsupported && !fromIsKnownUnsupported) {
    return ESwapDirectionType.FROM;
  }
  if (fromIsKnownUnsupported && !toIsKnownUnsupported) {
    return ESwapDirectionType.TO;
  }

  if (!fromIsKnownUnsupported && !toIsKnownUnsupported) {
    if (fromTokenIsStable !== toTokenIsStable) {
      return fromTokenIsStable
        ? ESwapDirectionType.TO
        : ESwapDirectionType.FROM;
    }
  }

  return ESwapDirectionType.TO;
}

export function getResolvableDefaultSwapKLineSide({
  fromToken,
  fromTokenIsStable,
  isStableTokenCheckLoading,
  toToken,
  toTokenIsStable,
}: {
  fromToken?: ISwapKLineToken;
  fromTokenIsStable?: boolean;
  isStableTokenCheckLoading?: boolean;
  toToken?: ISwapKLineToken;
  toTokenIsStable?: boolean;
}): ESwapDirectionType | undefined {
  if (!toToken) {
    return ESwapDirectionType.FROM;
  }
  if (!fromToken) {
    return ESwapDirectionType.TO;
  }

  const fromIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(fromToken);
  const toIsKnownUnsupported = isKnownSwapKLineUnsupportedToken(toToken);

  if (toIsKnownUnsupported && !fromIsKnownUnsupported) {
    return ESwapDirectionType.FROM;
  }
  if (fromIsKnownUnsupported && !toIsKnownUnsupported) {
    return ESwapDirectionType.TO;
  }

  if (isStableTokenCheckLoading) {
    return undefined;
  }

  return getDefaultSwapKLineSide({
    fromToken,
    fromTokenIsStable,
    toToken,
    toTokenIsStable,
  });
}
