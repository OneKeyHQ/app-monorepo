export interface INativeHomePortfolioOwner {
  epoch: number;
  scopeKey: string;
}

export interface INativeHomePortfolioRequestToken extends INativeHomePortfolioOwner {
  generation: number;
}

export function buildNativeHomePortfolioScopeKey({
  accountId,
  enabled,
  isAllNetworks,
  networkId,
  walletId,
}: {
  accountId?: string;
  enabled: boolean;
  isAllNetworks: boolean;
  networkId?: string;
  walletId?: string;
}): string {
  return [
    enabled ? 'enabled' : 'disabled',
    walletId ?? '',
    accountId ?? '',
    networkId ?? '',
    isAllNetworks ? 'all' : 'single',
  ].join('::');
}

export function shouldShowNativeHomeMissingAccount({
  accountId,
  isAllNetworks,
  networkId,
  ready,
  walletId,
}: {
  accountId?: string;
  isAllNetworks: boolean;
  networkId?: string;
  ready: boolean;
  walletId?: string;
}): boolean {
  return Boolean(
    ready && walletId && networkId && !isAllNetworks && !accountId,
  );
}

export function advanceNativeHomePortfolioOwner(
  current: INativeHomePortfolioOwner,
  scopeKey: string,
): INativeHomePortfolioOwner {
  if (current.scopeKey === scopeKey) {
    return current;
  }
  return {
    epoch: current.epoch + 1,
    scopeKey,
  };
}

export function isNativeHomePortfolioOwnerCurrent({
  current,
  expected,
}: {
  current: INativeHomePortfolioOwner;
  expected: INativeHomePortfolioOwner;
}): boolean {
  return (
    current.epoch === expected.epoch && current.scopeKey === expected.scopeKey
  );
}

export function isNativeHomePortfolioRequestCurrent({
  currentGeneration,
  currentOwner,
  request,
}: {
  currentGeneration: number;
  currentOwner: INativeHomePortfolioOwner;
  request: INativeHomePortfolioRequestToken;
}): boolean {
  return (
    isNativeHomePortfolioOwnerCurrent({
      current: currentOwner,
      expected: request,
    }) && request.generation >= currentGeneration
  );
}

interface INativeHomeSingleFlightEntry {
  owner: INativeHomePortfolioOwner;
  promise: Promise<void>;
  rerunRequested: boolean;
  task: () => Promise<void>;
}

export function createNativeHomeSingleFlightRunner({
  isOwnerCurrent,
}: {
  isOwnerCurrent: (owner: INativeHomePortfolioOwner) => boolean;
}) {
  const entries = new Map<string, INativeHomeSingleFlightEntry>();
  const getOwnerKey = (owner: INativeHomePortfolioOwner) =>
    `${owner.epoch}::${owner.scopeKey}`;

  return {
    run(
      owner: INativeHomePortfolioOwner,
      task: () => Promise<void>,
    ): Promise<void> {
      const ownerKey = getOwnerKey(owner);
      const active = entries.get(ownerKey);
      if (active) {
        active.rerunRequested = true;
        active.task = task;
        return active.promise;
      }

      const entry: INativeHomeSingleFlightEntry = {
        owner,
        promise: Promise.resolve(),
        rerunRequested: false,
        task,
      };
      entry.promise = (async () => {
        do {
          entry.rerunRequested = false;
          await entry.task();
        } while (entry.rerunRequested && isOwnerCurrent(entry.owner));
      })().finally(() => {
        if (entries.get(ownerKey) === entry) {
          entries.delete(ownerKey);
        }
      });
      entries.set(ownerKey, entry);
      return entry.promise;
    },
  };
}
