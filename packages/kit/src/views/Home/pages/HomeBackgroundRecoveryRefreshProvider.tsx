import type { PropsWithChildren } from 'react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { INativeBackgroundThreadReadySignal } from '@onekeyhq/kit-bg/src/apis/BackgroundApiProxyBase';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import {
  claimAccountSelectorBackgroundRecovery,
  getAccountSelectorBackgroundRecoveryRawReadySequence,
  onAccountSelectorBackgroundRecoveryComplete,
  onAccountSelectorBackgroundRecoveryRawReady,
} from '../../../components/AccountSelector/accountSelectorBackgroundRecovery';
import {
  useAccountSelectorStorageInitDoneAtom,
  useActiveAccount,
  useIsAccountSelectorActiveAccountInitDone,
} from '../../../states/jotai/contexts/accountSelector';

import { resolveHomeWalletContentReadiness } from './homePageNoWalletContent';
import { useHomeWalletList } from './HomeWalletListProvider';

export const EHomeBackgroundRecoveryRefreshDomain = {
  renderer: 'renderer',
  legacyWalletTokens: 'legacy-wallet-tokens',
  legacyPortfolioDeFiOverview: 'legacy-portfolio-defi-overview',
  legacyHeaderPerpsWorth: 'legacy-header-perps-worth',
  legacyBanner: 'legacy-banner',
  legacyPerps: 'legacy-perps',
  legacyDeFi: 'legacy-defi',
  legacyNft: 'legacy-nft',
  legacyHistory: 'legacy-history',
} as const;

export type IHomeBackgroundRecoveryRefreshDomain =
  (typeof EHomeBackgroundRecoveryRefreshDomain)[keyof typeof EHomeBackgroundRecoveryRefreshDomain];

export type IHomeBackgroundRecoveryTabId =
  | 'portfolio'
  | 'perps'
  | 'defi'
  | 'nft'
  | 'history';

export type INativeHomeBackgroundRecoveryRefreshSource =
  | 'portfolio'
  | 'default-token-map'
  | 'defi'
  | 'perps'
  | 'banners'
  | 'lp-tokens'
  | 'supplemental'
  | 'nft'
  | 'history';

export type IHomeBackgroundRecoveryOwnerToken = {
  accountId?: string;
  networkId?: string;
  walletId?: string;
};

export type IHomeBackgroundRecoveryOwnerActivation = symbol;

export type IHomeBackgroundRecoveryRefreshContext = {
  isOwnerCurrent: () => boolean;
  owner: IHomeBackgroundRecoveryOwnerToken;
  readySignal: INativeBackgroundThreadReadySignal;
  runDomains: (
    domains: readonly IHomeBackgroundRecoveryRefreshDomain[],
  ) => Promise<void>;
};

type IHomeBackgroundRecoveryRefreshCallback = (
  context: IHomeBackgroundRecoveryRefreshContext,
) => Promise<unknown> | unknown;

type IHomeBackgroundRecoveryRefreshRegistration = {
  callback: IHomeBackgroundRecoveryRefreshCallback;
  operationKey: string;
  ownerKey: string;
  token: symbol;
};

type IHomeBackgroundRecoverySurfaceCommit = {
  ownerActivation: IHomeBackgroundRecoveryOwnerActivation;
  ownerKey: string;
  rendererMounted: boolean;
  revision: number;
};

type IHomeBackgroundRecoverySurfaceCommitWaiter = {
  isTransactionCurrent: () => boolean;
  ownerActivation: IHomeBackgroundRecoveryOwnerActivation;
  ownerKey: string;
  resolve: (rendererCommitted: boolean) => void;
  revision: number;
  token: symbol;
};

type IHomeBackgroundRecoveryCommittedOwnerState = {
  explicitNoWallet: boolean;
  owner: IHomeBackgroundRecoveryOwnerToken;
  ownerActivation: IHomeBackgroundRecoveryOwnerActivation;
  ownerComplete: boolean;
};

type IRegisterHomeBackgroundRecoveryRefreshParams = {
  callback: IHomeBackgroundRecoveryRefreshCallback;
  domain: IHomeBackgroundRecoveryRefreshDomain;
  operationKey?: string;
  owner: IHomeBackgroundRecoveryOwnerToken;
};

export type IHomeBackgroundRecoveryRefreshRegistry = ReturnType<
  typeof createHomeBackgroundRecoveryRefreshRegistry
>;

const homeBackgroundRecoveryOwner = {
  sceneName: EAccountSelectorSceneName.home,
  sceneUrl: '',
};

const HOME_BACKGROUND_RECOVERY_LOG_PREFIX = '[HomeBackgroundRecovery]';

function stringifyHomeBackgroundRecoveryLogValue(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch (error) {
    return JSON.stringify({
      stringifyError: error instanceof Error ? error.message : String(error),
    });
  }
}

export function debugHomeBackgroundRecoveryLog(label: string, value?: unknown) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }
  const valueText =
    value === undefined
      ? ''
      : ` ${stringifyHomeBackgroundRecoveryLogValue(value)}`;
  // eslint-disable-next-line no-console
  console.log(`${HOME_BACKGROUND_RECOVERY_LOG_PREFIX} ${label}${valueText}`);
}

function buildOwnerKey(owner: IHomeBackgroundRecoveryOwnerToken) {
  return [
    owner.walletId ?? '',
    owner.accountId ?? '',
    owner.networkId ?? '',
  ].join(':');
}

function hasHomeBackgroundRecoveryOwnerIdentity(
  owner: IHomeBackgroundRecoveryOwnerToken,
) {
  return Boolean(owner.walletId && owner.accountId && owner.networkId);
}

export function isHomeBackgroundRecoveryTransactionCurrent({
  currentOwner,
  currentOwnerActivation,
  latestSequence,
  transactionOwner,
  transactionOwnerActivation,
  transactionSequence,
}: {
  currentOwner: IHomeBackgroundRecoveryOwnerToken;
  currentOwnerActivation: IHomeBackgroundRecoveryOwnerActivation;
  latestSequence: number | undefined;
  transactionOwner: IHomeBackgroundRecoveryOwnerToken;
  transactionOwnerActivation: IHomeBackgroundRecoveryOwnerActivation;
  transactionSequence: number;
}) {
  return (
    latestSequence === transactionSequence &&
    currentOwnerActivation === transactionOwnerActivation &&
    buildOwnerKey(currentOwner) === buildOwnerKey(transactionOwner)
  );
}

export function getLegacyHomeBackgroundRecoveryRefreshDomains(
  activeTabId: IHomeBackgroundRecoveryTabId | undefined,
): IHomeBackgroundRecoveryRefreshDomain[] {
  const domains: IHomeBackgroundRecoveryRefreshDomain[] = [
    EHomeBackgroundRecoveryRefreshDomain.legacyWalletTokens,
    EHomeBackgroundRecoveryRefreshDomain.legacyPortfolioDeFiOverview,
    EHomeBackgroundRecoveryRefreshDomain.legacyHeaderPerpsWorth,
    EHomeBackgroundRecoveryRefreshDomain.legacyBanner,
  ];
  switch (activeTabId) {
    case 'perps':
      domains.push(EHomeBackgroundRecoveryRefreshDomain.legacyPerps);
      break;
    case 'defi':
      domains.push(EHomeBackgroundRecoveryRefreshDomain.legacyDeFi);
      break;
    case 'nft':
      domains.push(EHomeBackgroundRecoveryRefreshDomain.legacyNft);
      break;
    case 'history':
      domains.push(EHomeBackgroundRecoveryRefreshDomain.legacyHistory);
      break;
    default:
      break;
  }
  return domains;
}

export function getNativeHomeBackgroundRecoveryRefreshSources(
  activeTabId: IHomeBackgroundRecoveryTabId,
): INativeHomeBackgroundRecoveryRefreshSource[] {
  const sources: INativeHomeBackgroundRecoveryRefreshSource[] = [
    'portfolio',
    'default-token-map',
    'defi',
    'perps',
    'banners',
  ];
  switch (activeTabId) {
    case 'portfolio':
      sources.push('lp-tokens', 'supplemental');
      break;
    case 'nft':
      sources.push('nft');
      break;
    case 'history':
      sources.push('history');
      break;
    default:
      break;
  }
  return sources;
}

export function createHomeBackgroundRecoveryRefreshRegistry({
  isOwnerCurrent,
}: {
  isOwnerCurrent: (owner: IHomeBackgroundRecoveryOwnerToken) => boolean;
}) {
  const registrations = new Map<
    IHomeBackgroundRecoveryRefreshDomain,
    IHomeBackgroundRecoveryRefreshRegistration
  >();
  const surfaceCommitWaiters = new Map<
    symbol,
    IHomeBackgroundRecoverySurfaceCommitWaiter
  >();
  let latestSurfaceCommit: IHomeBackgroundRecoverySurfaceCommit | undefined;

  const resolveSurfaceCommitWaiter = (
    waiter: IHomeBackgroundRecoverySurfaceCommitWaiter,
    commit: IHomeBackgroundRecoverySurfaceCommit,
  ) => {
    if (commit.revision < waiter.revision) {
      return false;
    }
    const rendererCommitted =
      commit.revision === waiter.revision &&
      commit.ownerKey === waiter.ownerKey &&
      commit.ownerActivation === waiter.ownerActivation &&
      commit.rendererMounted &&
      waiter.isTransactionCurrent();
    surfaceCommitWaiters.delete(waiter.token);
    waiter.resolve(rendererCommitted);
    return true;
  };

  const cancelPendingSurfaceCommitWaiters = () => {
    const waiters = Array.from(surfaceCommitWaiters.values());
    surfaceCommitWaiters.clear();
    waiters.forEach((waiter) => waiter.resolve(false));
  };

  const acknowledgeSurfaceCommit = ({
    owner,
    ownerActivation,
    rendererMounted,
    revision,
  }: {
    owner: IHomeBackgroundRecoveryOwnerToken;
    ownerActivation: IHomeBackgroundRecoveryOwnerActivation;
    rendererMounted: boolean;
    revision: number;
  }) => {
    const commit = {
      ownerActivation,
      ownerKey: buildOwnerKey(owner),
      rendererMounted,
      revision,
    };
    if (!latestSurfaceCommit || latestSurfaceCommit.revision <= revision) {
      latestSurfaceCommit = commit;
    }
    Array.from(surfaceCommitWaiters.values()).forEach((waiter) => {
      resolveSurfaceCommitWaiter(waiter, commit);
    });
  };

  const waitForSurfaceCommit = ({
    isTransactionCurrent,
    owner,
    ownerActivation,
    revision,
  }: {
    isTransactionCurrent: () => boolean;
    owner: IHomeBackgroundRecoveryOwnerToken;
    ownerActivation: IHomeBackgroundRecoveryOwnerActivation;
    revision: number;
  }) => {
    if (!isTransactionCurrent()) {
      return Promise.resolve(false);
    }
    return new Promise<boolean>((resolve) => {
      const waiter = {
        isTransactionCurrent,
        ownerActivation,
        ownerKey: buildOwnerKey(owner),
        resolve,
        revision,
        token: Symbol(`home-surface-commit-${revision}`),
      };
      if (
        latestSurfaceCommit &&
        resolveSurfaceCommitWaiter(waiter, latestSurfaceCommit)
      ) {
        return;
      }
      surfaceCommitWaiters.set(waiter.token, waiter);
    });
  };

  const register = ({
    callback,
    domain,
    operationKey = domain,
    owner,
  }: IRegisterHomeBackgroundRecoveryRefreshParams) => {
    const token = Symbol(domain);
    registrations.set(domain, {
      callback,
      operationKey,
      ownerKey: buildOwnerKey(owner),
      token,
    });
    return () => {
      if (registrations.get(domain)?.token === token) {
        registrations.delete(domain);
      }
    };
  };

  const hasRegistration = ({
    domain,
    owner,
  }: {
    domain: IHomeBackgroundRecoveryRefreshDomain;
    owner: IHomeBackgroundRecoveryOwnerToken;
  }) => registrations.get(domain)?.ownerKey === buildOwnerKey(owner);

  const runTransaction = async ({
    domains,
    isTransactionCurrent = () => true,
    owner,
    readySignal,
  }: {
    domains: readonly IHomeBackgroundRecoveryRefreshDomain[];
    isTransactionCurrent?: () => boolean;
    owner: IHomeBackgroundRecoveryOwnerToken;
    readySignal: INativeBackgroundThreadReadySignal;
  }) => {
    const ownerKey = buildOwnerKey(owner);
    const completedOperationKeys = new Set<string>();
    const transactionIsCurrent = () =>
      isOwnerCurrent(owner) && isTransactionCurrent();
    async function runDomains(
      nextDomains: readonly IHomeBackgroundRecoveryRefreshDomain[],
    ) {
      if (!transactionIsCurrent()) {
        return;
      }
      const context: IHomeBackgroundRecoveryRefreshContext = {
        isOwnerCurrent: transactionIsCurrent,
        owner,
        readySignal,
        runDomains,
      };
      const tasks = nextDomains.reduce<Promise<unknown>[]>((result, domain) => {
        if (!transactionIsCurrent()) {
          return result;
        }
        const registration = registrations.get(domain);
        if (
          !registration ||
          registration.ownerKey !== ownerKey ||
          completedOperationKeys.has(registration.operationKey)
        ) {
          return result;
        }
        completedOperationKeys.add(registration.operationKey);
        result.push(
          Promise.resolve().then(() => {
            if (!transactionIsCurrent()) {
              return undefined;
            }
            return registration.callback(context);
          }),
        );
        return result;
      }, []);
      await Promise.allSettled(tasks);
    }
    await runDomains(domains);
  };

  return {
    acknowledgeSurfaceCommit,
    cancelPendingSurfaceCommitWaiters,
    hasRegistration,
    register,
    runTransaction,
    waitForSurfaceCommit,
  };
}

export async function runHomeBackgroundRecoveryRefresh({
  isTransactionCurrent,
  owner,
  ownerActivation,
  readySignal,
  refreshWalletListSilently,
  requestSurfaceCommit,
  registry,
}: {
  isTransactionCurrent: () => boolean;
  owner: IHomeBackgroundRecoveryOwnerToken;
  ownerActivation: IHomeBackgroundRecoveryOwnerActivation;
  readySignal: INativeBackgroundThreadReadySignal;
  refreshWalletListSilently: () => Promise<unknown>;
  requestSurfaceCommit: () => number;
  registry: IHomeBackgroundRecoveryRefreshRegistry;
}) {
  // Let the confirmed wallet owner register its renderer before the recovery
  // transaction snapshots and runs the current Home callbacks.
  debugHomeBackgroundRecoveryLog('wallet-barrier-start', {
    reason: readySignal.reason,
    sequence: readySignal.sequence,
  });
  let walletBarrierResult: 'fulfilled' | 'rejected' = 'fulfilled';
  try {
    await refreshWalletListSilently();
  } catch {
    walletBarrierResult = 'rejected';
    // A wallet-list failure must not block the remaining owner-scoped refreshes.
  }
  const currentAfterWalletBarrier = isTransactionCurrent();
  debugHomeBackgroundRecoveryLog('wallet-barrier-settled', {
    current: currentAfterWalletBarrier,
    result: walletBarrierResult,
    sequence: readySignal.sequence,
  });
  if (!currentAfterWalletBarrier) {
    return;
  }
  const revision = requestSurfaceCommit();
  const rendererCommitted = await registry.waitForSurfaceCommit({
    isTransactionCurrent,
    owner,
    ownerActivation,
    revision,
  });
  const currentAfterSurfaceAck = isTransactionCurrent();
  debugHomeBackgroundRecoveryLog('surface-ack', {
    current: currentAfterSurfaceAck,
    rendererCommitted,
    revision,
    sequence: readySignal.sequence,
  });
  if (!rendererCommitted || !currentAfterSurfaceAck) {
    return;
  }
  await registry.runTransaction({
    domains: [EHomeBackgroundRecoveryRefreshDomain.renderer],
    isTransactionCurrent,
    owner,
    readySignal,
  });
}

type IHomeBackgroundRecoveryRefreshContextValue = {
  ownerActivation: IHomeBackgroundRecoveryOwnerActivation;
  recoveryCommitRevision: number;
  registry: IHomeBackgroundRecoveryRefreshRegistry;
};

const HomeBackgroundRecoveryRefreshContext =
  createContext<IHomeBackgroundRecoveryRefreshContextValue | null>(null);

export function HomeBackgroundRecoveryRefreshProvider({
  children,
}: PropsWithChildren) {
  const {
    activeAccount: { account, network, ready: activeAccountReady, wallet },
  } = useActiveAccount({ num: 0 });
  const {
    pending: walletListPending,
    refreshSilently,
    result: walletListResult,
  } = useHomeWalletList();
  const [accountSelectorStorageInitDone] =
    useAccountSelectorStorageInitDoneAtom();
  const accountSelectorActiveAccountInitDone =
    useIsAccountSelectorActiveAccountInitDone(0);
  const currentOwner = useMemo<IHomeBackgroundRecoveryOwnerToken>(
    () => ({
      accountId: account?.id,
      networkId: network?.id,
      walletId: wallet?.id,
    }),
    [account?.id, network?.id, wallet?.id],
  );
  const currentOwnerKey = buildOwnerKey(currentOwner);
  const ownerComplete =
    activeAccountReady && hasHomeBackgroundRecoveryOwnerIdentity(currentOwner);
  const walletContentReadiness = resolveHomeWalletContentReadiness({
    walletListPending,
    wallets: walletListResult?.wallets,
    hasNoUsableWallet: accountUtils.hasNoUsableWallet({ wallet, account }),
    accountSelectorStorageInitDone,
    accountSelectorActiveAccountInitDone,
    activeAccountReady,
    activeWalletUnavailable: accountUtils.isWalletDeprecatedOrMocked(wallet),
    activeWalletId: wallet?.id,
  });
  const explicitNoWallet = walletContentReadiness === 'no-wallet';
  const ownerActivation = useMemo(
    () => Symbol(currentOwnerKey),
    [currentOwnerKey],
  );
  const committedOwnerRef = useRef<IHomeBackgroundRecoveryCommittedOwnerState>({
    explicitNoWallet,
    owner: currentOwner,
    ownerActivation,
    ownerComplete,
  });
  const registryRef = useRef<
    IHomeBackgroundRecoveryRefreshRegistry | undefined
  >(undefined);
  if (!registryRef.current) {
    registryRef.current = createHomeBackgroundRecoveryRefreshRegistry({
      isOwnerCurrent: (owner) =>
        buildOwnerKey(committedOwnerRef.current.owner) === buildOwnerKey(owner),
    });
  }
  const registry = registryRef.current;
  const latestSequenceRef = useRef<number | undefined>(
    getAccountSelectorBackgroundRecoveryRawReadySequence(
      homeBackgroundRecoveryOwner,
    ),
  );
  const recoveryCommitRevisionRef = useRef(0);
  const [recoveryCommitRevision, setRecoveryCommitRevision] = useState(0);
  const requestSurfaceCommit = useCallback(() => {
    recoveryCommitRevisionRef.current += 1;
    const revision = recoveryCommitRevisionRef.current;
    setRecoveryCommitRevision(revision);
    return revision;
  }, []);

  useLayoutEffect(() => {
    // Refs are shared by current and work-in-progress fibers, so ownership can
    // only move after React commits the candidate tree.
    committedOwnerRef.current = {
      explicitNoWallet,
      owner: currentOwner,
      ownerActivation,
      ownerComplete,
    };
    registry.cancelPendingSurfaceCommitWaiters();
  }, [
    currentOwner,
    explicitNoWallet,
    ownerActivation,
    ownerComplete,
    registry,
  ]);

  useEffect(() => {
    if (!platformEnv.isNativeAndroid && !platformEnv.isNativeIOS) {
      return undefined;
    }
    const unsubscribeRawReady = onAccountSelectorBackgroundRecoveryRawReady(
      homeBackgroundRecoveryOwner,
      ({ readySignal }) => {
        if (
          latestSequenceRef.current !== undefined &&
          readySignal.sequence <= latestSequenceRef.current
        ) {
          return;
        }
        latestSequenceRef.current = readySignal.sequence;
        registry.cancelPendingSurfaceCommitWaiters();
      },
      { afterSequence: latestSequenceRef.current },
    );
    const unsubscribeComplete = onAccountSelectorBackgroundRecoveryComplete(
      homeBackgroundRecoveryOwner,
      ({ readySignal }) => {
        const committedOwnerState = committedOwnerRef.current;
        if (latestSequenceRef.current !== readySignal.sequence) {
          return;
        }
        if (readySignal.reason === 'initial') {
          debugHomeBackgroundRecoveryLog('completion', {
            claimResult: 'ignored-initial',
            explicitNoWallet: committedOwnerState.explicitNoWallet,
            ownerComplete: committedOwnerState.ownerComplete,
            reason: readySignal.reason,
            sequence: readySignal.sequence,
          });
          return;
        }
        if (
          !committedOwnerState.ownerComplete &&
          !committedOwnerState.explicitNoWallet
        ) {
          debugHomeBackgroundRecoveryLog('completion', {
            claimResult: 'deferred',
            explicitNoWallet: committedOwnerState.explicitNoWallet,
            ownerComplete: committedOwnerState.ownerComplete,
            reason: readySignal.reason,
            sequence: readySignal.sequence,
          });
          return;
        }
        const claimed = claimAccountSelectorBackgroundRecovery({
          consumerId: 'home-background-recovery',
          owner: homeBackgroundRecoveryOwner,
          sequence: readySignal.sequence,
        });
        debugHomeBackgroundRecoveryLog('completion', {
          claimResult: claimed ? 'claimed' : 'already-claimed',
          explicitNoWallet: committedOwnerState.explicitNoWallet,
          ownerComplete: committedOwnerState.ownerComplete,
          reason: readySignal.reason,
          sequence: readySignal.sequence,
        });
        if (!claimed) {
          return;
        }
        if (committedOwnerState.explicitNoWallet) {
          return;
        }
        const owner = { ...committedOwnerState.owner };
        const transactionOwnerActivation = committedOwnerState.ownerActivation;
        const isTransactionCurrent = () =>
          isHomeBackgroundRecoveryTransactionCurrent({
            currentOwner: committedOwnerRef.current.owner,
            currentOwnerActivation: committedOwnerRef.current.ownerActivation,
            latestSequence: latestSequenceRef.current,
            transactionOwner: owner,
            transactionOwnerActivation,
            transactionSequence: readySignal.sequence,
          });
        void runHomeBackgroundRecoveryRefresh({
          isTransactionCurrent,
          owner,
          ownerActivation: transactionOwnerActivation,
          readySignal,
          refreshWalletListSilently: refreshSilently,
          requestSurfaceCommit,
          registry,
        });
      },
      // Cold-start recovery can complete before Home mounts. Replay the
      // latched completion here; the owner-scoped claim keeps remounts
      // idempotent.
    );
    return () => {
      latestSequenceRef.current = undefined;
      registry.cancelPendingSurfaceCommitWaiters();
      unsubscribeComplete();
      unsubscribeRawReady();
    };
  }, [
    explicitNoWallet,
    ownerActivation,
    ownerComplete,
    refreshSilently,
    registry,
    requestSurfaceCommit,
  ]);

  const value = useMemo(
    () => ({ ownerActivation, recoveryCommitRevision, registry }),
    [ownerActivation, recoveryCommitRevision, registry],
  );
  return (
    <HomeBackgroundRecoveryRefreshContext.Provider value={value}>
      {children}
    </HomeBackgroundRecoveryRefreshContext.Provider>
  );
}

export function useHomeBackgroundRecoveryStableCallback<
  TArgs extends unknown[],
  TResult,
>(callback: (...args: TArgs) => TResult) {
  const callbackRef = useRef(callback);
  useLayoutEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  return useCallback((...args: TArgs) => callbackRef.current(...args), []);
}

export function useRegisterHomeBackgroundRecoveryRefresh({
  callback,
  domain,
  enabled = true,
  operationKey,
  owner,
}: IRegisterHomeBackgroundRecoveryRefreshParams & { enabled?: boolean }) {
  const contextValue = useContext(HomeBackgroundRecoveryRefreshContext);
  const registry = contextValue?.registry;
  const latestCallback = useHomeBackgroundRecoveryStableCallback(callback);
  const ownerKey = buildOwnerKey(owner);
  const stableCallback = useCallback(
    async (context: IHomeBackgroundRecoveryRefreshContext) => {
      if (!context.isOwnerCurrent()) {
        return;
      }
      await latestCallback(context);
      return context.isOwnerCurrent();
    },
    [latestCallback],
  );

  useLayoutEffect(() => {
    if (!enabled || !registry) {
      return undefined;
    }
    return registry.register({
      callback: stableCallback,
      domain,
      operationKey,
      owner,
    });
    // ownerKey intentionally represents the normalized owner identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, enabled, operationKey, ownerKey, registry, stableCallback]);
}

export function useAcknowledgeHomeBackgroundRecoverySurfaceCommit({
  owner,
  surfaceHasRenderer,
}: {
  owner: IHomeBackgroundRecoveryOwnerToken;
  surfaceHasRenderer: boolean;
}) {
  const contextValue = useContext(HomeBackgroundRecoveryRefreshContext);
  const ownerKey = buildOwnerKey(owner);
  useLayoutEffect(() => {
    if (!contextValue) {
      return;
    }
    contextValue.registry.acknowledgeSurfaceCommit({
      owner,
      ownerActivation: contextValue.ownerActivation,
      rendererMounted:
        surfaceHasRenderer &&
        contextValue.registry.hasRegistration({
          domain: EHomeBackgroundRecoveryRefreshDomain.renderer,
          owner,
        }),
      revision: contextValue.recoveryCommitRevision,
    });
    // ownerKey intentionally represents the normalized owner identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextValue, ownerKey, surfaceHasRenderer]);
}
