import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  type IHomeRuntimeJsonValue,
  isHomeRuntimeJsonValue,
} from '@onekeyhq/shared/src/types/homeRuntime';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { aggregateHomeBalanceFacts } from '../balance/homeBalanceAggregation';
import { getHomeSourceKeyIdentity } from '../core/homeIdentity';
import { projectHomeNavigation } from '../navigation/homeNavigationProjector';
import { projectHomeBalanceAuthority } from '../policies/homeBalanceAuthorityPolicy';
import { projectHomeShell } from '../policies/homeShellPolicy';
import {
  HOME_BANNER_ACTION_IDS,
  HOME_PERPS_REFERRAL_BANNER_ID,
  readHomeBannerStorePayload,
} from '../sections/banner/homeBannerStoreModel';
import { projectHomeSemanticModel } from '../semantic/homeSemanticProjector';

import {
  HOME_SECTION_ACTION_IDS,
  HOME_SHELL_ACTION_IDS,
} from './homeStoreCommandIds';
import {
  createInitialHomeStoreResources,
  createInitialHomeStoreSection,
  createInitialHomeStoreState,
} from './homeStoreInitialState';
import { isHomeCachedRecordExactForToken } from './homeStoreSnapshotCodec';

import type {
  IHomeCachedSourceRecord,
  IHomeStoreDiagnosticsState,
  IHomeStoreEffect,
  IHomeStoreEvent,
  IHomeStoreIntent,
  IHomeStoreMutation,
  IHomeStoreNavigationSlice,
  IHomeStorePendingSectionCommand,
  IHomeStorePendingShellCommand,
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
import type {
  IHomeNavigationSemanticModel,
  IHomeSectionId,
  IHomeSectionSemanticModel,
  IHomeShellSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';

const MAX_ACCEPTED_INTENT_IDS = 128;
const MAX_PENDING_SECTION_COMMANDS = 32;
const MAX_PENDING_SHELL_COMMANDS = 32;

function equal(left: unknown, right: unknown): boolean {
  return (
    stringUtils.stableStringify(left) === stringUtils.stableStringify(right)
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
      coverageFingerprint: stringUtils.stableStringify(value),
      freshness: 'live',
      refresh: 'idle',
    };
  }
  if (value.kind !== 'ready') {
    return undefined;
  }
  const parsed: unknown = JSON.parse(
    stringUtils.stableStringify({ payload: data, section: value }),
  );
  if (!isHomeRuntimeJsonValue(parsed)) {
    return undefined;
  }
  return {
    kind: 'ready',
    data: parsed,
    coverageFingerprint: stringUtils.stableStringify(value.rowIds),
    freshness: 'live',
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
  const displayChanged = !equal(current.value, value);
  const commandsChanged = !equal(
    shellCommandSignature(current.value),
    shellCommandSignature(value),
  );
  if (!displayChanged && !commandsChanged) {
    return current;
  }
  return {
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
  const currentHasConfirmedCache =
    (currentPresentation?.kind === 'funded' ||
      currentPresentation?.kind === 'zero') &&
    currentPresentation.freshness === 'confirmedCache';
  const nextStillAwaitsConfirmedTotal =
    nextPresentation?.kind === 'loading' ||
    nextPresentation?.kind === 'fundedPendingTotal';
  if (currentHasConfirmedCache && nextStillAwaitsConfirmedTotal) {
    if (nextPresentation?.refresh === 'failed') {
      return advanceShell(current, {
        kind: 'portfolio',
        presentation: {
          ...currentPresentation,
          refresh: 'failed',
        },
      });
    }
    // A live request may start before the V2 display snapshot is hydrated.
    // Pending evidence must not erase an exact cached total while that request
    // continues to own its balance round and can still replace the snapshot.
    return current;
  }
  if (currentHasConfirmedCache && nextPresentation?.kind === 'unavailable') {
    return advanceShell(current, {
      kind: 'portfolio',
      presentation: {
        ...currentPresentation,
        refresh: 'failed',
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
  const displayChanged = !equal(current.value, value);
  const applicabilityChanged = !equal(
    navigationApplicabilitySignature(current.value),
    navigationApplicabilitySignature(value),
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
  const displayChanged = !equal(current.value, value);
  const commandsChanged = !equal(
    sectionCommandSignature(current.value),
    sectionCommandSignature(value),
  );
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

function resetOwnerScopedMutations(
  event: Extract<IHomeStoreEvent, { type: 'ownerChanged' }>,
): IHomeStoreMutation[] {
  const initial = createInitialHomeStoreState();
  const mutations: IHomeStoreMutation[] = [
    {
      slice: 'session',
      operation: {
        kind: 'set',
        value: {
          owner: event.owner,
          ownerToken: event.ownerToken,
          status: event.ownerToken ? 'waitingForProducer' : 'idle',
        },
      },
    },
    {
      slice: 'runtime',
      operation: {
        kind: 'set',
        value: { ...initial.runtime, topology: event.topology },
      },
    },
    { slice: 'walletInputs', operation: { kind: 'reset' } },
    { slice: 'environmentInputs', operation: { kind: 'reset' } },
    { slice: 'capabilityInputs', operation: { kind: 'reset' } },
    { slice: 'facts', operation: { kind: 'reset' } },
    { slice: 'balanceRound', operation: { kind: 'reset' } },
    { slice: 'confirmedBalance', operation: { kind: 'reset' } },
    { slice: 'interaction', operation: { kind: 'reset' } },
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
    return intent.actionId === HOME_SHELL_ACTION_IDS.balance ||
      intent.actionId.startsWith('home.banner.')
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
    case 'ownerChanged': {
      if (
        equal(state.session.owner, event.owner) &&
        equal(state.session.ownerToken, event.ownerToken) &&
        state.runtime.topology === event.topology
      ) {
        return emptyTransition();
      }
      return acceptedTransition(
        state,
        resetOwnerScopedMutations(event),
        [],
        createInitialHomeStoreState().diagnostics,
      );
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
      return acceptedTransition(state, mutations);
    }
    case 'runtimeChanged': {
      if (equal(state.runtime, event.runtime)) {
        return emptyTransition();
      }
      let status: IHomeStoreState['session']['status'] = 'waitingForProducer';
      if (event.runtime.connection === 'ready') {
        status = 'ready';
      } else if (event.runtime.connection === 'degraded') {
        status = 'degraded';
      } else if (event.runtime.connection === 'stopped') {
        status = 'stopped';
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
              status,
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
      const exact = exactConfirmedBalance(state, balance);
      const decision = projectHomeBalanceAuthority({
        aggregation,
        bannerAvailable: balance.bannerAvailable,
        confirmed: exact,
        confirmedAt: event.observedAt,
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
      let resource = serializeSectionForResource(
        value,
        event.result.kind === 'ready' ? event.result.data : undefined,
      );
      const currentResource = state.resources[event.sectionId];
      if (
        !resource &&
        (event.result.kind === 'loading' || event.result.kind === 'error') &&
        (currentResource.kind === 'ready' || currentResource.kind === 'empty')
      ) {
        resource = {
          ...currentResource,
          refresh: event.result.kind === 'loading' ? 'refreshing' : 'failed',
        };
      }
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
        // V2 can hydrate a visible source before its lazy producer has loaded
        // stable business inputs. Keep that display-only value through the
        // producer's setup reset; the first exact request will retain it, while
        // a mismatched request still replaces it with loading.
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
        (current.kind === 'ready' || current.kind === 'empty') &&
        (current.freshness !== 'confirmedCache' ||
          current.confirmedCacheSourceKeyIdentity ===
            getHomeSourceKeyIdentity(event.token.sourceKey));
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
      if (
        event.selectedTabPreference &&
        state.interaction.preferredTabId !== event.selectedTabPreference
      ) {
        mutations.push({
          slice: 'interaction',
          operation: {
            kind: 'set',
            value: {
              ...state.interaction,
              preferredTabId: event.selectedTabPreference,
            },
          },
        });
      }
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
          resolvePreferredTab(
            event.navigation,
            event.selectedTabPreference ?? state.interaction.preferredTabId,
          ),
        );
        if (navigation !== state.navigation) {
          mutations.push({
            slice: 'navigation',
            operation: { kind: 'set', value: navigation },
          });
        }
      }
      if (
        event.selectedTabPreference &&
        state.interaction.preferredTabId !== event.selectedTabPreference
      ) {
        mutations.push({
          slice: 'interaction',
          operation: {
            kind: 'set',
            value: {
              ...state.interaction,
              preferredTabId: event.selectedTabPreference,
            },
          },
        });
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
        return acceptedTransition(state, [
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
        ]);
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
        return acceptedTransition(state, [
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
        ]);
      }
      if (
        (intent.type === 'sectionActionInvoked' ||
          intent.type === 'sectionRefreshRequested') &&
        intent.execution === 'controller'
      ) {
        const alreadyPending = state.interaction.pendingSectionCommands.some(
          (command) =>
            command.type === intent.type &&
            command.sectionId === intent.sectionId &&
            command.actionId === intent.actionId &&
            command.itemId === intent.itemId,
        );
        const pendingSectionCommands = alreadyPending
          ? state.interaction.pendingSectionCommands
          : [
              ...state.interaction.pendingSectionCommands,
              intent as IHomeStorePendingSectionCommand,
            ].slice(-MAX_PENDING_SECTION_COMMANDS);
        return acceptedTransition(state, [
          {
            slice: 'interaction',
            operation: {
              kind: 'set',
              value: {
                ...state.interaction,
                acceptedIntentIds,
                pendingSectionCommands,
              },
            },
          },
        ]);
      }
      if (
        intent.type === 'headerActionInvoked' &&
        intent.execution === 'controller'
      ) {
        const alreadyPending = state.interaction.pendingShellCommands.some(
          (command) =>
            command.actionId === intent.actionId &&
            command.itemId === intent.itemId,
        );
        const pendingShellCommands = alreadyPending
          ? state.interaction.pendingShellCommands
          : [
              ...state.interaction.pendingShellCommands,
              intent as IHomeStorePendingShellCommand,
            ].slice(-MAX_PENDING_SHELL_COMMANDS);
        const dismissedBannerIds =
          intent.actionId === HOME_BANNER_ACTION_IDS.dismiss && intent.itemId
            ? [
                ...state.interaction.dismissedBannerIds.filter(
                  (itemId) => itemId !== intent.itemId,
                ),
                intent.itemId,
              ].slice(-MAX_PENDING_SHELL_COMMANDS)
            : state.interaction.dismissedBannerIds;
        return acceptedTransition(state, [
          {
            slice: 'interaction',
            operation: {
              kind: 'set',
              value: {
                ...state.interaction,
                acceptedIntentIds,
                dismissedBannerIds,
                pendingShellCommands,
              },
            },
          },
        ]);
      }
      return acceptedTransition(
        state,
        [
          {
            slice: 'interaction',
            operation: {
              kind: 'set',
              value: { ...state.interaction, acceptedIntentIds },
            },
          },
        ],
        [{ kind: 'executeCommand', intent }],
      );
    }
    case 'commandHandled': {
      if (state.session.ownerToken?.scopeKey !== event.ownerToken.scopeKey) {
        return rejectedTransition(state, 'ownerMismatch', event.intentId);
      }
      if (state.session.ownerToken.sessionId !== event.ownerToken.sessionId) {
        return rejectedTransition(state, 'sessionMismatch', event.intentId);
      }
      const hasSectionCommand = state.interaction.pendingSectionCommands.some(
        (command) => command.intentId === event.intentId,
      );
      const hasShellCommand = state.interaction.pendingShellCommands.some(
        (command) => command.intentId === event.intentId,
      );
      if (!hasSectionCommand && !hasShellCommand) {
        return emptyTransition();
      }
      return acceptedTransition(state, [
        {
          slice: 'interaction',
          operation: {
            kind: 'set',
            value: {
              ...state.interaction,
              pendingSectionCommands:
                state.interaction.pendingSectionCommands.filter(
                  (command) => command.intentId !== event.intentId,
                ),
              pendingShellCommands:
                state.interaction.pendingShellCommands.filter(
                  (command) => command.intentId !== event.intentId,
                ),
            },
          },
        },
      ]);
    }
    case 'visibilityChanged': {
      if (state.interaction.visibility === event.visibility) {
        return emptyTransition();
      }
      return acceptedTransition(state, [
        {
          slice: 'interaction',
          operation: {
            kind: 'set',
            value: { ...state.interaction, visibility: event.visibility },
          },
        },
      ]);
    }
    case 'stopped': {
      if (state.session.status === 'stopped') {
        return emptyTransition();
      }
      return acceptedTransition(state, [
        {
          slice: 'session',
          operation: {
            kind: 'set',
            value: { ...state.session, status: 'stopped' },
          },
        },
        {
          slice: 'runtime',
          operation: {
            kind: 'set',
            value: { ...state.runtime, connection: 'stopped' },
          },
        },
      ]);
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
