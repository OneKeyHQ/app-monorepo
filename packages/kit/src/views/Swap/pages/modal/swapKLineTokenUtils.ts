import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { isTokenSelectorDappToken } from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import type { ITokenDappType } from '@onekeyhq/shared/types/token';

import {
  type ISwapStableTokenIdentity,
  fetchSwapStableTokenStatus,
  getSwapStableTokenAddress,
  getSwapStableTokenKey,
  getSwapStableTokenStatusFromMap,
} from '../../utils/swapStableCoinUtils';

export type ISwapKLineToken = ISwapToken & {
  defiMarked?: boolean;
  dappName?: string | null;
  dappType?: ITokenDappType;
};

type ISwapKLineTokenSymbol = Pick<ISwapToken, 'symbol'>;

export function haveSameSwapKLineTokenSymbol({
  fromToken,
  toToken,
}: {
  fromToken?: ISwapKLineTokenSymbol;
  toToken?: ISwapKLineTokenSymbol;
}) {
  const fromSymbol = fromToken?.symbol.trim().toLowerCase();
  const toSymbol = toToken?.symbol.trim().toLowerCase();
  return Boolean(fromSymbol && toSymbol && fromSymbol === toSymbol);
}

export function isKnownSwapKLineUnsupportedToken(token?: ISwapKLineToken) {
  if (!token) {
    return false;
  }
  return isTokenSelectorDappToken(token);
}

export function getSwapKLineStableTokenAddress(
  token?: ISwapStableTokenIdentity,
) {
  return getSwapStableTokenAddress(token);
}

export function getSwapKLineStableTokenKey(token?: ISwapStableTokenIdentity) {
  return getSwapStableTokenKey(token);
}

export async function fetchSwapKLineTokenAddressesStableStatus(
  stableTokens: (ISwapStableTokenIdentity | undefined)[],
): Promise<Map<string, boolean>> {
  return fetchSwapStableTokenStatus(stableTokens);
}

export async function fetchSwapKLineTokensStableStatus(
  tokens: (ISwapKLineToken | undefined)[],
): Promise<Map<string, boolean>> {
  return fetchSwapKLineTokenAddressesStableStatus(tokens);
}

export function getSwapKLineStableTokenStatusFromMap({
  stableStatusMap,
  stableTokenKey,
}: {
  stableStatusMap: Map<string, boolean>;
  stableTokenKey?: string;
}) {
  return getSwapStableTokenStatusFromMap({
    stableStatusMap,
    stableTokenKey,
  });
}

export function getSwapKLineTokenStableStatusFromMap({
  stableStatusMap,
  token,
}: {
  stableStatusMap: Map<string, boolean>;
  token?: ISwapKLineToken;
}) {
  return getSwapKLineStableTokenStatusFromMap({
    stableStatusMap,
    stableTokenKey: getSwapKLineStableTokenKey(token),
  });
}

export async function fetchSwapKLineTokenIsStable(
  token?: ISwapKLineToken,
): Promise<boolean> {
  const stableStatusMap = await fetchSwapKLineTokensStableStatus([token]);
  return getSwapKLineTokenStableStatusFromMap({ stableStatusMap, token });
}

export async function prefetchSwapKLineTokenInfo(
  tokens: (ISwapKLineToken | undefined)[],
) {
  const tokenInfoRequests = new Map<
    string,
    { networkId: string; tokenAddress: string }
  >();

  tokens.forEach((token) => {
    if (!token?.networkId || isKnownSwapKLineUnsupportedToken(token)) {
      return;
    }

    const tokenAddress = token.contractAddress ?? '';
    const requestKey = `${token.networkId}:${tokenAddress}`;
    tokenInfoRequests.set(requestKey, {
      networkId: token.networkId,
      tokenAddress,
    });
  });

  await Promise.all(
    Array.from(tokenInfoRequests.values()).map(async (params) => {
      try {
        await backgroundApiProxy.serviceToken.fetchTokenInfoOnly(params);
      } catch {
        // Prefetch must not block opening; mounted consumers own retry handling.
      }
    }),
  );
}

export async function prefetchSwapKLineMetadata(
  tokens: (ISwapKLineToken | undefined)[],
) {
  await Promise.all([
    prefetchSwapKLineTokenInfo(tokens),
    fetchSwapKLineTokensStableStatus(tokens),
  ]);
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
