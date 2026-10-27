import BigNumber from 'bignumber.js';

import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import { normalizeTokenContractAddress } from '@onekeyhq/shared/src/utils/tokenUtils';
import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

export function getSwapTokenSelectorTokenKey(
  item: ISwapToken | IFuseResult<ISwapToken>,
) {
  const token = 'item' in item ? item.item : item;
  const contractAddress = normalizeTokenContractAddress({
    networkId: token.networkId,
    contractAddress: token.contractAddress,
  });
  return `${token.networkId}:${contractAddress ?? ''}`;
}

export type ISwapNetworkGroup = {
  network: ISwapNetwork;
  children: ISwapNetwork[];
};

export type ISwapNetworkAsset = {
  network: ISwapNetwork;
  fiatValue: string;
};

export type ISwapTokenSelectorNetworkSnapshot = {
  scopeKey: string;
  structure?: {
    allNetwork: ISwapNetwork;
    sameChainNetwork?: ISwapNetwork;
    groups: ISwapNetworkGroup[];
  };
  assetNetworks?: ISwapNetworkAsset[];
};

/** A selector session pins row membership; refreshed values remain independent. */
export function updateSwapTokenSelectorNetworkSnapshot({
  snapshot,
  scopeKey,
  networksReady,
  allNetwork,
  sameChainNetwork,
  networks,
  assetNetworks,
}: {
  snapshot: ISwapTokenSelectorNetworkSnapshot;
  scopeKey: string;
  networksReady: boolean;
  allNetwork: ISwapNetwork;
  sameChainNetwork?: ISwapNetwork;
  networks: ISwapNetwork[];
  assetNetworks?: ISwapNetworkAsset[];
}): ISwapTokenSelectorNetworkSnapshot {
  let next: ISwapTokenSelectorNetworkSnapshot =
    snapshot.scopeKey === scopeKey ? snapshot : { scopeKey };
  if (!next.structure && networksReady) {
    next = {
      ...next,
      structure: {
        allNetwork,
        sameChainNetwork,
        groups: buildSwapTokenSelectorNetworkGroups({
          networks: [
            ...networks,
            ...(sameChainNetwork ? [sameChainNetwork] : []),
          ],
        }),
      },
    };
  }
  // Undefined is pending; [] is a completed snapshot with no asset networks.
  if (
    next.structure &&
    next.assetNetworks === undefined &&
    assetNetworks !== undefined
  ) {
    next = { ...next, assetNetworks };
  }
  return next;
}

/** Filters the pinned hierarchy without rebuilding it from live sort metadata. */
export function resolveSwapTokenSelectorNetworkGroups({
  groups,
  networkMap,
  searchValue,
}: {
  groups: ISwapNetworkGroup[];
  networkMap: ReadonlyMap<string, ISwapNetwork>;
  searchValue?: string;
}): ISwapNetworkGroup[] {
  const search = searchValue?.trim().toLowerCase();
  const matches = (network: ISwapNetwork) =>
    !search ||
    [network.name, network.symbol, network.networkId].some((value) =>
      value.toLowerCase().includes(search),
    );
  return groups.flatMap(({ network, children }) => {
    const currentNetwork = networkMap.get(network.networkId) ?? network;
    const currentChildren = children
      .map((child) => networkMap.get(child.networkId) ?? child)
      .filter(matches);
    if (matches(currentNetwork)) {
      return [{ network: currentNetwork, children: currentChildren }];
    }
    return currentChildren.map((child) => ({ network: child, children: [] }));
  });
}

export function resolveSwapTokenSelectorAssetNetworks({
  snapshot,
  assetNetworks,
  networkMap,
}: {
  snapshot?: ISwapNetworkAsset[];
  assetNetworks?: ISwapNetworkAsset[];
  networkMap: ReadonlyMap<string, ISwapNetwork>;
}): ISwapNetworkAsset[] {
  const values = new Map(
    assetNetworks?.map(({ network, fiatValue }) => [
      network.networkId,
      fiatValue,
    ]),
  );
  return (snapshot ?? []).map(({ network, fiatValue }) => ({
    network: networkMap.get(network.networkId) ?? network,
    fiatValue:
      assetNetworks === undefined
        ? fiatValue
        : (values.get(network.networkId) ?? '0'),
  }));
}

function compareNetworkName(a: ISwapNetwork, b: ISwapNetwork) {
  const aName = a.name.toLowerCase();
  const bName = b.name.toLowerCase();
  if (aName < bName) {
    return -1;
  }
  if (aName > bName) {
    return 1;
  }
  return 0;
}

/** Groups L2 networks under their server-provided parent, with a flat fallback. */
export function buildSwapTokenSelectorNetworkGroups({
  networks,
  searchValue,
}: {
  networks: ISwapNetwork[];
  searchValue?: string;
}): ISwapNetworkGroup[] {
  const search = searchValue?.trim().toLowerCase();
  const visibleNetworks = networks
    .filter((network) => !network.isAllNetworks)
    .filter((network) => {
      if (!search) {
        return true;
      }
      return (
        network.name.toLowerCase().includes(search) ||
        network.symbol.toLowerCase().includes(search) ||
        network.networkId.toLowerCase().includes(search)
      );
    });
  const visibleIds = new Set(
    visibleNetworks.map((network) => network.networkId),
  );
  const childrenByParent = new Map<string, ISwapNetwork[]>();
  const topLevelNetworks: ISwapNetwork[] = [];

  visibleNetworks.forEach((network) => {
    const parentId = network.isL2 ? network.parentNetworkId : undefined;
    if (parentId && visibleIds.has(parentId)) {
      const children = childrenByParent.get(parentId) ?? [];
      children.push(network);
      childrenByParent.set(parentId, children);
    } else {
      topLevelNetworks.push(network);
    }
  });

  return topLevelNetworks.toSorted(compareNetworkName).map((network) => ({
    network,
    children: (childrenByParent.get(network.networkId) ?? []).toSorted(
      compareNetworkName,
    ),
  }));
}

/** Sums account token values by network for the Networks with assets section. */
export function buildSwapTokenSelectorAssetNetworks({
  networks,
  tokens,
}: {
  networks: ISwapNetwork[];
  tokens?: ISwapToken[];
}): ISwapNetworkAsset[] {
  if (!tokens?.length) {
    return [];
  }
  const networkMap = new Map(
    networks.map((network) => [network.networkId, network]),
  );
  const totals = new Map<string, BigNumber>();
  tokens.forEach((token) => {
    const network = networkMap.get(token.networkId);
    const balance = new BigNumber(token.balanceParsed ?? '0');
    const fiatValue = new BigNumber(token.fiatValue ?? '0');
    if (
      !network ||
      balance.isNaN() ||
      balance.isZero() ||
      fiatValue.isNaN() ||
      fiatValue.isZero()
    ) {
      return;
    }
    totals.set(
      token.networkId,
      (totals.get(token.networkId) ?? new BigNumber(0)).plus(fiatValue),
    );
  });

  return Array.from(totals.entries())
    .map(([networkId, fiatValue]) => ({
      network: networkMap.get(networkId) as ISwapNetwork,
      fiatValue: fiatValue.toFixed(),
    }))
    .toSorted((a, b) => {
      const valueOrder = new BigNumber(b.fiatValue).comparedTo(a.fiatValue);
      return valueOrder === 0
        ? compareNetworkName(a.network, b.network)
        : valueOrder;
    });
}
