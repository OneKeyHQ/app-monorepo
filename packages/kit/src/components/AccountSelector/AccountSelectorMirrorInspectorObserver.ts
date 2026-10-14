import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms/jotaiContextStoreMap';
import appGlobals from '@onekeyhq/shared/src/appGlobals';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import {
  accountSelectorStorageReadyAtom,
  accountSelectorSyncLoadingAtom,
  accountSelectorUpdateMetaAtom,
  activeAccountsAtom,
  selectedAccountsAtom,
} from '../../states/jotai/contexts/accountSelector/atoms';
import {
  getActiveAccountPerfCommitMeta,
  getSelectedAccountPerfCommitMeta,
} from '../../states/jotai/contexts/accountSelector/perfDebug';
import { jotaiContextStore } from '../../states/jotai/utils/jotaiContextStore';

import {
  type IAccountSelectorMirrorActiveSnapshot,
  type IAccountSelectorMirrorSelectedSnapshot,
  type IAccountSelectorMirrorStateSnapshot,
  type IAccountSelectorMirrorTransitionSnapshot,
  type IAccountSelectorMirrorValidationReport,
  validateAccountSelectorMirror,
} from './AccountSelectorMirrorInspectorValidation';

import type {
  IAccountSelectorContextData,
  ISelectedAccountsAtomMap,
} from '../../states/jotai/contexts/accountSelector/atoms';
import type { IJotaiContextStore } from '../../states/jotai/utils/createJotaiContext';

export type IAccountSelectorE2EStateSnapshot =
  IAccountSelectorMirrorStateSnapshot;

export type IAccountSelectorE2EMountedContextSnapshot =
  IAccountSelectorE2EStateSnapshot & {
    config: IAccountSelectorContextData;
    enabledNum: number[];
    instanceId: number;
    mountedAt: number;
    perfDebugName?: string;
    probeName: string;
    storageReady: boolean;
    syncLoading: boolean;
    transition: IAccountSelectorMirrorTransitionSnapshot;
  };

export type IAccountSelectorMirrorInspectorSnapshot = {
  observedAt: number;
  reports: IAccountSelectorMirrorValidationReport[];
  summary: {
    contextOnly: number;
    failed: number;
    fullyVerified: number;
    mountedMirrors: number;
    pending: number;
  };
};

export type IAccountSelectorE2EStateAccessor = {
  clearInspectorTestOverrides: () => void;
  getInspectorSnapshot: () => IAccountSelectorMirrorInspectorSnapshot;
  getMountedContextReports: (params: {
    num: number;
    probeName: string;
  }) => IAccountSelectorMirrorValidationReport[];
  getMountedContextSnapshots: (params: {
    num: number;
    probeName: string;
  }) => IAccountSelectorE2EMountedContextSnapshot[];
  getSnapshot: (params: {
    num: number;
    sceneName: IAccountSelectorContextData['sceneName'];
    sceneUrl?: string;
  }) => IAccountSelectorE2EStateSnapshot | undefined;
  setInspectorTestOverride: (params: {
    expected: unknown;
    field: string;
    instanceId: number;
    num: number;
  }) => void;
};

type IAccountSelectorMountedContextRegistration = {
  actualConfig: IAccountSelectorContextData;
  actualStore: IJotaiContextStore;
  enabledNum: number[];
  expectedConfig: IAccountSelectorContextData;
  expectedStore: IJotaiContextStore;
  instanceId: number;
  mountedAt: number;
  perfDebugName?: string;
  probeName: string;
  stateObservedAtByNum: Map<number, number>;
  stateSignatureByNum: Map<number, string>;
  storeUnsubscribeCallbacks?: Array<() => void>;
};

type IInspectorTestOverride = {
  expected: unknown;
  field: string;
  instanceId: number;
  num: number;
};

const observerRefreshIntervalMs = 250;
const mountedContextRegistry = new Map<
  number,
  IAccountSelectorMountedContextRegistration
>();
const inspectorTestOverrides = new Map<string, IInspectorTestOverride>();
const observerListeners = new Set<() => void>();
let cachedInspectorSnapshot:
  | IAccountSelectorMirrorInspectorSnapshot
  | undefined;
let observerRefreshTimer: ReturnType<typeof setInterval> | undefined;

function buildSelectedSnapshot(
  selected: ISelectedAccountsAtomMap[number] | undefined,
): IAccountSelectorMirrorSelectedSnapshot | undefined {
  if (!selected) return undefined;
  return {
    deriveType: selected.deriveType,
    indexedAccountId: selected.indexedAccountId,
    networkId: selected.networkId,
    othersWalletAccountId: selected.othersWalletAccountId,
    walletId: selected.walletId,
  };
}

function buildStateSnapshot({
  num,
  store,
}: {
  num: number;
  store: IJotaiContextStore;
}): IAccountSelectorE2EStateSnapshot {
  const selected = store.get(selectedAccountsAtom())[num];
  const active = store.get(activeAccountsAtom())[num];
  let activeSnapshot: IAccountSelectorMirrorActiveSnapshot | undefined;
  if (active) {
    activeSnapshot = {
      accountName: active.accountName,
      address: active.account?.address,
      deriveType: active.deriveType,
      indexedAccountId: active.indexedAccount?.id,
      networkId: active.network?.id,
      othersWalletAccountId: active.isOthersWallet
        ? (active.dbAccount?.id ?? active.account?.id)
        : undefined,
      ready: active.ready,
      walletId: active.wallet?.id,
    };
  }
  return {
    active: activeSnapshot,
    selected: buildSelectedSnapshot(selected),
  };
}

function buildTransitionSnapshot({
  num,
  store,
}: {
  num: number;
  store: IJotaiContextStore;
}): IAccountSelectorMirrorTransitionSnapshot {
  const selected = store.get(selectedAccountsAtom())[num];
  const active = store.get(activeAccountsAtom())[num];
  const selectionMeta = getSelectedAccountPerfCommitMeta(selected);
  const activeMeta = getActiveAccountPerfCommitMeta(active);
  return {
    activeReloadId: activeMeta?.reloadId,
    activeScheduleId: activeMeta?.scheduleId,
    activeTrigger: activeMeta?.trigger,
    selectedReason: selectionMeta?.reason,
    transitionId: selectionMeta?.transitionId,
    updatedAt: store.get(accountSelectorUpdateMetaAtom())[num]?.updatedAt,
  };
}

function getOverrideKey({
  field,
  instanceId,
  num,
}: Pick<IInspectorTestOverride, 'field' | 'instanceId' | 'num'>) {
  return `${instanceId}:${num}:${field}`;
}

function applyTestOverrides({
  expected,
  instanceId,
  num,
}: {
  expected: IAccountSelectorMirrorStateSnapshot;
  instanceId: number;
  num: number;
}): IAccountSelectorMirrorStateSnapshot {
  let result = expected;
  for (const override of inspectorTestOverrides.values()) {
    if (override.instanceId === instanceId && override.num === num) {
      const [scope, field] = override.field.split('.');
      if (scope === 'active' || scope === 'selected') {
        result = {
          ...result,
          [scope]: {
            ...result[scope],
            [field]: override.expected,
          },
        };
      }
    }
  }
  return result;
}

function getStateSignature({
  actual,
  actualConfig,
  expected,
  expectedConfig,
  isSameStore,
}: {
  actual: IAccountSelectorMirrorStateSnapshot;
  actualConfig: IAccountSelectorContextData;
  expected: IAccountSelectorMirrorStateSnapshot;
  expectedConfig: IAccountSelectorContextData;
  isSameStore: boolean;
}) {
  return JSON.stringify({
    actual,
    actualConfig,
    expected,
    expectedConfig,
    isSameStore,
  });
}

function readRegistrationSlot(
  registration: IAccountSelectorMountedContextRegistration,
  num: number,
  observedAt: number,
) {
  const actual = buildStateSnapshot({
    num,
    store: registration.actualStore,
  });
  const rawExpected = buildStateSnapshot({
    num,
    store: registration.expectedStore,
  });
  const expected = applyTestOverrides({
    expected: rawExpected,
    instanceId: registration.instanceId,
    num,
  });
  const signature = getStateSignature({
    actual,
    actualConfig: registration.actualConfig,
    expected,
    expectedConfig: registration.expectedConfig,
    isSameStore: registration.actualStore === registration.expectedStore,
  });
  if (registration.stateSignatureByNum.get(num) !== signature) {
    registration.stateSignatureByNum.set(num, signature);
    registration.stateObservedAtByNum.set(num, observedAt);
  }
  const stateObservedAt =
    registration.stateObservedAtByNum.get(num) ?? observedAt;
  return {
    actual,
    expected,
    stableForMs: Math.max(0, observedAt - stateObservedAt),
  };
}

function buildMountedContextSnapshot(
  registration: IAccountSelectorMountedContextRegistration,
  num: number,
): IAccountSelectorE2EMountedContextSnapshot {
  const state = buildStateSnapshot({ num, store: registration.actualStore });
  return {
    ...state,
    config: registration.actualConfig,
    enabledNum: registration.enabledNum,
    instanceId: registration.instanceId,
    mountedAt: registration.mountedAt,
    perfDebugName: registration.perfDebugName,
    probeName: registration.probeName,
    storageReady: registration.actualStore.get(
      accountSelectorStorageReadyAtom(),
    ),
    syncLoading: Boolean(
      registration.actualStore.get(accountSelectorSyncLoadingAtom())[num]
        ?.isLoading,
    ),
    transition: buildTransitionSnapshot({
      num,
      store: registration.actualStore,
    }),
  };
}

function buildValidationReport(
  registration: IAccountSelectorMountedContextRegistration,
  num: number,
  observedAt: number,
) {
  const { actual, expected, stableForMs } = readRegistrationSlot(
    registration,
    num,
    observedAt,
  );
  return validateAccountSelectorMirror({
    actual,
    actualConfig: registration.actualConfig,
    enabledNum: registration.enabledNum,
    expected,
    expectedConfig: registration.expectedConfig,
    expectedTransition: buildTransitionSnapshot({
      num,
      store: registration.expectedStore,
    }),
    instanceId: registration.instanceId,
    isSameStore: registration.actualStore === registration.expectedStore,
    num,
    observedAt,
    perfDebugName: registration.perfDebugName,
    probeName: registration.probeName,
    stableForMs,
    storageReady: registration.actualStore.get(
      accountSelectorStorageReadyAtom(),
    ),
    syncLoading: Boolean(
      registration.actualStore.get(accountSelectorSyncLoadingAtom())[num]
        ?.isLoading,
    ),
    transition: buildTransitionSnapshot({
      num,
      store: registration.actualStore,
    }),
  });
}

function summarizeReports(reports: IAccountSelectorMirrorValidationReport[]) {
  const reportsByInstance = new Map<
    number,
    IAccountSelectorMirrorValidationReport[]
  >();
  for (const report of reports) {
    const instanceReports = reportsByInstance.get(report.instanceId) ?? [];
    instanceReports.push(report);
    reportsByInstance.set(report.instanceId, instanceReports);
  }

  const instanceStatuses = [...reportsByInstance.values()].map((items) => {
    const statuses = items.map((item) => item.overallStatus);
    if (statuses.includes('fail')) return 'fail';
    if (statuses.includes('pending') || statuses.includes('superseded')) {
      return 'pending';
    }
    if (statuses.every((status) => status === 'pass')) return 'pass';
    return 'contextOnly';
  });
  return {
    contextOnly: instanceStatuses.filter((status) => status === 'contextOnly')
      .length,
    failed: instanceStatuses.filter((status) => status === 'fail').length,
    fullyVerified: instanceStatuses.filter((status) => status === 'pass')
      .length,
    mountedMirrors: reportsByInstance.size,
    pending: instanceStatuses.filter((status) => status === 'pending').length,
  };
}

function buildInspectorSnapshot(): IAccountSelectorMirrorInspectorSnapshot {
  const observedAt = Date.now();
  const reports = [...mountedContextRegistry.values()]
    .flatMap((registration) =>
      registration.enabledNum.map((num) =>
        buildValidationReport(registration, num, observedAt),
      ),
    )
    .toSorted((a, b) => a.instanceId - b.instanceId || a.num - b.num);
  return {
    observedAt,
    reports,
    summary: summarizeReports(reports),
  };
}

function notifyObserverListeners() {
  cachedInspectorSnapshot = undefined;
  for (const listener of observerListeners) listener();
}

function subscribeToRegistrationStore(
  registration: IAccountSelectorMountedContextRegistration,
) {
  if (registration.storeUnsubscribeCallbacks) return;
  registration.storeUnsubscribeCallbacks = [
    activeAccountsAtom(),
    selectedAccountsAtom(),
    accountSelectorStorageReadyAtom(),
    accountSelectorSyncLoadingAtom(),
    accountSelectorUpdateMetaAtom(),
  ].map((atom) => registration.actualStore.sub(atom, notifyObserverListeners));
}

function unsubscribeFromRegistrationStore(
  registration: IAccountSelectorMountedContextRegistration,
) {
  registration.storeUnsubscribeCallbacks?.forEach((unsubscribe) =>
    unsubscribe(),
  );
  registration.storeUnsubscribeCallbacks = undefined;
}

function startLiveObservation() {
  cachedInspectorSnapshot = undefined;
  mountedContextRegistry.forEach(subscribeToRegistrationStore);
  observerRefreshTimer ||= globalThis.setInterval(
    notifyObserverListeners,
    observerRefreshIntervalMs,
  );
}

function stopLiveObservation() {
  mountedContextRegistry.forEach(unsubscribeFromRegistrationStore);
  if (observerRefreshTimer) {
    globalThis.clearInterval(observerRefreshTimer);
    observerRefreshTimer = undefined;
  }
  cachedInspectorSnapshot = undefined;
}

export function registerAccountSelectorMountedContext(
  registration: Omit<
    IAccountSelectorMountedContextRegistration,
    | 'mountedAt'
    | 'stateObservedAtByNum'
    | 'stateSignatureByNum'
    | 'storeUnsubscribeCallbacks'
  >,
) {
  const entry: IAccountSelectorMountedContextRegistration = {
    ...registration,
    mountedAt: Date.now(),
    stateObservedAtByNum: new Map(),
    stateSignatureByNum: new Map(),
  };
  mountedContextRegistry.set(entry.instanceId, entry);
  if (observerListeners.size) subscribeToRegistrationStore(entry);
  notifyObserverListeners();
  return () => {
    const current = mountedContextRegistry.get(entry.instanceId);
    if (current !== entry) return;
    unsubscribeFromRegistrationStore(entry);
    mountedContextRegistry.delete(entry.instanceId);
    notifyObserverListeners();
  };
}

export function getAccountSelectorMirrorInspectorSnapshot() {
  cachedInspectorSnapshot ||= buildInspectorSnapshot();
  return cachedInspectorSnapshot;
}

export function subscribeAccountSelectorMirrorInspector(listener: () => void) {
  observerListeners.add(listener);
  if (observerListeners.size === 1) startLiveObservation();
  return () => {
    observerListeners.delete(listener);
    if (!observerListeners.size) stopLiveObservation();
  };
}

export function getMountedAccountSelectorContextSnapshots({
  num,
  probeName,
}: {
  num: number;
  probeName: string;
}) {
  return [...mountedContextRegistry.values()]
    .filter(
      (registration) =>
        registration.probeName === probeName &&
        registration.enabledNum.includes(num),
    )
    .map((registration) => buildMountedContextSnapshot(registration, num))
    .toSorted((a, b) => a.instanceId - b.instanceId);
}

export function getMountedAccountSelectorContextReports({
  num,
  probeName,
}: {
  num: number;
  probeName: string;
}) {
  const observedAt = Date.now();
  return [...mountedContextRegistry.values()]
    .filter(
      (registration) =>
        registration.probeName === probeName &&
        registration.enabledNum.includes(num),
    )
    .map((registration) => buildValidationReport(registration, num, observedAt))
    .toSorted((a, b) => a.instanceId - b.instanceId);
}

export function getCanonicalAccountSelectorSnapshot({
  num,
  sceneName,
  sceneUrl,
}: {
  num: number;
  sceneName: IAccountSelectorContextData['sceneName'];
  sceneUrl?: string;
}) {
  const store = jotaiContextStore.getStore({
    storeName: EJotaiContextStoreNames.accountSelector,
    accountSelectorInfo: {
      enabledNum: [num],
      sceneName,
      sceneUrl,
    },
  });
  return store ? buildStateSnapshot({ num, store }) : undefined;
}

export function setAccountSelectorInspectorTestOverride(
  override: IInspectorTestOverride,
) {
  inspectorTestOverrides.set(getOverrideKey(override), override);
  notifyObserverListeners();
}

export function clearAccountSelectorInspectorTestOverrides() {
  inspectorTestOverrides.clear();
  notifyObserverListeners();
}

export function resetAccountSelectorMirrorInspectorForTest() {
  stopLiveObservation();
  mountedContextRegistry.clear();
  inspectorTestOverrides.clear();
  observerListeners.clear();
  cachedInspectorSnapshot = undefined;
}

function installE2EStateAccessor() {
  if (!platformEnv.isE2E) return;
  const globals = appGlobals as typeof appGlobals & {
    $$accountSelectorE2EStateAccessor?: IAccountSelectorE2EStateAccessor;
  };
  globals.$$accountSelectorE2EStateAccessor = {
    clearInspectorTestOverrides: clearAccountSelectorInspectorTestOverrides,
    getInspectorSnapshot: buildInspectorSnapshot,
    getMountedContextReports: getMountedAccountSelectorContextReports,
    getMountedContextSnapshots: getMountedAccountSelectorContextSnapshots,
    getSnapshot: getCanonicalAccountSelectorSnapshot,
    setInspectorTestOverride: setAccountSelectorInspectorTestOverride,
  };
}

installE2EStateAccessor();

export type { IAccountSelectorMirrorValidationReport };
