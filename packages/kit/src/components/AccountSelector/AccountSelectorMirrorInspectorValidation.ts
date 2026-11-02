import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export type IAccountSelectorMirrorInspectorStatus =
  | 'fail'
  | 'notApplicable'
  | 'notObserved'
  | 'pass'
  | 'pending'
  | 'superseded';

export type IAccountSelectorMirrorSelectedSnapshot = {
  deriveType: string | undefined;
  indexedAccountId: string | undefined;
  networkId: string | undefined;
  othersWalletAccountId: string | undefined;
  walletId: string | undefined;
};

export type IAccountSelectorMirrorActiveSnapshot =
  IAccountSelectorMirrorSelectedSnapshot & {
    accountName: string;
    address: string | undefined;
    ready: boolean;
  };

export type IAccountSelectorMirrorStateSnapshot = {
  active: IAccountSelectorMirrorActiveSnapshot | undefined;
  selected: IAccountSelectorMirrorSelectedSnapshot | undefined;
};

export type IAccountSelectorMirrorTransitionSnapshot = {
  activeReloadId: number | undefined;
  activeScheduleId: number | undefined;
  activeTrigger: string | undefined;
  selectedReason: string | undefined;
  transitionId: number | undefined;
  updatedAt: number | undefined;
};

export type IAccountSelectorMirrorInspectorFinding = {
  actual: unknown;
  expected: unknown;
  field: string;
  reason: string;
  status: IAccountSelectorMirrorInspectorStatus;
};

export type IAccountSelectorMirrorAdapterObservation = {
  findings?: IAccountSelectorMirrorInspectorFinding[];
  status: Exclude<IAccountSelectorMirrorInspectorStatus, 'superseded'>;
};

export type IAccountSelectorMirrorValidationInput = {
  actual: IAccountSelectorMirrorStateSnapshot;
  actualConfig: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
  };
  consumer?: IAccountSelectorMirrorAdapterObservation;
  enabledNum: number[];
  expected: IAccountSelectorMirrorStateSnapshot;
  expectedConfig: {
    sceneName: EAccountSelectorSceneName;
    sceneUrl?: string;
  };
  expectedTransition?: IAccountSelectorMirrorTransitionSnapshot;
  instanceId: number;
  isSameStore: boolean;
  num: number;
  observedAt: number;
  perfDebugName?: string;
  persistence?: IAccountSelectorMirrorAdapterObservation;
  probeName: string;
  stableForMs: number;
  storageReady: boolean;
  syncLoading: boolean;
  transition: IAccountSelectorMirrorTransitionSnapshot;
};

export type IAccountSelectorMirrorValidationReport = {
  actual: IAccountSelectorMirrorStateSnapshot;
  consumerStatus: IAccountSelectorMirrorInspectorStatus;
  contextStatus: IAccountSelectorMirrorInspectorStatus;
  enabledNum: number[];
  expected: IAccountSelectorMirrorStateSnapshot;
  findings: IAccountSelectorMirrorInspectorFinding[];
  instanceId: number;
  num: number;
  observedAt: number;
  overallStatus: IAccountSelectorMirrorInspectorStatus;
  perfDebugName?: string;
  persistenceStatus: IAccountSelectorMirrorInspectorStatus;
  probeName: string;
  sceneName: EAccountSelectorSceneName;
  sceneUrl?: string;
  storageReady: boolean;
  syncLoading: boolean;
  transition: IAccountSelectorMirrorTransitionSnapshot;
};

const ALL_NETWORKS_NETWORK_ID = 'onekeyall--0';
export const ACCOUNT_SELECTOR_MIRROR_SETTLE_TIMEOUT_MS = 1500;

const selectedFields: Array<keyof IAccountSelectorMirrorSelectedSnapshot> = [
  'walletId',
  'indexedAccountId',
  'othersWalletAccountId',
  'networkId',
  'deriveType',
];

const activeFields: Array<keyof IAccountSelectorMirrorActiveSnapshot> = [
  'walletId',
  'indexedAccountId',
  'othersWalletAccountId',
  'networkId',
  'deriveType',
  'address',
  'ready',
];

function normalizeSceneUrl(sceneUrl: string | undefined) {
  return sceneUrl ?? '';
}

function isEmptySelection(
  selected: IAccountSelectorMirrorSelectedSnapshot | undefined,
) {
  return Boolean(
    !selected?.walletId &&
    !selected?.indexedAccountId &&
    !selected?.othersWalletAccountId &&
    !selected?.networkId,
  );
}

function pushMismatch({
  actual,
  expected,
  field,
  findings,
  reason,
}: {
  actual: unknown;
  expected: unknown;
  field: string;
  findings: IAccountSelectorMirrorInspectorFinding[];
  reason: string;
}) {
  if (actual !== expected) {
    findings.push({
      actual,
      expected,
      field,
      reason,
      status: 'fail',
    });
  }
}

function getOverallStatus(
  statuses: IAccountSelectorMirrorInspectorStatus[],
): IAccountSelectorMirrorInspectorStatus {
  if (statuses.includes('fail')) return 'fail';
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('superseded')) return 'superseded';
  if (statuses.includes('notObserved')) return 'notObserved';
  if (statuses.includes('pass')) return 'pass';
  return 'notApplicable';
}

export function validateAccountSelectorMirror(
  input: IAccountSelectorMirrorValidationInput,
): IAccountSelectorMirrorValidationReport {
  const findings: IAccountSelectorMirrorInspectorFinding[] = [];
  pushMismatch({
    actual: input.actualConfig.sceneName,
    expected: input.expectedConfig.sceneName,
    field: 'context.sceneName',
    findings,
    reason: 'The mounted React Context received a different scene.',
  });
  pushMismatch({
    actual: normalizeSceneUrl(input.actualConfig.sceneUrl),
    expected: normalizeSceneUrl(input.expectedConfig.sceneUrl),
    field: 'context.sceneUrl',
    findings,
    reason: 'The mounted React Context received a different scene URL.',
  });
  pushMismatch({
    actual: input.isSameStore,
    expected: true,
    field: 'context.store',
    findings,
    reason: 'The mounted React Context is wired to a non-canonical store.',
  });

  for (const field of selectedFields) {
    pushMismatch({
      actual: input.actual.selected?.[field],
      expected: input.expected.selected?.[field],
      field: `selected.${field}`,
      findings,
      reason: 'The mounted Context selection differs from the canonical store.',
    });
  }
  for (const field of activeFields) {
    pushMismatch({
      actual: input.actual.active?.[field],
      expected: input.expected.active?.[field],
      field: `active.${field}`,
      findings,
      reason:
        'The mounted Context active account differs from the canonical store.',
    });
  }

  const isAddressInputEmpty =
    input.actualConfig.sceneName === 'addressInput' &&
    isEmptySelection(input.actual.selected);
  const isAllNetworks =
    input.actual.selected?.networkId === ALL_NETWORKS_NETWORK_ID;

  if (isAddressInputEmpty) {
    findings.push({
      actual: undefined,
      expected: undefined,
      field: 'selected.identity',
      reason: 'AddressInput may start without an account selection.',
      status: 'notApplicable',
    });
  } else if (input.actual.selected) {
    for (const field of [
      'walletId',
      'indexedAccountId',
      'othersWalletAccountId',
      'networkId',
    ] as const) {
      pushMismatch({
        actual: input.actual.active?.[field],
        expected: input.actual.selected[field],
        field: `selectedActive.${field}`,
        findings,
        reason:
          'The active account has not converged to the mounted Context selection.',
      });
    }
    if (!isAllNetworks) {
      pushMismatch({
        actual: input.actual.active?.deriveType,
        expected: input.actual.selected.deriveType,
        field: 'selectedActive.deriveType',
        findings,
        reason:
          'The active derive type has not converged to the mounted Context selection.',
      });
    }
    pushMismatch({
      actual: input.actual.active?.ready,
      expected: true,
      field: 'active.ready',
      findings,
      reason: 'The active account reload has not reached ready state.',
    });
  }

  const actualTransitionId = input.transition.transitionId;
  const expectedTransitionId = input.expectedTransition?.transitionId;
  const isSuperseded = Boolean(
    actualTransitionId !== undefined &&
    expectedTransitionId !== undefined &&
    actualTransitionId < expectedTransitionId,
  );
  const isPending = Boolean(
    input.syncLoading ||
    (!input.storageReady && !isAddressInputEmpty) ||
    (findings.some((finding) => finding.status === 'fail') &&
      input.stableForMs < ACCOUNT_SELECTOR_MIRROR_SETTLE_TIMEOUT_MS),
  );

  let contextStatus: IAccountSelectorMirrorInspectorStatus = 'pass';
  if (isSuperseded) {
    contextStatus = 'superseded';
  } else if (isPending) {
    contextStatus = 'pending';
  } else if (findings.some((finding) => finding.status === 'fail')) {
    contextStatus = 'fail';
  }

  if (contextStatus === 'pending' || contextStatus === 'superseded') {
    for (const finding of findings) {
      if (finding.status === 'fail') {
        finding.status = contextStatus;
      }
    }
  }

  const persistenceStatus =
    input.persistence?.status ??
    (input.actualConfig.sceneName === 'addressInput'
      ? 'notApplicable'
      : 'notObserved');
  const consumerStatus = input.consumer?.status ?? 'notObserved';
  if (input.persistence?.findings) {
    findings.push(...input.persistence.findings);
  }
  if (input.consumer?.findings) {
    findings.push(...input.consumer.findings);
  }

  return {
    actual: input.actual,
    consumerStatus,
    contextStatus,
    enabledNum: input.enabledNum,
    expected: input.expected,
    findings,
    instanceId: input.instanceId,
    num: input.num,
    observedAt: input.observedAt,
    overallStatus: getOverallStatus([
      contextStatus,
      persistenceStatus,
      consumerStatus,
    ]),
    perfDebugName: input.perfDebugName,
    persistenceStatus,
    probeName: input.probeName,
    sceneName: input.actualConfig.sceneName,
    sceneUrl: input.actualConfig.sceneUrl,
    storageReady: input.storageReady,
    syncLoading: input.syncLoading,
    transition: input.transition,
  };
}
