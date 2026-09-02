import { Semaphore } from 'async-mutex';

import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import type { IAccountSelectorSelectedAccount } from './SimpleDbEntityAccountSelector';

export type IAccountSelectorPersistenceScope = {
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  num: number;
};

export type IAccountSelectorStorageInitScope = Omit<
  IAccountSelectorPersistenceScope,
  'num'
>;

export type IAccountSelectorPersistenceLockToken = symbol;

const persistenceMutex = new Semaphore(1);
const activeLockTokens = new Set<IAccountSelectorPersistenceLockToken>();
const writeIntentEpochs = new Map<string, number>();
const latestSelectionIntents = new Map<
  string,
  IAccountSelectorSelectedAccount
>();
const latestSelectionIntentStorageInitGenerations = new Map<string, number>();
const storageInitGenerations = new Map<string, number>();
const storageInitHomeIntentBaselines = new Map<
  string,
  {
    generation: number;
    homeIntentEpoch: number;
    homeStorageInitGeneration: number;
  }
>();
let nextWriteIntentEpoch = 0;

const selectedAccountFields = [
  'walletId',
  'indexedAccountId',
  'othersWalletAccountId',
  'networkId',
  'deriveType',
  'focusedWallet',
] as const satisfies readonly (keyof IAccountSelectorSelectedAccount)[];

function buildScopeKey({
  sceneName,
  sceneUrl,
  num,
}: IAccountSelectorPersistenceScope) {
  return `${sceneName}:${sceneUrl ?? ''}:${num}`;
}

function buildStorageInitScopeKey({
  sceneName,
  sceneUrl,
}: IAccountSelectorStorageInitScope) {
  return `${sceneName}:${sceneUrl ?? ''}`;
}

function getHomeStorageInitGeneration() {
  return (
    storageInitGenerations.get(
      buildStorageInitScopeKey({
        sceneName: EAccountSelectorSceneName.home,
      }),
    ) ?? 0
  );
}

export function areAccountSelectorSelectionsEqual(
  first: IAccountSelectorSelectedAccount | null | undefined,
  second: IAccountSelectorSelectedAccount | null | undefined,
) {
  return selectedAccountFields.every(
    (field) => first?.[field] === second?.[field],
  );
}

export function recordAccountSelectorWriteIntent(
  scope: IAccountSelectorPersistenceScope,
  options?: { preserveStorageInitGeneration?: number },
) {
  nextWriteIntentEpoch += 1;
  writeIntentEpochs.set(buildScopeKey(scope), nextWriteIntentEpoch);
  const storageInitScopeKey = buildStorageInitScopeKey(scope);
  const currentStorageInitGeneration =
    storageInitGenerations.get(storageInitScopeKey);
  if (
    currentStorageInitGeneration !== undefined &&
    currentStorageInitGeneration !== options?.preserveStorageInitGeneration
  ) {
    storageInitGenerations.set(
      storageInitScopeKey,
      currentStorageInitGeneration + 1,
    );
  }
  return nextWriteIntentEpoch;
}

function copySelectionFingerprint(
  selectedAccount: IAccountSelectorSelectedAccount,
): IAccountSelectorSelectedAccount {
  return {
    deriveType: selectedAccount.deriveType,
    focusedWallet: selectedAccount.focusedWallet,
    indexedAccountId: selectedAccount.indexedAccountId,
    networkId: selectedAccount.networkId,
    othersWalletAccountId: selectedAccount.othersWalletAccountId,
    walletId: selectedAccount.walletId,
  };
}

export function recordAccountSelectorSelectionIntent(
  scope: IAccountSelectorPersistenceScope,
  selectedAccount: IAccountSelectorSelectedAccount,
) {
  const epoch = recordAccountSelectorWriteIntent(scope);
  const scopeKey = buildScopeKey(scope);
  latestSelectionIntents.set(
    scopeKey,
    copySelectionFingerprint(selectedAccount),
  );
  latestSelectionIntentStorageInitGenerations.set(
    scopeKey,
    storageInitGenerations.get(buildStorageInitScopeKey(scope)) ?? 0,
  );
  return epoch;
}

export function getAccountSelectorLatestSelectionIntent(
  scope: IAccountSelectorPersistenceScope,
) {
  const selectedAccount = latestSelectionIntents.get(buildScopeKey(scope));
  return selectedAccount
    ? copySelectionFingerprint(selectedAccount)
    : undefined;
}

export function isAccountSelectorSelectionIntentCurrent({
  epoch,
  scope,
  selectedAccount,
}: {
  epoch: number | undefined;
  scope: IAccountSelectorPersistenceScope;
  selectedAccount: IAccountSelectorSelectedAccount;
}) {
  return (
    epoch !== undefined &&
    getAccountSelectorWriteIntentEpoch(scope) === epoch &&
    areAccountSelectorSelectionsEqual(
      getAccountSelectorLatestSelectionIntent(scope),
      selectedAccount,
    )
  );
}

export function invalidateStorageInitStartedAfterSelectionIntent(
  scope: IAccountSelectorPersistenceScope,
) {
  const scopeKey = buildScopeKey(scope);
  const storageInitScopeKey = buildStorageInitScopeKey(scope);
  const generationAtIntent =
    latestSelectionIntentStorageInitGenerations.get(scopeKey) ?? 0;
  const currentGeneration =
    storageInitGenerations.get(storageInitScopeKey) ?? 0;
  if (currentGeneration !== generationAtIntent) {
    const invalidatedGeneration = currentGeneration + 1;
    storageInitGenerations.set(storageInitScopeKey, invalidatedGeneration);
    latestSelectionIntentStorageInitGenerations.set(
      scopeKey,
      invalidatedGeneration,
    );
  }
}

export function getAccountSelectorWriteIntentEpoch(
  scope: IAccountSelectorPersistenceScope,
) {
  return writeIntentEpochs.get(buildScopeKey(scope)) ?? 0;
}

export function isAccountSelectorStorageInitGenerationCurrent({
  generation,
  scope,
}: {
  generation: number;
  scope: IAccountSelectorStorageInitScope;
}) {
  return (
    storageInitGenerations.get(buildStorageInitScopeKey(scope)) === generation
  );
}

export function isAccountSelectorStorageInitHomeIntentCurrent({
  generation,
  scope,
}: {
  generation: number;
  scope: IAccountSelectorStorageInitScope;
}) {
  const baseline = storageInitHomeIntentBaselines.get(
    buildStorageInitScopeKey(scope),
  );
  return (
    baseline?.generation === generation &&
    baseline.homeIntentEpoch ===
      getAccountSelectorWriteIntentEpoch({
        num: 0,
        sceneName: EAccountSelectorSceneName.home,
      }) &&
    baseline.homeStorageInitGeneration === getHomeStorageInitGeneration()
  );
}

export async function runAccountSelectorPersistenceExclusive<T>(
  task: (lockToken: IAccountSelectorPersistenceLockToken) => Promise<T> | T,
  lockToken?: IAccountSelectorPersistenceLockToken,
): Promise<T> {
  if (lockToken && activeLockTokens.has(lockToken)) {
    return task(lockToken);
  }
  return persistenceMutex.runExclusive(async () => {
    const nextLockToken = Symbol('account-selector-persistence-lock');
    activeLockTokens.add(nextLockToken);
    try {
      return await task(nextLockToken);
    } finally {
      activeLockTokens.delete(nextLockToken);
    }
  });
}

export function beginAccountSelectorStorageInit(
  scope: IAccountSelectorStorageInitScope,
) {
  const scopeKey = buildStorageInitScopeKey(scope);
  const generation = (storageInitGenerations.get(scopeKey) ?? 0) + 1;
  storageInitGenerations.set(scopeKey, generation);
  storageInitHomeIntentBaselines.set(scopeKey, {
    generation,
    homeIntentEpoch: getAccountSelectorWriteIntentEpoch({
      num: 0,
      sceneName: EAccountSelectorSceneName.home,
    }),
    homeStorageInitGeneration: getHomeStorageInitGeneration(),
  });
  return generation;
}
