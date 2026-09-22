export interface INetworkImplGroup {
  impl: string;
  networkIds: string[];
}

/**
 * Networks that share an `impl` share their address derivation, so the
 * "does this indexed account have an address here" question is answered once
 * per impl and applied to every network in the group.
 */
export function groupNetworkIdsByImpl(
  networks: Array<{ id: string; impl: string }>,
): INetworkImplGroup[] {
  const groups = new Map<string, INetworkImplGroup>();
  for (const network of networks) {
    let group = groups.get(network.impl);
    if (!group) {
      group = { impl: network.impl, networkIds: [] };
      groups.set(network.impl, group);
    }
    group.networkIds.push(network.id);
  }
  return Array.from(groups.values());
}

/**
 * The networks of one impl group that have no usable account: none at all
 * when the network merges derive-type assets, otherwise none for the derive
 * type the user currently has selected for that network.
 */
export function pickNetworkIdsWithoutAccount({
  group,
  mergeDeriveAssetsEnabled,
  accountDeriveTypes,
  currentDeriveType,
}: {
  group: INetworkImplGroup;
  mergeDeriveAssetsEnabled: boolean;
  accountDeriveTypes: string[];
  currentDeriveType: string;
}): string[] {
  const hasAccount = mergeDeriveAssetsEnabled
    ? accountDeriveTypes.length > 0
    : accountDeriveTypes.includes(currentDeriveType);
  return hasAccount ? [] : [...group.networkIds];
}
