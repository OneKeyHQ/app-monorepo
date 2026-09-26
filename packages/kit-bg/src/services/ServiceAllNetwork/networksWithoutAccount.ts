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

export interface INetworkImplGroupDeriveTypes {
  mergeDeriveAssetsEnabled: boolean;
  deriveTypes: string[];
  currentDeriveType: string;
}

/**
 * Resolves which impl groups have no account for an indexed account from the
 * chain settings and the stored account ids alone. Building network accounts
 * would load each chain's vault and core modules just to answer a yes/no
 * question, and running every group at once lets that work get ahead of other
 * background requests (e.g. the account selector's wallet list) during a cold
 * start. Groups therefore run one after another and yield before each one,
 * and the stored ids are read in a single batch at the end.
 */
export async function resolveNetworkIdsWithoutAccount({
  groups,
  getGroupDeriveTypes,
  getAccountId,
  getExistingAccountIds,
  yieldToQueue,
}: {
  groups: INetworkImplGroup[];
  getGroupDeriveTypes: (
    networkId: string,
  ) => Promise<INetworkImplGroupDeriveTypes>;
  getAccountId: (params: {
    networkId: string;
    deriveType: string;
  }) => Promise<string>;
  getExistingAccountIds: (accountIds: string[]) => Promise<Set<string>>;
  yieldToQueue: () => Promise<void>;
}): Promise<string[]> {
  const probes: Array<
    INetworkImplGroupDeriveTypes & {
      group: INetworkImplGroup;
      candidates: Array<{ deriveType: string; accountId: string }>;
    }
  > = [];
  for (const group of groups) {
    // eslint-disable-next-line no-await-in-loop
    await yieldToQueue();
    const networkId = group.networkIds[0];
    let deriveTypesInfo: INetworkImplGroupDeriveTypes | undefined;
    try {
      // eslint-disable-next-line no-await-in-loop
      deriveTypesInfo = await getGroupDeriveTypes(networkId);
    } catch {
      // Unknown settings: leave the group out rather than flag a missing
      // address that may exist.
    }
    if (deriveTypesInfo) {
      const candidateDeriveTypes = deriveTypesInfo.mergeDeriveAssetsEnabled
        ? deriveTypesInfo.deriveTypes
        : [deriveTypesInfo.currentDeriveType];
      const candidates: Array<{ deriveType: string; accountId: string }> = [];
      for (const deriveType of candidateDeriveTypes) {
        try {
          candidates.push({
            deriveType,
            // eslint-disable-next-line no-await-in-loop
            accountId: await getAccountId({ networkId, deriveType }),
          });
        } catch {
          // No address can be derived for this derive type.
        }
      }
      probes.push({ ...deriveTypesInfo, group, candidates });
    }
  }
  const candidateIds = Array.from(
    new Set(
      probes.flatMap((probe) => probe.candidates.map((c) => c.accountId)),
    ),
  );
  const existingIds = candidateIds.length
    ? await getExistingAccountIds(candidateIds)
    : new Set<string>();
  return probes.flatMap((probe) =>
    pickNetworkIdsWithoutAccount({
      group: probe.group,
      mergeDeriveAssetsEnabled: probe.mergeDeriveAssetsEnabled,
      accountDeriveTypes: probe.candidates
        .filter((c) => existingIds.has(c.accountId))
        .map((c) => c.deriveType),
      currentDeriveType: probe.currentDeriveType,
    }),
  );
}
