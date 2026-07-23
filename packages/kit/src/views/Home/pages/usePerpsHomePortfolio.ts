import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useStableHomeFactsOwner } from '@onekeyhq/kit/src/views/Home/model/react/homeStoreHooks';
import { useHomeStoreSourcePublisher } from '@onekeyhq/kit/src/views/Home/model/react/useHomeStoreSourcePublisher';
import type { IHomeSectionSourceRequestHandle } from '@onekeyhq/kit/src/views/Home/model/react/useHomeStoreSourcePublisher';
import { HomeSectionCoordinator } from '@onekeyhq/kit/src/views/Home/model/sections/homeSectionCoordinator';
import {
  buildHomePerpsCoverage,
  projectHomePerpsSectionSource,
} from '@onekeyhq/kit/src/views/Home/model/sections/perps/homePerpsSectionPolicy';
import {
  HOME_PERPS_DATA_SCHEMA_VERSION,
  adaptHomePerpsSourceSnapshot,
  createHomePerpsSourceIdentity,
} from '@onekeyhq/kit/src/views/Home/model/sections/perps/homePerpsSourceAdapter';
import type { IHomePerpsLegacyPayload } from '@onekeyhq/kit/src/views/Home/model/sections/perps/homePerpsSourceAdapter';
import {
  createHomeStoreSectionSourceResult,
  normalizeHomeStoreJson,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreJson';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS } from '@onekeyhq/shared/src/consts/perpCache';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IAppEventBusPayload } from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import type { IPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import { mapSnapshotToPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';
import { EDecodedTxStatus } from '@onekeyhq/shared/types/tx';

import {
  type IPerpsHomeAsyncScope,
  type IPerpsHomePortfolioResult,
  isPerpsHomeAsyncScopeCurrent,
  projectPerpsHomePortfolioEvidence,
  resolvePerpsHomeAmountAuthority,
  selectCurrentPerpsHomePortfolioResult,
} from './perpsHomePortfolioAuthority';

const DEPOSIT_CONFIRMATION_RETRY_MAX_ATTEMPTS = 5;
const DEPOSIT_CONFIRMATION_RETRY_INTERVAL_MS =
  PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS;

const createPerpsHomePortfolioProducerInstanceId = () =>
  `perps-home-portfolio:${Date.now()}:${Math.random()}`;

type ILocalPendingTxConfirmedPayload =
  IAppEventBusPayload[EAppEventBusNames.LocalPendingTxConfirmed];

type IPendingDepositRetryScope = {
  accountScopeKey: string | undefined;
  address: string;
  deriveType: string | IAccountDeriveTypes;
};

type IPerpsHomePortfolioSourceResult =
  IPerpsHomePortfolioResult<IPerpsHomeView> & {
    deriveType?: IAccountDeriveTypes;
  };

function normalizePerpsAddress(address: string | undefined) {
  return (address || '').toLowerCase();
}

function isSameDeriveType(
  a: string | IAccountDeriveTypes | undefined,
  b: string | IAccountDeriveTypes | undefined,
) {
  return Boolean(a && b && String(a).toLowerCase() === String(b).toLowerCase());
}

function getAccountScopeKey({
  accountId,
  indexedAccountId,
}: {
  accountId: string | undefined;
  indexedAccountId: string | undefined;
}) {
  if (indexedAccountId) {
    return `indexed:${indexedAccountId}`;
  }
  if (accountId) {
    return `account:${accountId}`;
  }
  return undefined;
}

function getCurrentConfirmedPerpsDepositScope({
  payload,
  accountId,
  indexedAccountId,
  currentAccountScopeKey,
  currentAddress,
  currentDeriveType,
}: {
  payload: ILocalPendingTxConfirmedPayload;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  currentAccountScopeKey: string | undefined;
  currentAddress: string | undefined;
  currentDeriveType: IAccountDeriveTypes | undefined;
}): IPendingDepositRetryScope | undefined {
  if (
    !payload.isPerpsDepositTx ||
    payload.status !== EDecodedTxStatus.Confirmed
  ) {
    return undefined;
  }
  let isSameAccount = false;
  const payloadAccountId = payload.perpsAccountId ?? payload.accountId;
  const payloadIndexedAccountId =
    payload.perpsIndexedAccountId ?? payload.indexedAccountId;
  if (indexedAccountId) {
    isSameAccount = payloadIndexedAccountId === indexedAccountId;
  } else {
    isSameAccount = Boolean(accountId && payloadAccountId === accountId);
  }
  if (!isSameAccount) {
    return undefined;
  }
  const payloadAddress = normalizePerpsAddress(
    payload.perpsAccountAddress ?? payload.accountAddress,
  );
  const payloadDeriveType = payload.perpsDeriveType ?? payload.deriveType;
  const currentNormalizedAddress = normalizePerpsAddress(currentAddress);
  if (
    !payloadAddress ||
    (currentNormalizedAddress && payloadAddress !== currentNormalizedAddress) ||
    !payloadDeriveType ||
    (currentDeriveType &&
      !isSameDeriveType(payloadDeriveType, currentDeriveType))
  ) {
    return undefined;
  }
  return {
    accountScopeKey: currentAccountScopeKey,
    address: payloadAddress,
    deriveType: payloadDeriveType,
  };
}

function isPendingDepositRetryScopeAccountCurrent({
  scope,
  currentAccountScopeKey,
  currentDeriveType,
}: {
  scope: IPendingDepositRetryScope;
  currentAccountScopeKey: string | undefined;
  currentDeriveType: IAccountDeriveTypes | undefined;
}) {
  return (
    scope.accountScopeKey === currentAccountScopeKey &&
    (!currentDeriveType ||
      isSameDeriveType(scope.deriveType, currentDeriveType))
  );
}

function isPendingDepositRetryScopeCurrent({
  scope,
  currentAccountScopeKey,
  currentAddress,
  currentDeriveType,
}: {
  scope: IPendingDepositRetryScope;
  currentAccountScopeKey: string | undefined;
  currentAddress: string | undefined;
  currentDeriveType: IAccountDeriveTypes | undefined;
}) {
  return (
    scope.accountScopeKey === currentAccountScopeKey &&
    scope.address === normalizePerpsAddress(currentAddress) &&
    isSameDeriveType(scope.deriveType, currentDeriveType)
  );
}

export function usePerpsHomePortfolio({
  isSourceActive,
}: {
  isSourceActive: boolean;
}): {
  viewState: 'ready' | 'loading' | 'empty';
  view: IPerpsHomeView | undefined;
  amountAuthority: {
    scopeKey: string | undefined;
    status: 'loading' | 'success';
  };
  canDeposit: boolean;
  isDepositDisabled: boolean;
  refresh: () => Promise<void>;
} {
  const {
    activeAccount: { account, wallet },
  } = useActiveAccount({ num: 0 });
  const stableHomeFactsOwner = useStableHomeFactsOwner();
  const {
    beginHomeSectionRequest,
    completeHomeSectionRequest,
    resetHomeSectionSource,
  } = useHomeStoreSourcePublisher();
  const accountId = account?.id;
  const indexedAccountId = account?.indexedAccountId;
  const walletId = wallet?.id;
  const currentAccountScopeKey = getAccountScopeKey({
    accountId,
    indexedAccountId,
  });
  const homeFactsOwnerMatches =
    stableHomeFactsOwner?.owner.walletId === walletId &&
    stableHomeFactsOwner?.owner.accountId === accountId;
  const [perpsProducerInstanceId] = useState(
    createPerpsHomePortfolioProducerInstanceId,
  );
  const perpsCoordinatorRef = useRef<
    HomeSectionCoordinator<IHomePerpsLegacyPayload> | undefined
  >(undefined);
  const completePerpsRequest = useCallback(
    ({
      identity,
      requestHandle,
      requestResult,
    }: {
      identity: ReturnType<typeof createHomePerpsSourceIdentity>;
      requestHandle: IHomeSectionSourceRequestHandle;
      requestResult: IPerpsHomePortfolioSourceResult;
    }) => {
      const requestSeq = requestHandle.token.requestSeq;
      const evidence = projectPerpsHomePortfolioEvidence(requestResult);
      const snapshot = projectHomePerpsSectionSource({
        authorityReady: true,
        evidence:
          evidence.kind === 'complete'
            ? {
                ...evidence,
                coverageFingerprint: buildHomePerpsCoverage(requestSeq),
              }
            : evidence,
        requestSeq,
        scopeMatches: true,
      });
      let coordinator = perpsCoordinatorRef.current;
      if (!coordinator) {
        coordinator = new HomeSectionCoordinator<IHomePerpsLegacyPayload>(
          identity,
        );
        perpsCoordinatorRef.current = coordinator;
      } else {
        coordinator.setOwner(identity);
      }
      const resolution = coordinator.dispatch(
        adaptHomePerpsSourceSnapshot({ identity, snapshot }),
      );
      if (!resolution.accepted) {
        completeHomeSectionRequest(requestHandle, { kind: 'error' });
        return;
      }
      const data =
        resolution.authoritative.kind === 'none'
          ? undefined
          : normalizeHomeStoreJson(resolution.authoritative.data);
      completeHomeSectionRequest(
        requestHandle,
        createHomeStoreSectionSourceResult(resolution.semantic, data),
      );
    },
    [completeHomeSectionRequest],
  );
  const liveAccountScopeKeyRef = useRef(currentAccountScopeKey);
  liveAccountScopeKeyRef.current = currentAccountScopeKey;
  const liveHomeOwnerTokenRef = useRef(stableHomeFactsOwner?.ownerToken);
  liveHomeOwnerTokenRef.current = stableHomeFactsOwner?.ownerToken;
  const isSourceActiveRef = useRef(isSourceActive);
  isSourceActiveRef.current = isSourceActive;
  const [deriveTypeRevision, setDeriveTypeRevision] = useState(0);
  const deriveTypeRevisionRef = useRef(deriveTypeRevision);
  deriveTypeRevisionRef.current = deriveTypeRevision;
  const [focusedRevalidateNonce, setFocusedRevalidateNonce] = useState(0);
  const perpsDeriveTypeCacheRef = useRef<
    | {
        deriveType: IAccountDeriveTypes;
        revision: number;
      }
    | undefined
  >(undefined);
  const sourceExecutionSeqRef = useRef(0);
  const perpsRequestParamsFingerprint = useMemo(
    () =>
      stringUtils.stableStringify({
        accountId: accountId ?? '',
        accountScopeKey: currentAccountScopeKey ?? '',
        deriveTypeRevision,
        indexedAccountId: indexedAccountId ?? '',
        networkId: PERPS_NETWORK_ID,
      }),
    [accountId, currentAccountScopeKey, deriveTypeRevision, indexedAccountId],
  );

  const { result, run, setResult } =
    usePromiseResult<IPerpsHomePortfolioSourceResult>(
      async () => {
        const requestScopeKey = currentAccountScopeKey;
        if (
          !isSourceActive ||
          !stableHomeFactsOwner ||
          !homeFactsOwnerMatches
        ) {
          return {
            address: '',
            scopeKey: requestScopeKey,
            view: undefined,
            requestResolved: false,
          };
        }
        const requestHandle = beginHomeSectionRequest({
          dataSchemaVersion: HOME_PERPS_DATA_SCHEMA_VERSION,
          ownerToken: stableHomeFactsOwner.ownerToken,
          paramsFingerprint: perpsRequestParamsFingerprint,
          quoteBasis: { currency: 'USD' },
          sectionId: 'perps',
        });
        sourceExecutionSeqRef.current += 1;
        const sourceExecutionSeq = sourceExecutionSeqRef.current;
        const requestOwnerToken = stableHomeFactsOwner.ownerToken;
        const isRequestCurrent = () => {
          const liveOwnerToken = liveHomeOwnerTokenRef.current;
          return !(
            sourceExecutionSeqRef.current !== sourceExecutionSeq ||
            deriveTypeRevisionRef.current !== deriveTypeRevision ||
            liveAccountScopeKeyRef.current !== requestScopeKey ||
            liveOwnerToken?.scopeKey !== requestOwnerToken.scopeKey ||
            liveOwnerToken?.sessionId !== requestOwnerToken.sessionId
          );
        };
        if (!accountId && !indexedAccountId) {
          completeHomeSectionRequest(requestHandle, { kind: 'empty' });
          return {
            address: '',
            scopeKey: requestScopeKey,
            view: undefined,
            requestResolved: true,
          };
        }
        const cachedDeriveType = perpsDeriveTypeCacheRef.current;
        let perpsDeriveType =
          cachedDeriveType?.revision === deriveTypeRevision
            ? cachedDeriveType.deriveType
            : undefined;
        if (!perpsDeriveType) {
          try {
            perpsDeriveType =
              await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
                { networkId: PERPS_NETWORK_ID },
              );
          } catch {
            completeHomeSectionRequest(requestHandle, { kind: 'error' });
            return {
              address: '',
              scopeKey: requestScopeKey,
              view: undefined,
              requestResolved: true,
              errorKind: 'source',
            };
          }
          if (!perpsDeriveType) {
            completeHomeSectionRequest(requestHandle, { kind: 'error' });
            return {
              address: '',
              scopeKey: requestScopeKey,
              view: undefined,
              requestResolved: true,
              errorKind: 'source',
            };
          }
          perpsDeriveTypeCacheRef.current = {
            deriveType: perpsDeriveType,
            revision: deriveTypeRevision,
          };
        }
        const requestIdentity = createHomePerpsSourceIdentity({
          owner: requestOwnerToken,
          params: {
            accountScopeKey: requestScopeKey ?? '',
            accountId: accountId ?? '',
            deriveType: String(perpsDeriveType),
            indexedAccountId: indexedAccountId ?? '',
            networkId: PERPS_NETWORK_ID,
          },
          producerInstanceId: perpsProducerInstanceId,
        });
        const finishRequest = <TResult extends IPerpsHomePortfolioSourceResult>(
          requestResult: TResult,
        ) => {
          if (!isRequestCurrent()) {
            completeHomeSectionRequest(requestHandle, { kind: 'error' });
            return requestResult;
          }
          completePerpsRequest({
            identity: requestIdentity,
            requestHandle,
            requestResult,
          });
          return requestResult;
        };
        let address = '';
        try {
          const acc = await backgroundApiProxy.serviceAccount.getNetworkAccount(
            {
              accountId: indexedAccountId ? undefined : accountId,
              indexedAccountId,
              deriveType: perpsDeriveType,
              networkId: PERPS_NETWORK_ID,
            },
          );
          address = acc?.addressDetail?.normalizedAddress || acc?.address || '';
        } catch {
          // account has no Arbitrum derivation, so there is no HL address to query
          return finishRequest({
            address: '',
            deriveType: perpsDeriveType,
            scopeKey: requestScopeKey,
            view: undefined,
            requestResolved: true,
          });
        }
        if (!address) {
          return finishRequest({
            address: '',
            deriveType: perpsDeriveType,
            scopeKey: requestScopeKey,
            view: undefined,
            requestResolved: true,
          });
        }
        let snapshot: Awaited<
          ReturnType<
            typeof backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot
          >
        >;
        try {
          snapshot =
            await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
              { address },
            );
        } catch {
          return finishRequest({
            address,
            deriveType: perpsDeriveType,
            scopeKey: requestScopeKey,
            view: undefined,
            requestResolved: true,
            errorKind: 'source',
          });
        }
        if (!snapshot) {
          return finishRequest({
            address,
            deriveType: perpsDeriveType,
            scopeKey: requestScopeKey,
            view: undefined,
            requestResolved: true,
            errorKind: 'source',
          });
        }
        return finishRequest({
          address,
          deriveType: perpsDeriveType,
          scopeKey: requestScopeKey,
          view: mapSnapshotToPerpsHomeView(snapshot),
          requestResolved: true,
        });
      },
      [
        accountId,
        beginHomeSectionRequest,
        completeHomeSectionRequest,
        completePerpsRequest,
        currentAccountScopeKey,
        deriveTypeRevision,
        homeFactsOwnerMatches,
        indexedAccountId,
        isSourceActive,
        perpsRequestParamsFingerprint,
        perpsProducerInstanceId,
        stableHomeFactsOwner,
      ],
      {
        // Account + derive type scoped so result swaps synchronously on identity changes.
        swrKey: currentAccountScopeKey
          ? `perps-home:${currentAccountScopeKey}:derive-revision:${deriveTypeRevision}`
          : undefined,
        // Poll at the active cadence, while the bg snapshot cache keeps real HL
        // network reads to active=15s / idle-or-empty=1m unless forced.
        pollingInterval: PERPS_HL_PORTFOLIO_ACTIVE_MAX_AGE_MS,
        // Native Home owns its pager visibility. Capability activation is the
        // source gate, and every supported list must prefetch before selection.
        checkIsFocused: false,
      },
    );
  const depositRetryTimerRef = useRef<
    ReturnType<typeof setTimeout> | undefined
  >(undefined);
  const depositRetryNonceRef = useRef(0);
  const activeDepositRetryScopeRef = useRef<
    IPendingDepositRetryScope | undefined
  >(undefined);
  const pendingDepositRetryScopeRef = useRef<
    IPendingDepositRetryScope | undefined
  >(undefined);
  const acceptedResultRef = useRef<IPerpsHomePortfolioSourceResult | undefined>(
    undefined,
  );
  const previousAccountScopeKeyRef = useRef(currentAccountScopeKey);
  if (previousAccountScopeKeyRef.current !== currentAccountScopeKey) {
    previousAccountScopeKeyRef.current = currentAccountScopeKey;
    depositRetryNonceRef.current += 1;
    activeDepositRetryScopeRef.current = undefined;
    pendingDepositRetryScopeRef.current = undefined;
  }
  const currentResult = selectCurrentPerpsHomePortfolioResult({
    currentScopeKey: currentAccountScopeKey,
    incoming: result,
    previous: acceptedResultRef.current,
  });
  acceptedResultRef.current = currentResult;
  const cachedPerpsDeriveType = perpsDeriveTypeCacheRef.current;
  const perpsDeriveType =
    currentResult?.deriveType ??
    (cachedPerpsDeriveType?.revision === deriveTypeRevision
      ? cachedPerpsDeriveType.deriveType
      : undefined);
  const perpsSourceIdentity = useMemo(() => {
    if (
      !stableHomeFactsOwner ||
      !homeFactsOwnerMatches ||
      !currentAccountScopeKey ||
      !perpsDeriveType
    ) {
      return undefined;
    }
    return createHomePerpsSourceIdentity({
      owner: stableHomeFactsOwner.ownerToken,
      params: {
        accountScopeKey: currentAccountScopeKey,
        accountId: accountId ?? '',
        deriveType: String(perpsDeriveType),
        indexedAccountId: indexedAccountId ?? '',
        networkId: PERPS_NETWORK_ID,
      },
      producerInstanceId: perpsProducerInstanceId,
    });
  }, [
    accountId,
    currentAccountScopeKey,
    homeFactsOwnerMatches,
    indexedAccountId,
    perpsDeriveType,
    perpsProducerInstanceId,
    stableHomeFactsOwner,
  ]);
  useEffect(() => {
    if (!stableHomeFactsOwner || homeFactsOwnerMatches) {
      return;
    }
    resetHomeSectionSource({
      ownerToken: stableHomeFactsOwner.ownerToken,
      sectionId: 'perps',
    });
  }, [homeFactsOwnerMatches, resetHomeSectionSource, stableHomeFactsOwner]);
  useEffect(
    () => () => {
      perpsCoordinatorRef.current?.dispose();
    },
    [],
  );
  const latestAddressRef = useRef<string | undefined>(currentResult?.address);
  latestAddressRef.current = currentResult?.address;
  const liveAsyncScopeRef = useRef<IPerpsHomeAsyncScope>({
    address: currentResult?.address,
    scopeKey: currentAccountScopeKey,
  });
  liveAsyncScopeRef.current = {
    address: currentResult?.address,
    scopeKey: currentAccountScopeKey,
  };

  useEffect(() => {
    const onGlobalDeriveTypeUpdate = () => {
      setDeriveTypeRevision((value) => value + 1);
    };
    appEventBus.on(
      EAppEventBusNames.GlobalDeriveTypeUpdate,
      onGlobalDeriveTypeUpdate,
    );
    return () => {
      appEventBus.off(
        EAppEventBusNames.GlobalDeriveTypeUpdate,
        onGlobalDeriveTypeUpdate,
      );
    };
  }, []);

  useEffect(() => {
    const pendingDepositRetryScope = pendingDepositRetryScopeRef.current;
    if (!isSourceActive || !pendingDepositRetryScope) {
      return;
    }
    if (!perpsDeriveType) {
      return;
    }
    if (
      !isPendingDepositRetryScopeAccountCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
      return;
    }
    if (!latestAddressRef.current) {
      return;
    }
    if (
      !isPendingDepositRetryScopeCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentAddress: latestAddressRef.current,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
      return;
    }
    setFocusedRevalidateNonce((value) => value + 1);
  }, [
    currentAccountScopeKey,
    isSourceActive,
    perpsDeriveType,
    result?.address,
  ]);

  // Refetch only when a locally submitted Perps deposit confirms on-chain.
  useEffect(() => {
    const markPendingDepositRetry = (scope: IPendingDepositRetryScope) => {
      pendingDepositRetryScopeRef.current = scope;
    };
    const clearDepositRetry = () => {
      if (depositRetryTimerRef.current) {
        clearTimeout(depositRetryTimerRef.current);
        depositRetryTimerRef.current = undefined;
      }
    };
    const pauseDepositRetry = (scope: IPendingDepositRetryScope) => {
      markPendingDepositRetry(scope);
      activeDepositRetryScopeRef.current = undefined;
      clearDepositRetry();
      depositRetryNonceRef.current += 1;
    };
    const forceRefreshAfterDeposit = async ({
      scope,
      address,
      attempt,
      nonce,
    }: {
      scope: IPendingDepositRetryScope;
      address: string;
      attempt: number;
      nonce: number;
    }) => {
      if (!isSourceActiveRef.current) {
        pauseDepositRetry(scope);
        return;
      }
      if (!perpsSourceIdentity) {
        pauseDepositRetry(scope);
        return;
      }
      const requestHandle = beginHomeSectionRequest({
        dataSchemaVersion: HOME_PERPS_DATA_SCHEMA_VERSION,
        ownerToken: perpsSourceIdentity.owner,
        paramsFingerprint: perpsRequestParamsFingerprint,
        quoteBasis: { currency: 'USD' },
        sectionId: 'perps',
      });
      sourceExecutionSeqRef.current += 1;
      const sourceExecutionSeq = sourceExecutionSeqRef.current;
      const setTrackedResult = (
        requestResult: IPerpsHomePortfolioSourceResult,
      ) => {
        const liveOwnerToken = liveHomeOwnerTokenRef.current;
        if (
          sourceExecutionSeqRef.current !== sourceExecutionSeq ||
          liveAccountScopeKeyRef.current !== scope.accountScopeKey ||
          liveOwnerToken?.scopeKey !== requestHandle.token.sourceKey.scopeKey ||
          liveOwnerToken?.sessionId !== requestHandle.token.sessionId
        ) {
          completeHomeSectionRequest(requestHandle, { kind: 'error' });
          return false;
        }
        completePerpsRequest({
          identity: perpsSourceIdentity,
          requestHandle,
          requestResult,
        });
        setResult(requestResult);
        return true;
      };
      let snapshot: Awaited<
        ReturnType<
          typeof backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot
        >
      >;
      try {
        snapshot =
          await backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
            { address, force: true, skipCacheWriteIfEmpty: true },
          );
      } catch {
        if (
          depositRetryNonceRef.current === nonce &&
          isPerpsHomeAsyncScopeCurrent({
            captured: {
              address,
              scopeKey: scope.accountScopeKey,
            },
            live: liveAsyncScopeRef.current,
          })
        ) {
          setTrackedResult({
            address,
            deriveType: perpsDeriveType,
            scopeKey: scope.accountScopeKey,
            view: undefined,
            requestResolved: true,
            errorKind: 'source',
          });
        } else {
          completeHomeSectionRequest(requestHandle, { kind: 'error' });
        }
        activeDepositRetryScopeRef.current = undefined;
        return;
      }
      if (
        depositRetryNonceRef.current !== nonce ||
        !isPerpsHomeAsyncScopeCurrent({
          captured: {
            address,
            scopeKey: scope.accountScopeKey,
          },
          live: liveAsyncScopeRef.current,
        })
      ) {
        completeHomeSectionRequest(requestHandle, { kind: 'error' });
        return;
      }
      const responseAccepted = snapshot
        ? setTrackedResult({
            address,
            deriveType: perpsDeriveType,
            scopeKey: scope.accountScopeKey,
            view: mapSnapshotToPerpsHomeView(snapshot),
            requestResolved: true,
          })
        : setTrackedResult({
            address,
            deriveType: perpsDeriveType,
            scopeKey: scope.accountScopeKey,
            view: undefined,
            requestResolved: true,
            errorKind: 'source',
          });
      if (!responseAccepted) {
        activeDepositRetryScopeRef.current = undefined;
        return;
      }
      if (!isSourceActiveRef.current) {
        pauseDepositRetry(scope);
        return;
      }
      // The event carries a Perps deposit source marker but not the deposit
      // amount, so a non-empty snapshot cannot prove the new deposit is visible.
      if (
        attempt < DEPOSIT_CONFIRMATION_RETRY_MAX_ATTEMPTS &&
        isSourceActiveRef.current
      ) {
        depositRetryTimerRef.current = setTimeout(() => {
          if (!isSourceActiveRef.current) {
            pauseDepositRetry(scope);
            return;
          }
          void forceRefreshAfterDeposit({
            scope,
            address,
            attempt: attempt + 1,
            nonce,
          });
        }, DEPOSIT_CONFIRMATION_RETRY_INTERVAL_MS);
      } else {
        activeDepositRetryScopeRef.current = undefined;
      }
    };
    const startDepositConfirmationRetry = (
      scope: IPendingDepositRetryScope,
    ) => {
      if (!perpsDeriveType) {
        markPendingDepositRetry(scope);
        return;
      }
      if (
        !isPendingDepositRetryScopeAccountCurrent({
          scope,
          currentAccountScopeKey,
          currentDeriveType: perpsDeriveType,
        })
      ) {
        pendingDepositRetryScopeRef.current = undefined;
        return;
      }
      if (!latestAddressRef.current) {
        markPendingDepositRetry(scope);
        return;
      }
      if (
        !isPendingDepositRetryScopeCurrent({
          scope,
          currentAccountScopeKey,
          currentAddress: latestAddressRef.current,
          currentDeriveType: perpsDeriveType,
        })
      ) {
        pendingDepositRetryScopeRef.current = undefined;
        return;
      }
      if (!isSourceActiveRef.current) {
        markPendingDepositRetry(scope);
        return;
      }
      pendingDepositRetryScopeRef.current = undefined;
      clearDepositRetry();
      depositRetryNonceRef.current += 1;
      const nonce = depositRetryNonceRef.current;
      const address = scope.address;
      if (!address) {
        void run({ alwaysSetState: true });
        return;
      }
      activeDepositRetryScopeRef.current = scope;
      void forceRefreshAfterDeposit({ scope, address, attempt: 1, nonce });
    };
    const onTxConfirmed = (payload: ILocalPendingTxConfirmedPayload) => {
      const scope = getCurrentConfirmedPerpsDepositScope({
        payload,
        accountId,
        indexedAccountId,
        currentAccountScopeKey,
        currentAddress: latestAddressRef.current,
        currentDeriveType: perpsDeriveType,
      });
      if (scope) {
        startDepositConfirmationRetry(scope);
      }
    };
    const pendingDepositRetryScope = pendingDepositRetryScopeRef.current;
    if (
      pendingDepositRetryScope &&
      isSourceActiveRef.current &&
      perpsDeriveType &&
      latestAddressRef.current &&
      isPendingDepositRetryScopeCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentAddress: latestAddressRef.current,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
      startDepositConfirmationRetry(pendingDepositRetryScope);
    } else if (
      pendingDepositRetryScope &&
      perpsDeriveType &&
      !isPendingDepositRetryScopeAccountCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
    } else if (
      pendingDepositRetryScope &&
      perpsDeriveType &&
      latestAddressRef.current &&
      !isPendingDepositRetryScopeCurrent({
        scope: pendingDepositRetryScope,
        currentAccountScopeKey,
        currentAddress: latestAddressRef.current,
        currentDeriveType: perpsDeriveType,
      })
    ) {
      pendingDepositRetryScopeRef.current = undefined;
    }
    appEventBus.on(EAppEventBusNames.LocalPendingTxConfirmed, onTxConfirmed);
    return () => {
      appEventBus.off(EAppEventBusNames.LocalPendingTxConfirmed, onTxConfirmed);
      const activeDepositRetryScope = activeDepositRetryScopeRef.current;
      if (!isSourceActiveRef.current && activeDepositRetryScope) {
        markPendingDepositRetry(activeDepositRetryScope);
      }
      activeDepositRetryScopeRef.current = undefined;
      clearDepositRetry();
      depositRetryNonceRef.current += 1;
    };
  }, [
    accountId,
    beginHomeSectionRequest,
    completeHomeSectionRequest,
    completePerpsRequest,
    currentAccountScopeKey,
    focusedRevalidateNonce,
    indexedAccountId,
    isSourceActive,
    perpsDeriveType,
    perpsRequestParamsFingerprint,
    perpsSourceIdentity,
    run,
    setResult,
  ]);

  const view = currentResult?.view;
  const isDepositDisabled = accountUtils.isWatchingAccount({
    accountId: accountId ?? '',
  });
  const viewState = useMemo<'ready' | 'loading' | 'empty'>(() => {
    // result is undefined until a fetch resolves for the current account key (swrKey
    // resets it synchronously on switch), so an unresolved key reads as loading, not empty.
    if (currentResult === undefined || !currentResult.requestResolved) {
      return 'loading';
    }
    return view && !view.isEmpty ? 'ready' : 'empty';
  }, [currentResult, view]);

  const canDeposit = Boolean(currentResult?.address);
  const amountAuthority = useMemo(
    () => resolvePerpsHomeAmountAuthority(currentResult),
    [currentResult],
  );
  const refresh = useCallback(async () => {
    await run({ alwaysSetState: true });
  }, [run]);
  return useMemo(
    () => ({
      viewState,
      view,
      amountAuthority,
      canDeposit,
      isDepositDisabled,
      refresh,
    }),
    [amountAuthority, canDeposit, isDepositDisabled, refresh, viewState, view],
  );
}
