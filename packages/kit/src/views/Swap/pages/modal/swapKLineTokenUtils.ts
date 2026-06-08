import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import { ESwapDirectionType } from '@onekeyhq/shared/types/swap/types';
import { ETokenDappType } from '@onekeyhq/shared/types/token';
import type { ITokenDappType } from '@onekeyhq/shared/types/token';

export type ISwapKLineToken = ISwapToken & {
  defiMarked?: boolean;
  dappName?: string | null;
  dappType?: ITokenDappType;
};

type ISwapKLineStableTokenIdentity = {
  networkId?: string;
  contractAddress?: string;
  isNative?: boolean;
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

export function getSwapKLineStableTokenAddress(
  token?: ISwapKLineStableTokenIdentity,
) {
  const address = token?.contractAddress?.trim();
  if (!token?.networkId || token.isNative || !address) {
    return undefined;
  }
  return address.startsWith('0x') ? address.toLowerCase() : address;
}

export function getSwapKLineStableTokenKey(
  token?: ISwapKLineStableTokenIdentity,
) {
  const address = getSwapKLineStableTokenAddress(token);
  return token?.networkId && address ? `${token.networkId}:${address}` : '';
}

export async function fetchSwapKLineTokenAddressesStableStatus(
  stableTokens: (ISwapKLineStableTokenIdentity | undefined)[],
): Promise<Map<string, boolean>> {
  const tokensByNetwork = stableTokens.reduce<Record<string, Set<string>>>(
    (acc, token) => {
      const address = getSwapKLineStableTokenAddress(token);
      if (token?.networkId && address) {
        acc[token.networkId] ??= new Set<string>();
        acc[token.networkId].add(address);
      }
      return acc;
    },
    {},
  );
  const list = Object.entries(tokensByNetwork).map(
    ([networkId, contractAddressSet]) => ({
      networkId,
      contractAddressList: Array.from(contractAddressSet),
    }),
  );

  if (!list.length) {
    return new Map();
  }

  try {
    const stableCoinsList =
      await backgroundApiProxy.serviceSwap.checkStableCoinsList({
        list,
      });

    return new Map(
      stableCoinsList.flatMap((item) =>
        item.results.map((result) => {
          const contractAddress = result.contractAddress.startsWith('0x')
            ? result.contractAddress.toLowerCase()
            : result.contractAddress;
          return [
            `${item.networkId}:${contractAddress}`,
            result.isStableCoin,
          ] as const;
        }),
      ),
    );
  } catch {
    return new Map();
  }
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
  return stableTokenKey
    ? (stableStatusMap.get(stableTokenKey) ?? false)
    : false;
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
