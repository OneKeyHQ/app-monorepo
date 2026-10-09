import BigNumber from 'bignumber.js';

import type {
  ISwapNetwork,
  ISwapToken,
} from '@onekeyhq/shared/types/swap/types';

export type ISwapNetworkGroup = {
  network: ISwapNetwork;
  children: ISwapNetwork[];
};

export type ISwapNetworkAsset = {
  network: ISwapNetwork;
  fiatValue: string;
};

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
