import { equalTokenNoCaseSensitive } from '@onekeyhq/shared/src/utils/tokenUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import { ETokenDappType } from '@onekeyhq/shared/types/token';
import type { ITokenDappType } from '@onekeyhq/shared/types/token';

export type ISwapKLineToken = ISwapToken & {
  defiMarked?: boolean;
  dappName?: string | null;
  dappType?: ITokenDappType;
};

export type ISwapKLineStableToken = Pick<
  ISwapToken,
  'contractAddress' | 'networkId'
>;

export function isKnownSwapKLineUnsupportedToken(token?: ISwapKLineToken) {
  if (!token) {
    return false;
  }
  if (token.dappType === ETokenDappType.WalletToken) {
    return false;
  }
  return Boolean(token.defiMarked || token.dappName?.trim() || token.dappType);
}

export function isSwapKLineStableToken({
  token,
  stableTokens,
}: {
  token?: ISwapKLineToken;
  stableTokens?: ISwapKLineStableToken[];
}) {
  if (!token) {
    return false;
  }

  if (!stableTokens?.length) {
    return false;
  }

  return stableTokens.some((stableToken) =>
    equalTokenNoCaseSensitive({
      token1: token,
      token2: stableToken,
    }),
  );
}

export function getDefaultSwapKLineSide({
  fromToken,
  stableTokens,
  toToken,
}: {
  fromToken?: ISwapKLineToken;
  stableTokens?: ISwapKLineStableToken[];
  toToken?: ISwapKLineToken;
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
    const fromIsStable = isSwapKLineStableToken({
      token: fromToken,
      stableTokens,
    });
    const toIsStable = isSwapKLineStableToken({
      token: toToken,
      stableTokens,
    });
    if (fromIsStable !== toIsStable) {
      return fromIsStable ? ESwapDirectionType.TO : ESwapDirectionType.FROM;
    }
  }

  return ESwapDirectionType.TO;
}

export function getResolvableDefaultSwapKLineSide({
  fromToken,
  stableTokens,
  toToken,
}: {
  fromToken?: ISwapKLineToken;
  stableTokens?: ISwapKLineStableToken[];
  toToken?: ISwapKLineToken;
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

  if (stableTokens === undefined) {
    return undefined;
  }

  return getDefaultSwapKLineSide({
    fromToken,
    stableTokens,
    toToken,
  });
}
