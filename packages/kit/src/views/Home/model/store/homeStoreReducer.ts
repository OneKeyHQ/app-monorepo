import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type {
  IHomeRuntimeJsonValue,
  IHomeRuntimeRequestToken,
} from '@onekeyhq/shared/src/types/homeRuntime';

import { aggregateHomeBalanceFacts } from '../balance/homeBalanceAggregation';
import {
  type IHomeLifecycleSessionState,
  transitionHomeSession,
} from '../lifecycle/homeSessionMachine';
import { projectHomeNavigation } from '../navigation/homeNavigationProjector';
import { projectHomeBalanceAuthority } from '../policies/homeBalanceAuthorityPolicy';
import { projectHomeDisplayModel } from '../policies/homeDisplayModelPolicy';
import { projectHomeShell } from '../policies/homeShellPolicy';
import {
  HOME_BANNER_ACTION_IDS,
  HOME_PERPS_REFERRAL_BANNER_ID,
  readHomeBannerStorePayload,
} from '../sections/banner/homeBannerStoreModel';
import { projectHomeSemanticModel } from '../semantic/homeSemanticProjector';

import { isHomeCachedRecordExactForToken } from './homeCachedSourceRecord';
import {
  HOME_SECTION_ACTION_IDS,
  HOME_SHELL_ACTION_IDS,
} from './homeStoreCommandIds';
import {
  createInitialHomeStoreResources,
  createInitialHomeStoreSection,
  createInitialHomeStoreState,
} from './homeStoreInitialState';

import type {
  IHomeCachedSourceRecord,
  IHomeStoreDiagnosticsState,
  IHomeStoreEffect,
  IHomeStoreEvent,
  IHomeStoreIntent,
  IHomeStoreMutation,
  IHomeStoreNavigationSlice,
  IHomeStoreRejectReason,
  IHomeStoreResourceSlot,
  IHomeStoreSectionSlice,
  IHomeStoreShellSlice,
  IHomeStoreSourceId,
  IHomeStoreState,
  IHomeStoreTransition,
} from './homeStoreTypes';
import type { IHomeConfirmedBalanceRecord } from '../cache/homeConfirmedBalanceCacheReducer';
import type { IHomeCapabilitySet } from '../capabilities/homeCapabilityTypes';
import type {
  IHomeConfirmedCapabilityCacheState,
  IHomeConfirmedCapabilityRecord,
} from '../capabilities/homeConfirmedCapabilityCache';
import type { IHomeBalanceFacts } from '../facts/homeFacts';
import type { IHomeHeaderAccountPresentation } from '../presentation/homeHeaderPresentation';
import type {
  IHomeNavigationSemanticModel,
  IHomePortfolioPresentation,
  IHomeSectionId,
  IHomeSectionSemanticModel,
  IHomeShellSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';

const MAX_ACCEPTED_INTENT_IDS = 128;
const MAX_DISMISSED_BANNER_IDS = 32;
const HOME_TAB_IDS: readonly IHomeTabId[] = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
];
const HOME_SECTION_IDS: readonly IHomeSectionId[] = [...HOME_TAB_IDS, 'market'];

function equal(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) {
    return true;
  }
  if (Array.isArray(left) && Array.isArray(right)) {
    return (
      left.length === right.length &&
      left.every((item, index) => Object.is(item, right[index]))
    );
  }
  if (
    !left ||
    !right ||
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    Array.isArray(left) ||
    Array.isArray(right)
  ) {
    return false;
  }
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord);
  return (
    keys.length === Object.keys(rightRecord).length &&
    keys.every((key) => Object.is(leftRecord[key], rightRecord[key]))
  );
}

function sameStringArray(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left === right ||
    (left.length === right.length &&
      left.every((value, index) => value === right[index]))
  );
}

function sameMoney(
  left: { amount: string; currency: string } | undefined,
  right: { amount: string; currency: string } | undefined,
): boolean {
  return (
    left === right ||
    Boolean(
      left &&
      right &&
      left.amount === right.amount &&
      left.currency === right.currency,
    )
  );
}

function samePortfolioPresentation(
  left: IHomePortfolioPresentation,
  right: IHomePortfolioPresentation,
): boolean {
  if (left === right || left.kind !== right.kind) {
    return left === right;
  }
  switch (left.kind) {
    case 'loading':
      return right.kind === 'loading' && left.refresh === right.refresh;
    case 'fundedPendingTotal':
      return (
        right.kind === 'fundedPendingTotal' &&
        sameMoney(left.header.balance, right.header.balance) &&
        sameStringArray(left.actions.items, right.actions.items) &&
        left.banner.kind === right.banner.kind &&
        left.refresh === right.refresh
      );
    case 'zero':
      return (
        right.kind === 'zero' &&
        sameMoney(left.header.balance, right.header.balance) &&
        sameStringArray(left.actions.items, right.actions.items) &&
        left.freshness === right.freshness &&
        left.refresh === right.refresh
      );
    case 'funded':
      return (
        right.kind === 'funded' &&
        sameMoney(left.header.balance, right.header.balance) &&
        left.header.authority === right.header.authority &&
        sameStringArray(left.actions.items, right.actions.items) &&
        left.banner.kind === right.banner.kind &&
        left.freshness === right.freshness &&
        left.refresh === right.refresh
      );
    case 'unavailable':
      return (
        right.kind === 'unavailable' &&
        left.header.reason === right.header.reason
      );
    default:
      return false;
  }
}

function sameShell(
  left: IHomeShellSemanticModel,
  right: IHomeShellSemanticModel,
): boolean {
  if (left === right || left.kind !== right.kind) {
    return left === right;
  }
  if (left.kind === 'portfolio' && right.kind === 'portfolio') {
    return samePortfolioPresentation(left.presentation, right.presentation);
  }
  if (left.kind === 'backupRequired' && right.kind === 'backupRequired') {
    return left.commandId === right.commandId;
  }
  return true;
}

function sameShellCommands(
  left: IHomeShellSemanticModel,
  right: IHomeShellSemanticModel,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'backupRequired' && right.kind === 'backupRequired') {
    return left.commandId === right.commandId;
  }
  if (left.kind === 'portfolio' && right.kind === 'portfolio') {
    return (
      left.presentation.actions.kind === right.presentation.actions.kind &&
      sameStringArray(
        left.presentation.actions.items,
        right.presentation.actions.items,
      ) &&
      left.presentation.banner.kind === right.presentation.banner.kind
    );
  }
  return true;
}

function sameNavigationRecord<TValue extends string | boolean>(
  keys: readonly string[],
  left: Readonly<Record<string, TValue>> | undefined,
  right: Readonly<Record<string, TValue>> | undefined,
): boolean {
  return keys.every((key) => left?.[key] === right?.[key]);
}

function sameNavigation(
  left: IHomeNavigationSemanticModel,
  right: IHomeNavigationSemanticModel,
): boolean {
  if (left === right || left.kind !== right.kind) {
    return left === right;
  }
  if (left.kind === 'hidden' || right.kind === 'hidden') {
    return left.kind === right.kind;
  }
  return (
    sameStringArray(left.tabs, right.tabs) &&
    left.selectedTabId === right.selectedTabId &&
    left.freshness === right.freshness &&
    left.perpsDestination === right.perpsDestination &&
    left.refresh === right.refresh &&
    sameNavigationRecord(HOME_TAB_IDS, left.destinations, right.destinations) &&
    sameNavigationRecord(HOME_SECTION_IDS, left.sections, right.sections)
  );
}

function sameNavigationApplicability(
  left: IHomeNavigationSemanticModel,
  right: IHomeNavigationSemanticModel,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }
  if (left.kind === 'hidden' || right.kind === 'hidden') {
    return true;
  }
  return (
    sameStringArray(left.tabs, right.tabs) &&
    left.perpsDestination === right.perpsDestination &&
    sameNavigationRecord(HOME_TAB_IDS, left.destinations, right.destinations) &&
    sameNavigationRecord(HOME_SECTION_IDS, left.sections, right.sections)
  );
}

function sameSection(
  left: IHomeSectionSemanticModel,
  right: IHomeSectionSemanticModel,
): boolean {
  if (left === right || left.kind !== right.kind) {
    return left === right;
  }
  switch (left.kind) {
    case 'hidden':
      return right.kind === 'hidden' && left.reason === right.reason;
    case 'loading':
      return right.kind === 'loading' && left.placeholder === right.placeholder;
    case 'empty':
      return right.kind === 'empty' && left.emptyState === right.emptyState;
    case 'ready':
      return (
        right.kind === 'ready' &&
        sameStringArray(left.rowIds, right.rowIds) &&
        left.freshness === right.freshness &&
        left.refresh === right.refresh
      );
    case 'error':
      return right.kind === 'error' && left.errorState === right.errorState;
    default:
      return false;
  }
}

function sameSectionCommands(
  left: IHomeSectionSemanticModel,
  right: IHomeSectionSemanticModel,
): boolean {
  return (
    left.kind === right.kind &&
    (left.kind !== 'ready' ||
      (right.kind === 'ready' && sameStringArray(left.rowIds, right.rowIds)))
  );
}

function emptyTransition(): IHomeStoreTransition {
  return { patch: { mutations: [] }, effects: [] };
}

function acceptedTransition(
  state: IHomeStoreState,
  mutations: IHomeStoreMutation[],
  effects: IHomeStoreEffect[] = [],
  diagnostics?: IHomeStoreDiagnosticsState,
): IHomeStoreTransition {
  if (mutations.length === 0 && effects.length === 0) {
    return emptyTransition();
  }
  if (mutations.length > 0) {
    mutations.push({
      slice: 'diagnostics',
      operation: {
        kind: 'set',
        value: {
          ...(diagnostics ?? state.diagnostics),
          acceptedEventCount:
            (diagnostics ?? state.diagnostics).acceptedEventCount + 1,
          lastRejectReason: undefined,
        },
      },
    });
  }
  return { patch: { mutations }, effects };
}

function rejectedTransition(
  state: IHomeStoreState,
  reason: IHomeStoreRejectReason,
  intentId?: string,
): IHomeStoreTransition {
  return {
    patch: {
      mutations: [
        {
          slice: 'diagnostics',
          operation: {
            kind: 'set',
            value: {
              ...state.diagnostics,
              rejectedEventCount: state.diagnostics.rejectedEventCount + 1,
              staleRejectCount: state.diagnostics.staleRejectCount + 1,
              lastRejectReason: reason,
            },
          },
        },
      ],
    },
    effects: [{ kind: 'traceReject', reason, intentId }],
  };
}

function ownerTokensMatch(
  state: IHomeStoreState,
  candidate: { scopeKey: string; sessionId: string },
): boolean {
  return Boolean(
    state.session.ownerToken?.scopeKey === candidate.scopeKey &&
    state.session.ownerToken.sessionId === candidate.sessionId,
  );
}

function shellCommandSignature(value: IHomeShellSemanticModel): unknown {
  if (value.kind === 'backupRequired') {
    return { commandId: value.commandId };
  }
  if (value.kind !== 'portfolio') {
    return { kind: value.kind };
  }
  return {
    actions: value.presentation.actions,
    banner: value.presentation.banner,
  };
}

function navigationApplicabilitySignature(
  value: IHomeNavigationSemanticModel,
): unknown {
  if (value.kind === 'hidden') {
    return value;
  }
  return {
    kind: value.kind,
    tabs: value.tabs,
    destinations: value.destinations,
    perpsDestination: value.perpsDestination,
    sections: value.sections,
  };
}

function sectionCommandSignature(value: IHomeSectionSemanticModel): unknown {
  return value.kind === 'ready'
    ? { kind: value.kind, rowIds: value.rowIds }
    : { kind: value.kind };
}

function serializeSectionForResource(
  value: IHomeSectionSemanticModel,
  data?: IHomeRuntimeJsonValue,
  freshness: 'confirmedCache' | 'live' = 'live',
  token?: IHomeRuntimeRequestToken,
  emptyCoverageFingerprint?: string,
):
  | IHomeStoreResourceSlot<
      IHomeStoreState['resources'][IHomeStoreSourceId] extends IHomeStoreResourceSlot<
        infer TPayload
      >
        ? TPayload
        : never
    >
  | undefined {
  if (value.kind === 'empty') {
    return {
      kind: 'empty',
      token,
      coverageFingerprint: emptyCoverageFingerprint ?? 'empty:v2',
      freshness,
      refresh: 'idle',
    };
  }
  if (value.kind !== 'ready') {
    return undefined;
  }
  return {
    kind: 'ready',
    token,
    data: {
      payload: data ?? null,
      section: value,
    },
    coverageFingerprint: [
      value.rowIds.length,
      value.rowIds[0] ?? '',
      value.rowIds[value.rowIds.length - 1] ?? '',
    ].join(':'),
    freshness,
    refresh: value.refresh,
  };
}

function parseSectionPayload(
  sectionId: IHomeSectionId,
  payload: unknown,
  freshness: 'confirmedCache' | 'live',
  refresh: 'failed' | 'idle' | 'refreshing',
): IHomeSectionSemanticModel | undefined {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return undefined;
  }
  const section = (payload as { section?: unknown }).section;
  if (!section || typeof section !== 'object' || Array.isArray(section)) {
    return undefined;
  }
  const candidate = section as {
    kind?: unknown;
    rowIds?: unknown;
  };
  if (
    candidate.kind === 'ready' &&
    Array.isArray(candidate.rowIds) &&
    candidate.rowIds.every((rowId) => typeof rowId === 'string')
  ) {
    return {
      kind: 'ready',
      rowIds: candidate.rowIds,
      freshness,
      refresh,
    };
  }
  if (candidate.kind === 'empty') {
    return { kind: 'empty', emptyState: sectionId };
  }
  return undefined;
}

function isHomeSectionId(
  sourceId: IHomeStoreSourceId,
): sourceId is IHomeSectionId {
  return (
    ['portfolio', 'perps', 'defi', 'nft', 'history', 'market'] as const
  ).some((candidate) => candidate === sourceId);
}

function resolvePreferredTab(
  value: IHomeNavigationSemanticModel,
  preferredTabId: IHomeTabId | undefined,
): IHomeNavigationSemanticModel {
  if (
    value.kind !== 'ready' ||
    !preferredTabId ||
    !value.tabs.includes(preferredTabId) ||
    (value.destinations && value.destinations[preferredTabId] !== 'inline')
  ) {
    return value;
  }
  return value.selectedTabId === preferredTabId
    ? value
    : { ...value, selectedTabId: preferredTabId };
}

function advanceShell(
  current: IHomeStoreShellSlice,
  value: IHomeShellSemanticModel,
): IHomeStoreShellSlice {
  const displayChanged = !sameShell(current.value, value);
  const currentDisplay = projectHomeDisplayModel({ shell: current.value });
  const nextDisplay = projectHomeDisplayModel({ shell: value });
  const balanceChanged =
    currentDisplay.balance.kind !== nextDisplay.balance.kind ||
    currentDisplay.balance.revision !== nextDisplay.balance.revision;
  const actionsChanged =
    currentDisplay.actions.kind !== nextDisplay.actions.kind ||
    (currentDisplay.actions.kind !== 'hidden' &&
      currentDisplay.actions.kind !== 'loading' &&
      nextDisplay.actions.kind !== 'hidden' &&
      nextDisplay.actions.kind !== 'loading' &&
      !sameStringArray(
        currentDisplay.actions.items,
        nextDisplay.actions.items,
      ));
  const bannerChanged = currentDisplay.banner.kind !== nextDisplay.banner.kind;
  const bodyChanged = currentDisplay.body.kind !== nextDisplay.body.kind;
  const commandsChanged = !sameShellCommands(current.value, value);
  if (!displayChanged && !commandsChanged) {
    return current;
  }
  return {
    actionsPresentationRevision:
      current.actionsPresentationRevision + (actionsChanged ? 1 : 0),
    balancePresentationRevision:
      current.balancePresentationRevision + (balanceChanged ? 1 : 0),
    bannerPresentationRevision:
      current.bannerPresentationRevision + (bannerChanged ? 1 : 0),
    bodyPresentationRevision:
      current.bodyPresentationRevision + (bodyChanged ? 1 : 0),
    presentationRevision:
      current.presentationRevision + (displayChanged ? 1 : 0),
    shellCommandRevision:
      current.shellCommandRevision + (commandsChanged ? 1 : 0),
    value,
  };
}

function advanceShellPreservingConfirmedCache(
  current: IHomeStoreShellSlice,
  value: IHomeShellSemanticModel,
): IHomeStoreShellSlice {
  const currentPresentation =
    current.value.kind === 'portfolio' ? current.value.presentation : undefined;
  const nextPresentation =
    value.kind === 'portfolio' ? value.presentation : undefined;
  const currentHasStableVerdict =
    (currentPresentation?.kind === 'funded' ||
      currentPresentation?.kind === 'zero') &&
    (currentPresentation.freshness === 'confirmedCache' ||
      currentPresentation.freshness === 'live');
  const nextHasLowerQuality =
    nextPresentation?.kind === 'loading' ||
    nextPresentation?.kind === 'unavailable' ||
    (currentPresentation?.kind === 'funded' &&
      nextPresentation?.kind === 'fundedPendingTotal');
  if (currentHasStableVerdict && nextHasLowerQuality) {
    const refreshFailed =
      nextPresentation?.kind === 'unavailable' ||
      nextPresentation?.refresh === 'failed';
    return advanceShell(current, {
      kind: 'portfolio',
      presentation: {
        ...currentPresentation,
        banner: nextPresentation?.banner ?? currentPresentation.banner,
        refresh: refreshFailed ? 'failed' : 'refreshing',
      },
    });
  }
  return advanceShell(current, value);
}

function markDisplaySnapshotRefreshFailed(
  shell: IHomeShellSemanticModel,
): IHomeShellSemanticModel {
  if (
    shell.kind !== 'portfolio' ||
    (shell.presentation.kind !== 'funded' && shell.presentation.kind !== 'zero')
  ) {
    return shell;
  }
  return {
    ...shell,
    presentation: {
      ...shell.presentation,
      refresh: 'failed',
    },
  };
}

function advanceNavigation(
  current: IHomeStoreNavigationSlice,
  value: IHomeNavigationSemanticModel,
): IHomeStoreNavigationSlice {
  const displayChanged = !sameNavigation(current.value, value);
  const applicabilityChanged = !sameNavigationApplicability(
    current.value,
    value,
  );
  if (!displayChanged && !applicabilityChanged) {
    return current;
  }
  return {
    presentationRevision:
      current.presentationRevision + (displayChanged ? 1 : 0),
    tabApplicabilityRevision:
      current.tabApplicabilityRevision + (applicabilityChanged ? 1 : 0),
    value,
  };
}

function advanceSection(
  current: IHomeStoreSectionSlice,
  value: IHomeSectionSemanticModel,
): IHomeStoreSectionSlice {
  const displayChanged = !sameSection(current.value, value);
  const commandsChanged = !sameSectionCommands(current.value, value);
  if (!displayChanged && !commandsChanged) {
    return current;
  }
  return {
    presentationRevision:
      current.presentationRevision + (displayChanged ? 1 : 0),
    sectionCommandRevision:
      current.sectionCommandRevision + (commandsChanged ? 1 : 0),
    value,
  };
}

function createConfirmedCacheMutations({
  records,
  state,
}: {
  records: readonly IHomeCachedSourceRecord[];
  state: IHomeStoreState;
}): IHomeStoreMutation[] {
  const mutations: IHomeStoreMutation[] = [];
  records.forEach((record) => {
    const current = state.resources[record.sourceId];
    const token = current.kind === 'idle' ? undefined : current.token;
    const refresh = current.kind === 'error' ? 'failed' : 'refreshing';
    const cachedPayload =
      record.payload &&
      typeof record.payload === 'object' &&
      !Array.isArray(record.payload)
        ? (record.payload as {
            readonly [key: string]: IHomeRuntimeJsonValue;
          })
        : undefined;
    const cachedSection = cachedPayload?.section;
    const isCachedEmpty = Boolean(
      cachedSection &&
      typeof cachedSection === 'object' &&
      !Array.isArray(cachedSection) &&
      (cachedSection as { readonly kind?: IHomeRuntimeJsonValue }).kind ===
        'empty',
    );
    mutations.push({
      slice: 'resource',
      sourceId: record.sourceId,
      operation: {
        kind: 'set',
        value: isCachedEmpty
          ? {
              kind: 'empty',
              token,
              coverageFingerprint: record.coverageFingerprint,
              confirmedCacheSourceKeyIdentity: record.sourceKeyIdentity,
              freshness: 'confirmedCache',
              refresh,
            }
          : {
              kind: 'ready',
              token,
              data: record.payload,
              coverageFingerprint: record.coverageFingerprint,
              confirmedCacheSourceKeyIdentity: record.sourceKeyIdentity,
              freshness: 'confirmedCache',
              refresh,
            },
      },
    });
    if (isHomeSectionId(record.sourceId)) {
      const sectionId = record.sourceId;
      const cachedSectionValue = parseSectionPayload(
        sectionId,
        record.payload,
        'confirmedCache',
        refresh,
      );
      if (cachedSectionValue) {
        mutations.push({
          slice: 'section',
          sectionId,
          operation: {
            kind: 'set',
            value: advanceSection(
              state.sections[sectionId],
              cachedSectionValue,
            ),
          },
        });
      }
    }
  });
  return mutations;
}

function resetOwnerScopedMutations({
  headerAccountPresentation,
  session,
  state,
  topology,
}: {
  headerAccountPresentation?: IHomeHeaderAccountPresentation;
  session: IHomeLifecycleSessionState;
  state: IHomeStoreState;
  topology: IHomeStoreState['runtime']['topology'];
}): IHomeStoreMutation[] {
  // Never mutate the previous owner's scoped store into the next owner. Replace
  // it atomically with owner-matched state, or reset it until that state exists.
  const initial = createInitialHomeStoreState();
  const mutations: IHomeStoreMutation[] = [
    {
      slice: 'session',
      operation: {
        kind: 'set',
        value: session,
      },
    },
    {
      slice: 'runtime',
      operation: {
        kind: 'set',
        value: { ...initial.runtime, topology },
      },
    },
    {
      slice: 'headerPresentation',
      operation: {
        kind: 'set',
        value: headerAccountPresentation
          ? {
              account: headerAccountPresentation,
              accountPresentationRevision: 1,
            }
          : initial.headerPresentation,
      },
    },
    { slice: 'walletInputs', operation: { kind: 'reset' } },
    { slice: 'environmentInputs', operation: { kind: 'reset' } },
    { slice: 'capabilityInputs', operation: { kind: 'reset' } },
    { slice: 'facts', operation: { kind: 'reset' } },
    { slice: 'balanceRound', operation: { kind: 'reset' } },
    { slice: 'confirmedBalance', operation: { kind: 'reset' } },
    {
      slice: 'interaction',
      operation: {
        kind: 'set',
        value: {
          ...initial.interaction,
          visibility: state.interaction.visibility,
        },
      },
    },
    { slice: 'shell', operation: { kind: 'reset' } },
    { slice: 'navigation', operation: { kind: 'reset' } },
    { slice: 'diagnostics', operation: { kind: 'reset' } },
  ];
  (
    [
      'capability',
      'banner',
      'portfolio',
      'perps',
      'defi',
      'nft',
      'history',
      'market',
    ] as const
  ).forEach((sourceId) => {
    mutations.push({
      slice: 'resource',
      sourceId,
      operation: { kind: 'reset' },
    });
  });
  (['portfolio', 'perps', 'defi', 'nft', 'history', 'market'] as const).forEach(
    (sectionId) => {
      mutations.push({
        slice: 'section',
        sectionId,
        operation: { kind: 'reset' },
      });
    },
  );
  return mutations;
}

function sourceIdFromRuntimeSourceId(
  sourceId: string,
): IHomeStoreSourceId | undefined {
  return (
    [
      'capability',
      'banner',
      'portfolio',
      'perps',
      'defi',
      'nft',
      'history',
      'market',
    ] as const
  ).find((candidate) => candidate === sourceId);
}

function isCapabilitySet(value: unknown): value is IHomeCapabilitySet {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Partial<IHomeCapabilitySet>;
  return (
    Array.isArray(candidate.tabs) &&
    candidate.tabs.length > 0 &&
    typeof candidate.revision === 'string' &&
    Boolean(candidate.destinations) &&
    Boolean(candidate.sections)
  );
}

function capabilityCacheForFacts(
  state: IHomeStoreState,
  sourceKeyIdentity: string,
): IHomeConfirmedCapabilityCacheState {
  const resource = state.resources.capability;
  if (
    resource.kind !== 'ready' ||
    !isCapabilitySet(resource.data) ||
    state.facts?.capability?.sourceKeyIdentity !== sourceKeyIdentity
  ) {
    return { entries: [] };
  }
  return {
    entries: [
      {
        coverageFingerprint: resource.coverageFingerprint,
        ownerScopeKey: state.session.ownerToken?.scopeKey ?? '',
        sourceKeyIdentity,
        value: resource.data,
      },
    ],
  };
}

function exactConfirmedBalance(
  state: IHomeStoreState,
  facts: IHomeBalanceFacts,
): IHomeConfirmedBalanceRecord | undefined {
  const confirmed = state.confirmedBalance;
  return confirmed &&
    confirmed.ownerScopeKey === facts.ownerToken.scopeKey &&
    confirmed.sourceKeyIdentity === facts.sourceKeyIdentity &&
    confirmed.quoteBasis.currency === facts.quoteBasis.currency &&
    confirmed.quoteBasis.pricingRevision === facts.quoteBasis.pricingRevision
    ? confirmed
    : undefined;
}

function getResourceToken(
  current: IHomeStoreResourceSlot<
    IHomeStoreState['resources'][IHomeStoreSourceId] extends IHomeStoreResourceSlot<
      infer TPayload
    >
      ? TPayload
      : never
  >,
) {
  return current.kind === 'idle' ? undefined : current.token;
}

function tokensMatch(
  current: IHomeStoreResourceSlot<
    IHomeStoreState['resources'][IHomeStoreSourceId] extends IHomeStoreResourceSlot<
      infer TPayload
    >
      ? TPayload
      : never
  >,
  candidate: object,
): boolean {
  const token = getResourceToken(current);
  return Boolean(token && equal(token, candidate));
}

function validateIntent(
  state: IHomeStoreState,
  intent: IHomeStoreIntent,
): IHomeStoreRejectReason | undefined {
  if (state.session.ownerToken?.sessionId !== intent.sessionId) {
    return 'sessionMismatch';
  }
  if (
    !state.session.owner ||
    !ownerTokensMatch(state, {
      scopeKey: state.session.ownerToken?.scopeKey ?? '',
      sessionId: intent.sessionId,
    })
  ) {
    return 'ownerMismatch';
  }
  if (!equal(state.session.owner, intent.owner)) {
    return 'ownerMismatch';
  }
  if (intent.authority.kind === 'tabApplicability') {
    return intent.authority.revision ===
      state.navigation.tabApplicabilityRevision
      ? undefined
      : 'intentAuthorityExpired';
  }
  if (intent.authority.kind === 'shellCommands') {
    if (intent.authority.revision !== state.shell.shellCommandRevision) {
      return 'intentAuthorityExpired';
    }
    if (
      intent.type === 'headerActionInvoked' &&
      intent.actionId.startsWith('home.banner.')
    ) {
      if (state.resources.banner.kind !== 'ready') {
        return 'intentTargetUnavailable';
      }
      const presentation =
        state.shell.value.kind === 'portfolio'
          ? state.shell.value.presentation
          : undefined;
      const payload = readHomeBannerStorePayload(state.resources.banner.data);
      const item = payload?.banners.find(
        (candidate) => candidate.id === intent.itemId,
      );
      if (presentation?.banner.kind !== 'positive' || !item) {
        return 'intentTargetUnavailable';
      }
      if (
        intent.actionId === HOME_BANNER_ACTION_IDS.dismiss &&
        !item.closeable
      ) {
        return 'intentTargetUnavailable';
      }
      if (
        (intent.actionId === HOME_BANNER_ACTION_IDS.bindReferral ||
          intent.actionId === HOME_BANNER_ACTION_IDS.snoozeReferral) &&
        item.id !== HOME_PERPS_REFERRAL_BANNER_ID
      ) {
        return 'intentTargetUnavailable';
      }
      if (
        !Object.values(HOME_BANNER_ACTION_IDS).some(
          (actionId) => actionId === intent.actionId,
        )
      ) {
        return 'intentTargetUnavailable';
      }
    }
    if (intent.type !== 'headerActionInvoked') {
      return 'intentTargetUnavailable';
    }
    return Object.values(HOME_SHELL_ACTION_IDS).some(
      (actionId) => actionId === intent.actionId,
    ) || intent.actionId.startsWith('home.banner.')
      ? undefined
      : 'intentTargetUnavailable';
  }
  const sectionId = intent.authority.sectionId;
  if (
    intent.authority.revision !==
    state.sections[sectionId].sectionCommandRevision
  ) {
    return 'intentAuthorityExpired';
  }
  if (intent.type === 'sectionControlChanged') {
    return undefined;
  }
  if (
    intent.type !== 'sectionActionInvoked' &&
    intent.type !== 'sectionRefreshRequested'
  ) {
    return 'intentTargetUnavailable';
  }
  const allowedPrefixes: Record<typeof sectionId, readonly string[]> = {
    portfolio: ['home.portfolio.', 'home.asset.'],
    perps: ['home.perps.'],
    defi: ['home.defi.'],
    nft: ['home.nft.'],
    history: ['home.history.'],
    market: ['home.market.', 'home.widget.market.'],
  };
  if (
    !allowedPrefixes[sectionId].some((prefix) =>
      intent.actionId.startsWith(prefix),
    )
  ) {
    return 'intentTargetUnavailable';
  }
  const rowTargetActionIds = new Set<string>([
    HOME_SECTION_ACTION_IDS.openAsset,
    HOME_SECTION_ACTION_IDS.openDeFiProtocol,
    HOME_SECTION_ACTION_IDS.openHistory,
    HOME_SECTION_ACTION_IDS.openMarket,
    HOME_SECTION_ACTION_IDS.openNFT,
  ]);
  if (rowTargetActionIds.has(intent.actionId)) {
    const section = state.sections[sectionId].value;
    if (
      !intent.itemId ||
      section.kind !== 'ready' ||
      !section.rowIds.includes(intent.itemId)
    ) {
      return 'intentTargetUnavailable';
    }
  }
  return undefined;
}

export function reduceHomeStore(
  state: IHomeStoreState,
  event: IHomeStoreEvent,
): IHomeStoreTransition {
  switch (event.type) {
    case 'runtimeAcquired': {
      if (
        state.session.runtimeInstanceId === event.runtimeInstanceId &&
        state.session.clientInstanceId === event.clientInstanceId &&
        state.session.mode === event.mode &&
        state.runtime.topology === event.topology
      ) {
        return emptyTransition();
      }
      return acceptedTransition(state, [
        {
          slice: 'session',
          operation: {
            kind: 'set',
            value: {
              ...state.session,
              mode: event.mode,
              runtimeInstanceId: event.runtimeInstanceId,
              clientInstanceId: event.clientInstanceId,
              appEpoch: event.appEpoch,
              sessionId: `${event.runtimeInstanceId}:0`,
            },
          },
        },
        {
          slice: 'runtime',
          operation: {
            kind: 'set',
            value: { ...state.runtime, topology: event.topology },
          },
        },
      ]);
    }
    case 'sessionEvent': {
      const transition = transitionHomeSession(state.session, event.event);
      if (transition.state === state.session) {
        return emptyTransition();
      }
      if (event.event.type === 'ownerChanged') {
        return acceptedTransition(
          state,
          resetOwnerScopedMutations({
            session: transition.state,
            state,
            topology: state.runtime.topology,
          }),
          [...transition.effects],
          createInitialHomeStoreState().diagnostics,
        );
      }
      const mutations: IHomeStoreMutation[] = [
        {
          slice: 'session',
          operation: { kind: 'set', value: transition.state },
        },
      ];
      if (event.event.type === 'runtimeHandshakeSucceeded') {
        mutations.push({
          slice: 'runtime',
          operation: {
            kind: 'set',
            value: {
              ...state.runtime,
              connection: 'ready',
              producerInstanceId: event.event.producerInstanceId,
              protocolVersion: 1,
            },
          },
        });
      } else if (
        event.event.type === 'runtimeHandshakeFailed' &&
        event.event.exhausted
      ) {
        mutations.push({
          slice: 'runtime',
          operation: {
            kind: 'set',
            value: { ...state.runtime, connection: 'degraded' },
          },
        });
      } else if (event.event.type === 'stopped') {
        mutations.push({
          slice: 'runtime',
          operation: {
            kind: 'set',
            value: { ...state.runtime, connection: 'stopped' },
          },
        });
      }
      if (
        event.event.type === 'appActivityChanged' ||
        event.event.type === 'surfaceVisibilityChanged'
      ) {
        const visibility =
          transition.state.appActivity === 'background' ||
          transition.state.surfaceVisibility !== 'visible'
            ? 'background'
            : 'foreground';
        if (state.interaction.visibility !== visibility) {
          mutations.push({
            slice: 'interaction',
            operation: {
              kind: 'set',
              value: { ...state.interaction, visibility },
            },
          });
        }
      }
      return acceptedTransition(state, mutations, [...transition.effects]);
    }
    case 'ownerChanged': {
      const transition = transitionHomeSession(state.session, {
        type: 'ownerChanged',
        owner: event.owner,
      });
      if (transition.state === state.session) {
        return emptyTransition();
      }
      const nextSession = event.ownerToken
        ? {
            ...transition.state,
            ownerToken: event.ownerToken,
            sessionId: event.ownerToken.sessionId,
            authority: 'waitingForProducer' as const,
          }
        : transition.state;
      return acceptedTransition(
        state,
        resetOwnerScopedMutations({
          headerAccountPresentation: event.headerAccountPresentation,
          session: nextSession,
          state,
          topology: event.topology,
        }),
        [...transition.effects],
        createInitialHomeStoreState().diagnostics,
      );
    }
    case 'headerAccountPresentationChanged': {
      if (!ownerTokensMatch(state, event.ownerToken)) {
        return rejectedTransition(state, 'ownerMismatch');
      }
      if (equal(state.headerPresentation.account, event.presentation)) {
        return emptyTransition();
      }
      return acceptedTransition(state, [
        {
          slice: 'headerPresentation',
          operation: {
            kind: 'set',
            value: {
              account: event.presentation,
              accountPresentationRevision:
                state.headerPresentation.accountPresentationRevision + 1,
            },
          },
        },
      ]);
    }
    case 'factsChanged': {
      if (!ownerTokensMatch(state, event.facts.ownerToken)) {
        return rejectedTransition(state, 'ownerMismatch');
      }
      const previousFacts = state.facts;
      const facts = previousFacts
        ? {
            ...event.facts,
            capability: previousFacts.capability,
            capabilityInputs: state.capabilityInputs,
            balance: state.balanceRound,
            environment: {
              ...event.facts.environment,
              ...(previousFacts.environment.currency
                ? { currency: previousFacts.environment.currency }
                : {}),
            },
          }
        : event.facts;
      const semantic = projectHomeSemanticModel({ facts });
      const mutations: IHomeStoreMutation[] = [];
      if (!equal(state.facts, facts)) {
        mutations.push({
          slice: 'facts',
          operation: { kind: 'set', value: facts },
        });
      }
      if (!equal(state.walletInputs, event.facts.wallet)) {
        mutations.push({
          slice: 'walletInputs',
          operation: { kind: 'set', value: event.facts.wallet },
        });
      }
      if (!equal(state.environmentInputs, event.facts.environment)) {
        mutations.push({
          slice: 'environmentInputs',
          operation: { kind: 'set', value: event.facts.environment },
        });
      }
      {
        const nextShell = advanceShellPreservingConfirmedCache(
          state.shell,
          semantic.shell,
        );
        if (nextShell !== state.shell) {
          mutations.push({
            slice: 'shell',
            operation: { kind: 'set', value: nextShell },
          });
        }
      }
      const effects: IHomeStoreEffect[] =
        mutations.length > 0 &&
        state.session.authority === 'ready' &&
        state.session.ownerToken
          ? [
              {
                kind: 'reconcileSourcePlan',
                sessionId: state.session.ownerToken.sessionId,
              },
            ]
          : [];
      return acceptedTransition(state, mutations, effects);
    }
    case 'runtimeChanged': {
      if (equal(state.runtime, event.runtime)) {
        return emptyTransition();
      }
      let authority: IHomeStoreState['session']['authority'] =
        'waitingForProducer';
      if (event.runtime.connection === 'ready') {
        authority = 'ready';
      } else if (event.runtime.connection === 'degraded') {
        authority = 'degraded';
      } else if (event.runtime.connection === 'stopped') {
        authority = 'stopped';
      }
      return acceptedTransition(state, [
        {
          slice: 'runtime',
          operation: { kind: 'set', value: event.runtime },
        },
        {
          slice: 'session',
          operation: {
            kind: 'set',
            value: {
              ...state.session,
              authority,
              producerInstanceId: event.runtime.producerInstanceId,
            },
          },
        },
      ]);
    }
    case 'balanceChanged': {
      if (!ownerTokensMatch(state, event.facts.ownerToken)) {
        return rejectedTransition(state, 'ownerMismatch');
      }
      const balance = event.facts.balance;
      if (!balance) {
        return emptyTransition();
      }
      const aggregation = aggregateHomeBalanceFacts(balance);
      const portfolioResource = balance.contributors.portfolio?.resource;
      // Portfolio is the eager source that can settle zero. Lazy contributors
      // may still upgrade the verdict immediately through positive evidence.
      const decisivePortfolioIsEmpty =
        portfolioResource?.kind === 'complete' &&
        portfolioResource.result.kind === 'empty';
      const exact = exactConfirmedBalance(state, balance);
      const decision = projectHomeBalanceAuthority({
        aggregation,
        bannerAvailable: balance.bannerAvailable,
        confirmed: exact,
        confirmedAt: event.observedAt,
        decisivePortfolioIsEmpty,
      });
      const facts = {
        ...event.facts,
        capability: state.facts?.capability ?? event.facts.capability,
        capabilityInputs: state.capabilityInputs,
        balance,
      };
      const shell = projectHomeShell({
        facts,
        portfolioPresentation: decision.presentation,
      });
      const next = advanceShellPreservingConfirmedCache(state.shell, shell);
      const mutations: IHomeStoreMutation[] = [];
      if (!equal(state.balanceRound, balance)) {
        mutations.push({
          slice: 'balanceRound',
          operation: { kind: 'set', value: balance },
        });
      }
      if (!equal(state.facts, facts)) {
        mutations.push({
          slice: 'facts',
          operation: { kind: 'set', value: facts },
        });
      }
      if (!equal(state.environmentInputs, facts.environment)) {
        mutations.push({
          slice: 'environmentInputs',
          operation: { kind: 'set', value: facts.environment },
        });
      }
      if (next !== state.shell) {
        mutations.push({
          slice: 'shell',
          operation: { kind: 'set', value: next },
        });
      }
      const confirmedBalance = decision.cacheCommit ?? exact;
      if (
        confirmedBalance &&
        !equal(state.confirmedBalance, confirmedBalance)
      ) {
        mutations.push({
          slice: 'confirmedBalance',
          operation: { kind: 'set', value: confirmedBalance },
        });
      }
      return acceptedTransition(state, mutations);
    }
    case 'capabilityChanged': {
      if (!ownerTokensMatch(state, event.facts.ownerToken)) {
        return rejectedTransition(state, 'ownerMismatch');
      }
      const cache = capabilityCacheForFacts(
        state,
        event.facts.sourceKeyIdentity,
      );
      const projection = projectHomeNavigation({
        cache,
        facts: event.facts,
        intent: {
          ownerToken: event.facts.ownerToken,
          selectedTabId: state.interaction.preferredTabId,
        },
      });
      const next = advanceNavigation(
        state.navigation,
        resolvePreferredTab(
          projection.navigation,
          state.interaction.preferredTabId,
        ),
      );
      const mutations: IHomeStoreMutation[] = [];
      if (next !== state.navigation) {
        mutations.push({
          slice: 'navigation',
          operation: { kind: 'set', value: next },
        });
      }
      const confirmedCapability: IHomeConfirmedCapabilityRecord | undefined =
        projection.cacheCommand?.kind === 'commit'
          ? projection.cacheCommand.record
          : cache.entries[0];
      if (confirmedCapability) {
        const currentCapability = state.resources.capability;
        const capabilityResource = {
          kind: 'ready' as const,
          data: confirmedCapability.value,
          coverageFingerprint: confirmedCapability.coverageFingerprint,
          freshness: 'live' as const,
          refresh: 'idle' as const,
        };
        if (!equal(currentCapability, capabilityResource)) {
          mutations.push({
            slice: 'resource',
            sourceId: 'capability',
            operation: { kind: 'set', value: capabilityResource },
          });
        }
      }
      const capabilityContext =
        event.facts.resource.kind === 'complete'
          ? event.facts.resource.context
          : undefined;
      const capabilityInputs = capabilityContext
        ? {
            ready: true,
            networkFamily: capabilityContext.networkFamily,
            accountType: capabilityContext.accountType,
            allNetworks: capabilityContext.allNetworks,
            serverConfig: {
              perps: capabilityContext.serverConfig.perps === 'available',
              defi: capabilityContext.serverConfig.defi === 'available',
              nft: capabilityContext.serverConfig.nft === 'available',
              history: capabilityContext.serverConfig.history === 'available',
              market: capabilityContext.serverConfig.market === 'available',
            },
            productAvailability: {
              perps:
                capabilityContext.productAvailability.perps === 'available',
              defi: capabilityContext.productAvailability.defi === 'available',
              nft: capabilityContext.productAvailability.nft === 'available',
              history:
                capabilityContext.productAvailability.history === 'available',
              market:
                capabilityContext.productAvailability.market === 'available',
            },
          }
        : { ...state.capabilityInputs, ready: false };
      if (!equal(state.capabilityInputs, capabilityInputs)) {
        mutations.push({
          slice: 'capabilityInputs',
          operation: { kind: 'set', value: capabilityInputs },
        });
      }
      if (state.facts) {
        const facts = {
          ...state.facts,
          capability: event.facts,
          capabilityInputs,
        };
        if (!equal(state.facts, facts)) {
          mutations.push({
            slice: 'facts',
            operation: { kind: 'set', value: facts },
          });
        }
      }
      return acceptedTransition(state, mutations);
    }
    case 'sectionSourceChanged': {
      if (!ownerTokensMatch(state, event.ownerToken)) {
        return rejectedTransition(state, 'ownerMismatch');
      }
      const current = state.sections[event.sectionId];
      let value: IHomeSectionSemanticModel;
      if (event.result.kind === 'ready') {
        value = {
          kind: 'ready',
          rowIds: event.result.rowIds,
          freshness: event.result.freshness,
          refresh: event.result.refresh,
        };
      } else if (event.result.kind === 'hidden') {
        value = event.result;
      } else if (event.result.kind === 'empty') {
        value = { kind: 'empty', emptyState: event.sectionId };
      } else if (event.result.kind === 'error') {
        value =
          current.value.kind === 'ready'
            ? { ...current.value, refresh: 'failed' }
            : { kind: 'error', errorState: event.sectionId };
      } else {
        value =
          current.value.kind === 'ready'
            ? { ...current.value, refresh: 'refreshing' }
            : { kind: 'loading', placeholder: event.sectionId };
      }
      const next = advanceSection(current, value);
      const mutations: IHomeStoreMutation[] = [];
      if (next !== current) {
        mutations.push({
          slice: 'section',
          sectionId: event.sectionId,
          operation: { kind: 'set', value: next },
        });
      }
      const currentResource = state.resources[event.sectionId];
      const shouldPreserveCurrentResource =
        (event.result.kind === 'loading' || event.result.kind === 'error') &&
        (currentResource.kind === 'ready' || currentResource.kind === 'empty');
      const resource:
        | IHomeStoreResourceSlot<IHomeRuntimeJsonValue>
        | undefined = shouldPreserveCurrentResource
        ? {
            ...currentResource,
            refresh: event.result.kind === 'loading' ? 'refreshing' : 'failed',
          }
        : serializeSectionForResource(
            value,
            event.result.kind === 'ready' ? event.result.data : undefined,
            event.result.kind === 'ready' ? event.result.freshness : undefined,
            event.token,
            event.result.kind === 'empty' &&
              event.result.confirmedEmpty === true
              ? event.result.coverageFingerprint
              : undefined,
          );
      if (resource && !equal(currentResource, resource)) {
        mutations.push({
          slice: 'resource',
          sourceId: event.sectionId,
          operation: { kind: 'set', value: resource },
        });
      }
      return acceptedTransition(state, mutations);
    }
    case 'sectionReset': {
      if (!ownerTokensMatch(state, event.ownerToken)) {
        return rejectedTransition(state, 'ownerMismatch');
      }
      const next = createInitialHomeStoreSection(event.sectionId);
      const resource = state.resources[event.sectionId];
      if (
        (resource.kind === 'ready' || resource.kind === 'empty') &&
        resource.freshness === 'confirmedCache'
      ) {
        // A snapshot can hydrate a visible source before its lazy producer has loaded
        // stable business inputs. Keep that display-only value through the
        // producer's setup reset; the first exact request will retain it, while
        // a mismatched request keeps it until live data can replace it.
        return emptyTransition();
      }
      if (
        equal(state.sections[event.sectionId], next) &&
        resource.kind === 'idle'
      ) {
        return emptyTransition();
      }
      return acceptedTransition(state, [
        {
          slice: 'section',
          sectionId: event.sectionId,
          operation: { kind: 'reset' },
        },
        {
          slice: 'resource',
          sourceId: event.sectionId,
          operation: { kind: 'reset' },
        },
      ]);
    }
    case 'sourceRequested': {
      const sourceId = sourceIdFromRuntimeSourceId(
        event.token.sourceKey.sourceId,
      );
      if (!sourceId) {
        return rejectedTransition(state, 'sourceMismatch');
      }
      if (
        event.token.sessionId !== state.session.ownerToken?.sessionId ||
        event.token.sourceKey.scopeKey !== state.session.ownerToken.scopeKey
      ) {
        return rejectedTransition(state, 'sessionMismatch');
      }
      if (
        state.runtime.producerInstanceId &&
        event.token.producerInstanceId !== state.runtime.producerInstanceId
      ) {
        return rejectedTransition(state, 'producerMismatch');
      }
      const current = state.resources[sourceId];
      const currentToken = getResourceToken(current);
      if (
        !state.runtime.producerInstanceId &&
        currentToken &&
        currentToken.producerInstanceId !== event.token.producerInstanceId
      ) {
        return rejectedTransition(state, 'producerMismatch');
      }
      const currentSeq =
        current.kind === 'idle' ? 0 : (current.token?.requestSeq ?? 0);
      if (event.token.requestSeq <= currentSeq) {
        return event.token.requestSeq === currentSeq &&
          currentToken &&
          equal(currentToken, event.token)
          ? emptyTransition()
          : rejectedTransition(state, 'requestSequenceStale');
      }
      let next: IHomeStoreResourceSlot<
        IHomeStoreState['resources'][IHomeStoreSourceId] extends IHomeStoreResourceSlot<
          infer TPayload
        >
          ? TPayload
          : never
      >;
      const canPreserveCurrent =
        current.kind === 'ready' || current.kind === 'empty';
      if (canPreserveCurrent) {
        next = { ...current, token: event.token, refresh: 'refreshing' };
      } else {
        next = { kind: 'loading', token: event.token };
      }
      const mutations: IHomeStoreMutation[] = [
        {
          slice: 'resource',
          sourceId,
          operation: { kind: 'set', value: next },
        },
      ];
      if (isHomeSectionId(sourceId)) {
        const currentSection = state.sections[sourceId];
        const sectionValue: IHomeSectionSemanticModel =
          canPreserveCurrent && currentSection.value.kind === 'ready'
            ? { ...currentSection.value, refresh: 'refreshing' }
            : { kind: 'loading', placeholder: sourceId };
        const nextSection = advanceSection(currentSection, sectionValue);
        if (nextSection !== currentSection) {
          mutations.push({
            slice: 'section',
            sectionId: sourceId,
            operation: { kind: 'set', value: nextSection },
          });
        }
      }
      return acceptedTransition(state, mutations);
    }
    case 'sourceResponded': {
      const sourceId = sourceIdFromRuntimeSourceId(
        event.envelope.token.sourceKey.sourceId,
      );
      if (!sourceId) {
        return rejectedTransition(state, 'sourceMismatch');
      }
      if (
        event.envelope.token.sessionId !==
          state.session.ownerToken?.sessionId ||
        event.envelope.token.sourceKey.scopeKey !==
          state.session.ownerToken?.scopeKey
      ) {
        return rejectedTransition(state, 'sessionMismatch');
      }
      if (
        state.runtime.producerInstanceId &&
        event.envelope.token.producerInstanceId !==
          state.runtime.producerInstanceId
      ) {
        return rejectedTransition(state, 'producerMismatch');
      }
      const current = state.resources[sourceId];
      if (!tokensMatch(current, event.envelope.token)) {
        return rejectedTransition(state, 'requestSequenceStale');
      }
      const { result } = event.envelope;
      let next: IHomeStoreResourceSlot<
        IHomeStoreState['resources'][IHomeStoreSourceId] extends IHomeStoreResourceSlot<
          infer TPayload
        >
          ? TPayload
          : never
      >;
      if (result.kind === 'partial') {
        if (current.kind === 'ready' || current.kind === 'empty') {
          return rejectedTransition(state, 'requestPhaseRegression');
        }
        next = {
          kind: 'partial',
          token: event.envelope.token,
          data: result.data,
          coverageFingerprint: result.coverageFingerprint,
        };
      } else if (result.kind === 'success') {
        next = {
          kind: 'ready',
          token: event.envelope.token,
          data: result.data,
          coverageFingerprint: result.coverageFingerprint,
          freshness: 'live',
          refresh: 'idle',
        };
      } else if (result.kind === 'empty') {
        next = {
          kind: 'empty',
          token: event.envelope.token,
          coverageFingerprint: result.coverageFingerprint,
          freshness: 'live',
          refresh: 'idle',
        };
      } else if (current.kind === 'ready' || current.kind === 'empty') {
        next = { ...current, refresh: 'failed' };
      } else {
        next = {
          kind: 'error',
          token: event.envelope.token,
          errorKind: result.errorKind,
        };
      }
      if (equal(current, next)) {
        return emptyTransition();
      }
      const mutations: IHomeStoreMutation[] = [
        {
          slice: 'resource',
          sourceId,
          operation: { kind: 'set', value: next },
        },
      ];
      if (isHomeSectionId(sourceId)) {
        let section: IHomeSectionSemanticModel | undefined;
        if (result.kind === 'empty') {
          section = { kind: 'empty', emptyState: sourceId };
        } else if (result.kind === 'partial' || result.kind === 'success') {
          section = parseSectionPayload(
            sourceId,
            result.data,
            'live',
            result.kind === 'partial' ? 'refreshing' : 'idle',
          );
        } else if (result.kind === 'error') {
          const currentSection = state.sections[sourceId];
          section =
            currentSection.value.kind === 'ready'
              ? { ...currentSection.value, refresh: 'failed' }
              : { kind: 'error', errorState: sourceId };
        }
        if (section) {
          const nextSection = advanceSection(state.sections[sourceId], section);
          if (nextSection !== state.sections[sourceId]) {
            mutations.push({
              slice: 'section',
              sectionId: sourceId,
              operation: { kind: 'set', value: nextSection },
            });
          }
        }
      }
      return acceptedTransition(state, mutations);
    }
    case 'confirmedSnapshotHydrated': {
      if (
        state.session.ownerToken?.scopeKey !== event.ownerScopeKey ||
        state.session.ownerToken.sessionId !== event.sessionId
      ) {
        return rejectedTransition(state, 'snapshotRejected');
      }
      const hasInvalidRecord = event.records.some((record) => {
        const current = state.resources[record.sourceId];
        return (
          current.kind === 'idle' ||
          current.kind === 'partial' ||
          current.kind === 'ready' ||
          current.kind === 'empty' ||
          !current.token ||
          !isHomeCachedRecordExactForToken(record, current.token)
        );
      });
      if (hasInvalidRecord) {
        return rejectedTransition(state, 'snapshotRejected');
      }
      const mutations = createConfirmedCacheMutations({
        records: event.records,
        state,
      });
      return acceptedTransition(state, mutations);
    }
    case 'displaySnapshotHydrated': {
      if (
        state.session.ownerToken?.scopeKey !== event.ownerScopeKey ||
        state.session.ownerToken.sessionId !== event.sessionId
      ) {
        return rejectedTransition(state, 'snapshotRejected');
      }
      const records = event.records.filter((record) => {
        const current = state.resources[record.sourceId];
        if (
          current.kind === 'partial' ||
          ((current.kind === 'ready' || current.kind === 'empty') &&
            current.freshness === 'live')
        ) {
          return false;
        }
        const token = current.kind === 'idle' ? undefined : current.token;
        return !token || isHomeCachedRecordExactForToken(record, token);
      });
      const mutations = createConfirmedCacheMutations({ records, state });
      const currentShellCanUseCache =
        state.shell.value.kind === 'loading' ||
        (state.shell.value.kind === 'portfolio' &&
          (state.shell.value.presentation.kind === 'loading' ||
            state.shell.value.presentation.kind === 'fundedPendingTotal' ||
            state.shell.value.presentation.kind === 'unavailable'));
      if (event.shell && currentShellCanUseCache) {
        const currentPresentation =
          state.shell.value.kind === 'portfolio'
            ? state.shell.value.presentation
            : undefined;
        const cachedShell =
          currentPresentation?.kind === 'unavailable' ||
          (currentPresentation?.kind === 'loading' &&
            currentPresentation.refresh === 'failed')
            ? markDisplaySnapshotRefreshFailed(event.shell)
            : event.shell;
        const shell = advanceShell(state.shell, cachedShell);
        if (shell !== state.shell) {
          mutations.push({
            slice: 'shell',
            operation: { kind: 'set', value: shell },
          });
        }
      }
      const capability = state.resources.capability;
      const hasLiveCapability =
        (capability.kind === 'ready' || capability.kind === 'empty') &&
        capability.freshness === 'live';
      if (event.navigation && !hasLiveCapability) {
        const navigation = advanceNavigation(
          state.navigation,
          event.navigation,
        );
        if (navigation !== state.navigation) {
          mutations.push({
            slice: 'navigation',
            operation: { kind: 'set', value: navigation },
          });
        }
      }
      return acceptedTransition(state, mutations);
    }
    case 'intentReceived': {
      const { intent } = event;
      if (state.interaction.acceptedIntentIds.includes(intent.intentId)) {
        return emptyTransition();
      }
      const rejectReason = validateIntent(state, intent);
      if (rejectReason) {
        return rejectedTransition(state, rejectReason, intent.intentId);
      }
      const acceptedIntentIds = [
        ...state.interaction.acceptedIntentIds,
        intent.intentId,
      ].slice(-MAX_ACCEPTED_INTENT_IDS);
      if (intent.type === 'tabSelected') {
        const navigation = state.navigation.value;
        if (
          navigation.kind !== 'ready' ||
          !navigation.tabs.includes(intent.tabId) ||
          (navigation.destinations &&
            navigation.destinations[intent.tabId] !== 'inline')
        ) {
          return rejectedTransition(
            state,
            'intentTargetUnavailable',
            intent.intentId,
          );
        }
        const nextNavigation = advanceNavigation(state.navigation, {
          ...navigation,
          selectedTabId: intent.tabId,
        });
        return acceptedTransition(
          state,
          [
            {
              slice: 'interaction',
              operation: {
                kind: 'set',
                value: {
                  ...state.interaction,
                  preferredTabId: intent.tabId,
                  acceptedIntentIds,
                },
              },
            },
            {
              slice: 'navigation',
              operation: { kind: 'set', value: nextNavigation },
            },
          ],
          [{ kind: 'reconcileSourcePlan', sessionId: intent.sessionId }],
        );
      }
      if (intent.type === 'tabHandoffInvoked') {
        const navigation = state.navigation.value;
        if (
          navigation.kind !== 'ready' ||
          !navigation.tabs.includes(intent.tabId) ||
          !navigation.destinations ||
          navigation.destinations[intent.tabId] !== 'web' ||
          intent.tabId !== 'perps' ||
          intent.actionId !== 'home.perps.openWeb'
        ) {
          return rejectedTransition(
            state,
            'intentTargetUnavailable',
            intent.intentId,
          );
        }
      }
      if (intent.type === 'sectionControlChanged') {
        const currentSectionControls =
          state.interaction.sectionControls[intent.sectionId] ?? {};
        const currentValue = currentSectionControls[intent.controlId];
        return acceptedTransition(
          state,
          [
            {
              slice: 'interaction',
              operation: {
                kind: 'set',
                value: {
                  ...state.interaction,
                  acceptedIntentIds,
                  sectionControls: equal(currentValue, intent.value)
                    ? state.interaction.sectionControls
                    : {
                        ...state.interaction.sectionControls,
                        [intent.sectionId]: {
                          ...currentSectionControls,
                          [intent.controlId]: intent.value,
                        },
                      },
                },
              },
            },
          ],
          [{ kind: 'executeCommand', intent }],
        );
      }
      const dismissedBannerIds =
        intent.type === 'headerActionInvoked' &&
        intent.actionId === HOME_BANNER_ACTION_IDS.dismiss &&
        intent.itemId
          ? [
              ...state.interaction.dismissedBannerIds.filter(
                (itemId) => itemId !== intent.itemId,
              ),
              intent.itemId,
            ].slice(-MAX_DISMISSED_BANNER_IDS)
          : state.interaction.dismissedBannerIds;
      return acceptedTransition(
        state,
        [
          {
            slice: 'interaction',
            operation: {
              kind: 'set',
              value: {
                ...state.interaction,
                acceptedIntentIds,
                dismissedBannerIds,
              },
            },
          },
        ],
        [{ kind: 'executeCommand', intent }],
      );
    }
    case 'visibilityChanged': {
      return reduceHomeStore(state, {
        type: 'sessionEvent',
        event: {
          type: 'surfaceVisibilityChanged',
          surfaceVisibility:
            event.visibility === 'foreground' ? 'visible' : 'hidden',
        },
      });
    }
    case 'stopped': {
      return reduceHomeStore(state, {
        type: 'sessionEvent',
        event: { type: 'stopped' },
      });
    }
    default: {
      return assertNever(event);
    }
  }
}

function applySetOrReset<T>(
  operation: { kind: 'set'; value: T } | { kind: 'reset' },
  initialValue: T,
): T {
  return operation.kind === 'set' ? operation.value : initialValue;
}

export function applyHomeStorePatchToState(
  state: IHomeStoreState,
  mutations: readonly IHomeStoreMutation[],
): IHomeStoreState {
  if (mutations.length === 0) {
    return state;
  }
  const initial = createInitialHomeStoreState();
  let next = state;
  mutations.forEach((mutation) => {
    switch (mutation.slice) {
      case 'session':
        next = {
          ...next,
          session: applySetOrReset(mutation.operation, initial.session),
        };
        return;
      case 'runtime':
        next = {
          ...next,
          runtime: applySetOrReset(mutation.operation, initial.runtime),
        };
        return;
      case 'headerPresentation':
        next = {
          ...next,
          headerPresentation: applySetOrReset(
            mutation.operation,
            initial.headerPresentation,
          ),
        };
        return;
      case 'walletInputs':
        next = {
          ...next,
          walletInputs: applySetOrReset(
            mutation.operation,
            initial.walletInputs,
          ),
        };
        return;
      case 'environmentInputs':
        next = {
          ...next,
          environmentInputs: applySetOrReset(
            mutation.operation,
            initial.environmentInputs,
          ),
        };
        return;
      case 'capabilityInputs':
        next = {
          ...next,
          capabilityInputs: applySetOrReset(
            mutation.operation,
            initial.capabilityInputs,
          ),
        };
        return;
      case 'facts':
        next = {
          ...next,
          facts:
            mutation.operation.kind === 'set'
              ? mutation.operation.value
              : undefined,
        };
        return;
      case 'resource':
        next = {
          ...next,
          resources: {
            ...next.resources,
            [mutation.sourceId]: applySetOrReset(
              mutation.operation,
              createInitialHomeStoreResources()[mutation.sourceId],
            ),
          },
        };
        return;
      case 'balanceRound':
        next = {
          ...next,
          balanceRound:
            mutation.operation.kind === 'set'
              ? mutation.operation.value
              : undefined,
        };
        return;
      case 'confirmedBalance':
        next = {
          ...next,
          confirmedBalance:
            mutation.operation.kind === 'set'
              ? mutation.operation.value
              : undefined,
        };
        return;
      case 'interaction':
        next = {
          ...next,
          interaction: applySetOrReset(mutation.operation, initial.interaction),
        };
        return;
      case 'shell':
        next = {
          ...next,
          shell: applySetOrReset(mutation.operation, initial.shell),
        };
        return;
      case 'navigation':
        next = {
          ...next,
          navigation: applySetOrReset(mutation.operation, initial.navigation),
        };
        return;
      case 'section':
        next = {
          ...next,
          sections: {
            ...next.sections,
            [mutation.sectionId]: applySetOrReset(
              mutation.operation,
              createInitialHomeStoreSection(mutation.sectionId),
            ),
          },
        };
        return;
      case 'diagnostics':
        next = {
          ...next,
          diagnostics: applySetOrReset(mutation.operation, initial.diagnostics),
        };
        return;
      default:
        assertNever(mutation);
    }
  });
  return {
    ...next,
    commitIdentity: {
      storeCommitId: state.commitIdentity.storeCommitId + 1,
    },
  };
}

function assertNever(value: never): never {
  throw new OneKeyLocalError(`Unexpected Home Store value: ${String(value)}`);
}

export {
  advanceNavigation,
  advanceSection,
  advanceShell,
  navigationApplicabilitySignature,
  sectionCommandSignature,
  shellCommandSignature,
};
export type { IHomeStoreDiagnosticsState };
