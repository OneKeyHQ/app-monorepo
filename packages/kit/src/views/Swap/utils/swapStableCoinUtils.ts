import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';

export type ISwapStableTokenIdentity = {
  networkId?: string;
  contractAddress?: string;
  isNative?: boolean;
};

export function getSwapStableTokenAddress(token?: ISwapStableTokenIdentity) {
  const address = token?.contractAddress?.trim();
  if (!token?.networkId || token.isNative || !address) {
    return undefined;
  }
  return normalizeTokenContractAddress({
    networkId: token.networkId,
    contractAddress: address,
  });
}

export function getSwapStableTokenKey(token?: ISwapStableTokenIdentity) {
  const address = getSwapStableTokenAddress(token);
  return token?.networkId && address ? `${token.networkId}:${address}` : '';
}

export async function fetchSwapStableTokenStatus(
  tokens: (ISwapStableTokenIdentity | undefined)[],
): Promise<Map<string, boolean>> {
  const tokensByNetwork = tokens.reduce<Record<string, Set<string>>>(
    (acc, token) => {
      const address = getSwapStableTokenAddress(token);
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
      await backgroundApiProxy.serviceSwap.checkStableCoinsList({ list });

    return new Map(
      stableCoinsList.flatMap((item) =>
        item.results.flatMap((result) => {
          const stableTokenKey = getSwapStableTokenKey({
            networkId: item.networkId,
            contractAddress: result.contractAddress,
          });
          return stableTokenKey
            ? ([[stableTokenKey, result.isStableCoin]] as const)
            : [];
        }),
      ),
    );
  } catch {
    // Stable classification is best-effort. Missing data follows the product
    // rule to treat the token as non-stable and must not block tab switching.
    return new Map();
  }
}

export function getSwapStableTokenStatusFromMap({
  stableStatusMap,
  stableTokenKey,
}: {
  stableStatusMap: ReadonlyMap<string, boolean>;
  stableTokenKey?: string;
}) {
  return stableTokenKey
    ? (stableStatusMap.get(stableTokenKey) ?? false)
    : false;
}
