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

export function isKnownSwapKLineUnsupportedToken(token?: ISwapKLineToken) {
  if (!token) {
    return false;
  }
  if (token.dappType === ETokenDappType.WalletToken) {
    return false;
  }
  return Boolean(token.defiMarked || token.dappName?.trim() || token.dappType);
}

export function getSwapKLineStableTokenAddress(token?: ISwapKLineToken) {
  const address = token?.contractAddress?.trim();
  if (!token?.networkId || token.isNative || !address) {
    return undefined;
  }
  return address.startsWith('0x') ? address.toLowerCase() : address;
}

export async function fetchSwapKLineTokenAddressesStableStatus(
  stableTokenAddresses: (string | undefined)[],
): Promise<Map<string, boolean>> {
  const contractAddressesList = Array.from(
    new Set(
      stableTokenAddresses.filter((address): address is string =>
        Boolean(address),
      ),
    ),
  );

  if (!contractAddressesList.length) {
    return new Map();
  }

  try {
    const stableCoinsList =
      await backgroundApiProxy.serviceSwap.checkStableCoinsList({
        contractAddressesList,
      });

    return new Map(
      stableCoinsList.map((item) => [
        item.contractAddress.startsWith('0x')
          ? item.contractAddress.toLowerCase()
          : item.contractAddress,
        item.isStableCoin,
      ]),
    );
  } catch {
    return new Map();
  }
}

export async function fetchSwapKLineTokensStableStatus(
  tokens: (ISwapKLineToken | undefined)[],
): Promise<Map<string, boolean>> {
  return fetchSwapKLineTokenAddressesStableStatus(
    tokens.map((token) => getSwapKLineStableTokenAddress(token)),
  );
}

export function getSwapKLineStableTokenStatusFromMap({
  stableStatusMap,
  stableTokenAddress,
}: {
  stableStatusMap: Map<string, boolean>;
  stableTokenAddress?: string;
}) {
  return stableTokenAddress
    ? (stableStatusMap.get(stableTokenAddress) ?? false)
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
    stableTokenAddress: getSwapKLineStableTokenAddress(token),
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
