import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import {
  HOME_RUNTIME_PROTOCOL_VERSION,
  type IHomeRuntimeJsonValue,
  type IHomeRuntimeRequestToken,
  type IRuntimeRequestPriority,
} from '@onekeyhq/shared/src/types/homeRuntime';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { mapSnapshotToPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
import { getTokenSubtitle } from '@onekeyhq/shared/src/utils/perpsUtils';
import {
  buildTokenSelectorDappTokenFilterParams,
  isTokenSelectorDappTokenFilterSupportedNetwork,
} from '@onekeyhq/shared/src/utils/tokenSelectorFilterUtils';
import { sumTokenGroupsFiatValueIgnoringUnavailable } from '@onekeyhq/shared/src/utils/tokenValueUtils';
import type { ICurrencyItem } from '@onekeyhq/shared/types';
import type {
  IDeFiProtocol,
  IDeFiSupportedProtocolAction,
  IProtocolSummary,
} from '@onekeyhq/shared/types/defi';
import type { IFetchAccountTokensResp } from '@onekeyhq/shared/types/token';

import {
  DEFAULT_MARKET_CATEGORY_ID,
  FAVORITES_CATEGORY_ID,
  HOME_MARKET_CATEGORY_REQUEST_LIMIT,
  HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
} from '../../components/PopularTrading/constants';
import {
  getTokenKey,
  mapMarketPerpsTokenToDisplay,
  mapMarketTokenToDisplay,
} from '../../components/PopularTrading/utils';
import {
  buildHomeWalletTabSupport,
  buildHomeWalletTabSupportScopeKey,
  resolveHomeWalletTabSupportAccountScopeId,
} from '../../hooks/homeWalletTabSupportUtils';
import {
  type INativeHomeAllNetworkTokenResponse,
  buildNativeHomeAllNetworkPortfolioProjection,
} from '../../nativeHomeAllNetworkPortfolioProjection';
import { adaptCurrentHomeCapabilityFacts } from '../capabilities/currentHomeCapabilityFactsAdapter';
import {
  type IHomeResultAuthority,
  type IHomeResultPhase,
  type IHomeResultSink,
  createHomeResultSink,
} from '../results/homeResultSink';
import {
  HOME_PERPS_REFERRAL_BANNER_ID,
  type IHomeBannerStorePayload,
  buildHomeBannerSemanticFingerprint,
  readHomeBannerStorePayload,
  toHomeBannerStoreItem,
} from '../sections/banner/homeBannerStoreModel';
import { getHomeDeFiProtocolRowIds } from '../sections/defi/homeDeFiSourceAdapter';
import { getHomeHistoryRowIds } from '../sections/history/homeHistorySourceAdapter';
import { getHomeMarketRowIds } from '../sections/market/homeMarketSourceAdapter';
import { getHomeNFTItemRowId } from '../sections/nft/homeNFTSourceAdapter';
import { HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID } from '../sections/spot/homePortfolioControls';
import { mergeHomePortfolioProgressivePayload } from '../sections/spot/homePortfolioProgressiveMerge';
import {
  type IHomeSpotLegacyPayload,
  createHomeSpotSnapshotDefaults,
} from '../sections/spot/homeSpotSourceAdapter';
import {
  normalizeHomeStoreJson,
  readHomeStoreSectionPayload,
} from '../store/homeStoreJson';

import { AllNetworkAccountRepository } from './AllNetworkAccountRepository';
import {
  buildHomeSourceExecutionKey,
  normalizeHomePortfolioLpCacheControl,
} from './homeSourceExecutionKey';

import type { IHomePopularTradingPayload } from '../../components/PopularTrading/types';
import type { IHomeCapabilityFacts } from '../capabilities/homeCapabilityTypes';
import type {
  IHomeBalanceContributorFact,
  IHomeBalanceContributorId,
  IHomeFactResource,
} from '../facts/homeFacts';
import type { HomeStoreCommitBudget } from '../results/homeStoreCommitBudget';
import type { HomeLeafRequestPool } from '../scheduler/homeLeafRequestPool';
import type {
  HomeRequestScheduler,
  IHomeRequestOutcome,
} from '../scheduler/homeRequestScheduler';
import type { IHomeDeFiLegacyPayload } from '../sections/defi/homeDeFiSourceAdapter';
import type { IHomePerpsLegacyPayload } from '../sections/perps/homePerpsSourceAdapter';
import type { IHomeSectionId } from '../semantic/homeSemanticTypes';
import type {
  IHomeStoreEvent,
  IHomeStoreIntent,
  IHomeStoreSourceId,
  IHomeStoreState,
} from '../store/homeStoreTypes';
import type { IHomeTokenListDemand } from '../tokenList/homeTokenListRuntime';

export interface IHomeSourceEnvironment {
  activeAccount: IAccountSelectorActiveAccountInfo;
  bannerLabels: {
    referralDescription: string;
    referralTitle: string;
  };
  currencyMap: Record<string, ICurrencyItem>;
  settings: Pick<
    ISettingsPersistAtom,
    | 'currencyInfo'
    | 'isFilterLowValueHistoryEnabled'
    | 'isFilterScamHistoryEnabled'
    | 'locale'
  >;
}

interface IHomeSourceRuntimeHost {
  identity: {
    runtimeInstanceId: string;
    clientInstanceId: string;
  };
  scheduler: HomeRequestScheduler;
  commitBudget: HomeStoreCommitBudget;
  leafPool: HomeLeafRequestPool;
  dispatch(event: IHomeStoreEvent): unknown;
  dispatchAtomically(events: readonly IHomeStoreEvent[]): unknown;
  getStateView(): IHomeStoreState;
}

type ISectionWireResult = {
  [key: string]: IHomeRuntimeJsonValue;
  empty: boolean;
  error: boolean;
  payload: IHomeRuntimeJsonValue | null;
  rowIds: IHomeRuntimeJsonValue[];
};

type ISourceCacheEntry = {
  coverageFingerprint: string;
  dataRevision: number;
  expiresAt: number;
  phase: IHomeResultPhase;
  payload: IHomeRuntimeJsonValue;
  rowIds: readonly string[];
};

const SOURCE_CACHE_TTL_MS = 30_000;
const SOURCE_CACHE_MAX_IDENTITIES = 8;
const FIRST_FRAME_WARM_DELAY_MS = 800;

function createSourceRequestToken({
  authority,
  sourceId,
}: {
  authority: IHomeResultAuthority;
  sourceId: IHomeStoreSourceId;
}): IHomeRuntimeRequestToken {
  return {
    protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
    clientInstanceId: authority.clientInstanceId,
    producerInstanceId: authority.producerInstanceId,
    sessionId: authority.sessionId,
    requestSeq: authority.requestSequence,
    sourceKey: {
      scopeKey: authority.ownerScopeKey,
      sourceId,
      paramsFingerprint: authority.sourceKey,
      dataSchemaVersion: 1,
    },
  };
}

const HOME_PERPS_HOT_ROW_LIMIT = 6;
const POLLING_INTERVAL_MS = 60_000;
const SOURCE_TIMEOUT_MS = 90_000;

const SECTION_SOURCE_IDS = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
  'market',
] as const satisfies readonly IHomeSectionId[];

function encodeKeyPart(value: string | number | boolean | undefined): string {
  const normalized = value === undefined ? '' : String(value);
  return `${normalized.length}:${normalized}`;
}

function sumTokenValue(response: IFetchAccountTokensResp): string | undefined {
  const values = [
    response.tokens.fiatValue,
    response.smallBalanceTokens.fiatValue,
    response.riskTokens.fiatValue,
  ].filter((value): value is string => value !== undefined);
  if (values.length === 0) {
    return undefined;
  }
  const total = values.reduce(
    (result, value) => result.plus(new BigNumber(value)),
    new BigNumber(0),
  );
  return total.isFinite() ? total.toFixed() : undefined;
}

function buildSourceKey({
  environment,
  sourceId,
  state,
}: {
  environment: IHomeSourceEnvironment;
  sourceId: IHomeStoreSourceId;
  state: IHomeStoreState;
}): string {
  const { activeAccount, settings } = environment;
  let control: unknown;
  if (sourceId === 'market') {
    control =
      state.interaction.sectionControls.market?.[
        'home.market.selectedCategory'
      ];
  } else if (sourceId === 'portfolio') {
    control = normalizeHomePortfolioLpCacheControl(
      state.interaction.sectionControls.portfolio?.[
        HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID
      ],
    );
  }
  const capabilityPrerequisites =
    sourceId === 'capability'
      ? [state.walletInputs.accountType, toNetworkFamily(activeAccount.network)]
      : [];
  return [
    encodeKeyPart(state.session.ownerToken?.scopeKey),
    encodeKeyPart(sourceId),
    encodeKeyPart(activeAccount.account?.id),
    encodeKeyPart(activeAccount.indexedAccount?.id),
    encodeKeyPart(activeAccount.network?.id),
    encodeKeyPart(settings.currencyInfo.id),
    encodeKeyPart(settings.isFilterLowValueHistoryEnabled),
    encodeKeyPart(settings.isFilterScamHistoryEnabled),
    encodeKeyPart(
      typeof control === 'string' || typeof control === 'boolean'
        ? control
        : undefined,
    ),
    ...capabilityPrerequisites.map(encodeKeyPart),
  ].join('|');
}

function toNetworkFamily(
  network: IAccountSelectorActiveAccountInfo['network'],
): 'allNetworks' | 'btc' | 'evm' | 'sol' | 'ton' | 'tron' | 'unknown' {
  if (network?.isAllNetworks) {
    return 'allNetworks';
  }
  const impl = network?.impl;
  return impl === 'btc' ||
    impl === 'evm' ||
    impl === 'sol' ||
    impl === 'ton' ||
    impl === 'tron'
    ? impl
    : 'unknown';
}

function isSectionSource(
  sourceId: IHomeStoreSourceId,
): sourceId is IHomeSectionId {
  return SECTION_SOURCE_IDS.includes(sourceId as IHomeSectionId);
}

function sourceForSelectedTab(
  state: IHomeStoreState,
): IHomeSectionId | undefined {
  return state.navigation.value.kind === 'ready'
    ? state.navigation.value.selectedTabId
    : state.interaction.preferredTabId;
}

export class HomeSourceRuntime {
  private readonly allNetworkAccounts: AllNetworkAccountRepository;

  private readonly activeAuthority = new Map<
    IHomeStoreSourceId,
    IHomeResultAuthority
  >();

  private readonly sinks = new Map<
    IHomeStoreSourceId,
    IHomeResultSink<IHomeRuntimeJsonValue>
  >();

  private readonly requestSequence = new Map<IHomeStoreSourceId, number>();

  private readonly cache = new Map<
    IHomeStoreSourceId,
    Map<string, ISourceCacheEntry>
  >();

  private readonly lastLoadedKey = new Map<
    IHomeStoreSourceId,
    { executionKey: string; sessionId: string }
  >();

  private readonly inFlight = new Map<
    IHomeStoreSourceId,
    { executionKey: string; sessionId: string; taskId: string }
  >();

  private environment: IHomeSourceEnvironment | undefined;

  private warmTimer: ReturnType<typeof setTimeout> | undefined;

  private pollingTimer: ReturnType<typeof setTimeout> | undefined;

  private allNetworksMapCache:
    | {
        expiresAt: number;
        value: IHomeSpotLegacyPayload['networksMap'];
      }
    | undefined;

  private allNetworksMapPromise:
    | Promise<IHomeSpotLegacyPayload['networksMap']>
    | undefined;

  private warmGeneration = 0;

  private dataRevision = 0;

  private tokenListDemandKey = '';

  private disposed = false;

  constructor(private readonly host: IHomeSourceRuntimeHost) {
    this.allNetworkAccounts = new AllNetworkAccountRepository({
      clear: () =>
        backgroundApiProxy.serviceAllNetwork.clearGetAllNetworkAccountsCache(),
      fetch: (params) =>
        this.host.leafPool.run('critical', () =>
          backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts(params),
        ),
    });
  }

  updateEnvironment(environment: IHomeSourceEnvironment): void {
    const previous = this.environment;
    this.environment = environment;
    if (
      previous?.activeAccount.account?.id !==
        environment.activeAccount.account?.id ||
      previous?.activeAccount.indexedAccount?.id !==
        environment.activeAccount.indexedAccount?.id ||
      previous?.activeAccount.network?.id !==
        environment.activeAccount.network?.id ||
      previous?.activeAccount.network?.impl !==
        environment.activeAccount.network?.impl ||
      previous?.activeAccount.network?.isAllNetworks !==
        environment.activeAccount.network?.isAllNetworks ||
      previous?.activeAccount.wallet?.id !==
        environment.activeAccount.wallet?.id ||
      previous?.activeAccount.wallet?.type !==
        environment.activeAccount.wallet?.type ||
      previous?.activeAccount.ready !== environment.activeAccount.ready ||
      previous?.settings.currencyInfo.id !==
        environment.settings.currencyInfo.id ||
      previous?.settings.locale !== environment.settings.locale ||
      previous?.settings.isFilterLowValueHistoryEnabled !==
        environment.settings.isFilterLowValueHistoryEnabled ||
      previous?.settings.isFilterScamHistoryEnabled !==
        environment.settings.isFilterScamHistoryEnabled ||
      previous?.activeAccount.vaultSettings?.NFTEnabled !==
        environment.activeAccount.vaultSettings?.NFTEnabled ||
      previous?.bannerLabels.referralTitle !==
        environment.bannerLabels.referralTitle ||
      previous?.bannerLabels.referralDescription !==
        environment.bannerLabels.referralDescription
    ) {
      queueMicrotask(() => this.reconcile());
    }
  }

  reconcile(): void {
    if (this.disposed || !this.environment) {
      return;
    }
    const state = this.host.getStateView();
    const session = state.session;
    const ready =
      session.authority === 'ready' &&
      Boolean(session.ownerToken && session.producerInstanceId) &&
      this.environment.activeAccount.ready;
    if (!ready || session.surfaceVisibility !== 'visible') {
      this.stopTimers();
      return;
    }
    const balanceEvent = this.createBalanceEvent();
    if (balanceEvent) {
      this.host.dispatch(balanceEvent);
    }
    this.sinks.forEach((sink) => sink.flushBuffered());
    void this.runSource('capability', 'critical');
    void this.runSource('banner', 'critical');
    void this.runSource('portfolio', 'critical');
    const selected = sourceForSelectedTab(state);
    if (selected && selected !== 'portfolio') {
      void this.runSource(selected, 'interactive');
    }
    if (selected === 'perps') {
      void this.runSource('market', 'interactive');
    }
    this.scheduleWarm(selected);
    this.schedulePolling();
  }

  cancelSession(sessionId: string): void {
    this.host.scheduler.cancelSession(sessionId);
    this.activeAuthority.forEach((authority, sourceId) => {
      if (authority.sessionId === sessionId) {
        this.sinks.get(sourceId)?.dispose();
        this.sinks.delete(sourceId);
        this.activeAuthority.delete(sourceId);
      }
    });
    this.lastLoadedKey.forEach((value, sourceId) => {
      if (value.sessionId === sessionId) {
        this.lastLoadedKey.delete(sourceId);
      }
    });
    this.inFlight.forEach((value, sourceId) => {
      if (value.sessionId === sessionId) {
        this.inFlight.delete(sourceId);
      }
    });
    this.host.leafPool.cancelSession(sessionId);
    this.stopTimers();
  }

  async executeCommand(intent: IHomeStoreIntent): Promise<boolean> {
    if (
      intent.type === 'sectionRefreshRequested' ||
      (intent.type === 'sectionActionInvoked' &&
        (intent.actionId.endsWith('.refresh') ||
          intent.actionId.endsWith('.loadMore') ||
          intent.actionId.endsWith('.positionActionSucceeded')))
    ) {
      const sectionTask = this.runSource(intent.sectionId, 'interactive', true);
      const marketTask =
        intent.sectionId === 'perps'
          ? this.runSource('market', 'interactive', true)
          : undefined;
      await sectionTask;
      await marketTask;
      return true;
    }
    if (intent.type === 'sectionControlChanged') {
      await this.runSource(intent.sectionId, 'interactive', true);
      return true;
    }
    return false;
  }

  refreshSource(sourceId: IHomeStoreSourceId): void {
    void this.runSource(sourceId, 'interactive', true);
  }

  refreshVisibleSources(): void {
    const state = this.host.getStateView();
    void this.runSource('capability', 'critical', true);
    void this.runSource('banner', 'critical', true);
    void this.runSource('portfolio', 'critical', true);
    const selected = sourceForSelectedTab(state);
    if (selected && selected !== 'portfolio') {
      void this.runSource(selected, 'interactive', true);
    }
    if (selected === 'perps') {
      void this.runSource('market', 'interactive', true);
    }
  }

  updateTokenListDemands(demands: readonly IHomeTokenListDemand[]): void {
    const state = this.host.getStateView();
    const ownerScopeKey = state.session.ownerToken?.scopeKey;
    const matching = ownerScopeKey
      ? demands.filter(
          (demand) =>
            demand.reason !== 'homeVisible' &&
            (demand.ownerScopeKey === ownerScopeKey ||
              demand.ownerScopeKey === 'wallet-current'),
        )
      : [];
    const nextKey = matching
      .map(
        (demand) =>
          `${demand.consumerId.length}:${demand.consumerId}:${demand.reason}:${demand.priority}`,
      )
      .toSorted()
      .join('|');
    if (nextKey === this.tokenListDemandKey) {
      return;
    }
    this.tokenListDemandKey = nextKey;
    if (matching.length === 0 || state.session.authority !== 'ready') {
      return;
    }
    let priority: IRuntimeRequestPriority = 'background';
    if (matching.some((demand) => demand.priority === 'interactive')) {
      priority = 'interactive';
    } else if (matching.some((demand) => demand.priority === 'critical')) {
      priority = 'critical';
    }
    void this.runSource('portfolio', priority, true);
  }

  invalidateAllNetworkAccounts(walletId?: string): void {
    if (walletId) {
      this.allNetworkAccounts.invalidateWallet(walletId);
    } else {
      this.allNetworkAccounts.invalidate();
    }
    this.allNetworksMapCache = undefined;
    this.lastLoadedKey.clear();
    this.reconcile();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.stopTimers();
    this.sinks.forEach((sink) => sink.dispose());
    this.sinks.clear();
    this.activeAuthority.clear();
    this.cache.clear();
    this.inFlight.clear();
    this.allNetworksMapCache = undefined;
    this.allNetworksMapPromise = undefined;
    this.allNetworkAccounts.dispose();
  }

  private async runSource(
    sourceId: IHomeStoreSourceId,
    priority: IRuntimeRequestPriority,
    force = false,
  ): Promise<IHomeRequestOutcome<void>> {
    const environment = this.environment;
    const state = this.host.getStateView();
    const ownerToken = state.session.ownerToken;
    const producerInstanceId = state.session.producerInstanceId;
    if (
      this.disposed ||
      !environment ||
      !ownerToken ||
      !producerInstanceId ||
      state.session.authority !== 'ready'
    ) {
      return { kind: 'ignored' };
    }
    if (
      sourceId === 'capability' &&
      (state.walletInputs.accountType === 'unknown' ||
        toNetworkFamily(environment.activeAccount.network) === 'unknown')
    ) {
      return { kind: 'ignored' };
    }
    const sourceKey = buildSourceKey({ environment, sourceId, state });
    const executionKey = buildHomeSourceExecutionKey({
      sessionId: ownerToken.sessionId,
      sourceKey,
    });
    if (
      !force &&
      this.lastLoadedKey.get(sourceId)?.executionKey === executionKey
    ) {
      return { kind: 'ignored' };
    }
    if (this.inFlight.get(sourceId)?.executionKey === executionKey) {
      return { kind: 'ignored' };
    }
    const requestSequence = (this.requestSequence.get(sourceId) ?? 0) + 1;
    this.requestSequence.set(sourceId, requestSequence);
    const taskId = [
      'home-source',
      sourceId,
      ownerToken.sessionId,
      requestSequence,
    ].join(':');
    const authority: IHomeResultAuthority = {
      ownerScopeKey: ownerToken.scopeKey,
      runtimeInstanceId: this.host.identity.runtimeInstanceId,
      appEpoch: state.session.appEpoch,
      clientInstanceId: this.host.identity.clientInstanceId,
      sessionId: ownerToken.sessionId,
      producerInstanceId,
      sourceId,
      sourceKey,
      requestSequence,
      sourceRevision: 1,
      requestGroupId: `${ownerToken.sessionId}:${sourceId}`,
      taskId,
    };
    this.activeAuthority.set(sourceId, authority);
    this.sinks.get(sourceId)?.dispose();
    const sink = this.createSink(sourceId, authority, priority);
    this.sinks.set(sourceId, sink);
    this.hydrateCache(sourceId, sourceKey, authority, sink);
    this.scheduleSourceStart(sourceId, authority, priority);

    this.inFlight.set(sourceId, {
      executionKey,
      sessionId: ownerToken.sessionId,
      taskId,
    });
    const outcome = await this.host.scheduler.schedule({
      taskId,
      key: sourceKey,
      groupKey: ownerToken.sessionId,
      clientInstanceId: this.host.identity.clientInstanceId,
      appEpoch: state.session.appEpoch,
      sessionId: ownerToken.sessionId,
      requestGroupId: authority.requestGroupId,
      priority,
      policy: force ? 'takeLatest' : 'exhaust',
      timeoutMs: SOURCE_TIMEOUT_MS,
      run: async ({ signal, yieldIfMainBudgetExceeded }) => {
        if (signal.aborted) {
          return;
        }
        await this.loadAndPublish({
          authority,
          environment,
          force,
          priority,
          sessionId: authority.sessionId,
          sink,
          sourceId,
          sourceKey,
          yieldIfMainBudgetExceeded: () => yieldIfMainBudgetExceeded(),
        });
        if (
          this.activeAuthority.get(sourceId) === authority &&
          !signal.aborted
        ) {
          this.lastLoadedKey.set(sourceId, {
            executionKey,
            sessionId: ownerToken.sessionId,
          });
        }
      },
    });
    if (this.inFlight.get(sourceId)?.taskId === taskId) {
      this.inFlight.delete(sourceId);
    }
    return outcome;
  }

  private scheduleSourceStart(
    sourceId: IHomeStoreSourceId,
    authority: IHomeResultAuthority,
    priority: IRuntimeRequestPriority,
  ): void {
    if (sourceId !== 'banner' && !isSectionSource(sourceId)) {
      return;
    }
    if (this.host.getStateView().session.surfaceVisibility !== 'visible') {
      return;
    }
    this.host.commitBudget.submit({
      authority,
      materialized: {
        model: null,
        dataRevision: `${authority.requestSequence}:start`,
      },
      phase: 'leading',
      priority,
      publicationId: `${authority.taskId}:start`,
      publicationRevision: 0,
      commit: () => {
        const state = this.host.getStateView();
        if (
          this.activeAuthority.get(sourceId) !== authority ||
          state.session.ownerToken?.sessionId !== authority.sessionId
        ) {
          return;
        }
        this.host.dispatch({
          type: 'sourceRequested',
          token: createSourceRequestToken({ authority, sourceId }),
        });
      },
    });
  }

  private createSink(
    sourceId: IHomeStoreSourceId,
    authority: IHomeResultAuthority,
    priority: IRuntimeRequestPriority,
  ): IHomeResultSink<IHomeRuntimeJsonValue> {
    let materializedSequence = 0;
    return createHomeResultSink({
      authority,
      priority,
      commitBudget: this.host.commitBudget,
      getCurrentAuthority: () => {
        const state = this.host.getStateView();
        return this.activeAuthority.get(sourceId) === authority &&
          state.session.ownerToken?.scopeKey === authority.ownerScopeKey &&
          state.session.ownerToken.sessionId === authority.sessionId &&
          state.session.appEpoch === authority.appEpoch &&
          state.session.producerInstanceId === authority.producerInstanceId
          ? {
              ...authority,
              surfaceVisibility: state.session.surfaceVisibility,
            }
          : undefined;
      },
      materialize: (wireValue) => {
        materializedSequence += 1;
        return {
          model: wireValue,
          dataRevision: `${authority.requestSequence}:${materializedSequence}`,
        };
      },
      commit: ({ materialized, phase }) => {
        this.commitWireResult({
          authority,
          phase,
          sourceId,
          wire: materialized.model,
        });
      },
    });
  }

  private async loadAndPublish({
    authority,
    environment,
    force,
    priority,
    sessionId,
    sink,
    sourceId,
    sourceKey,
    yieldIfMainBudgetExceeded,
  }: {
    authority: IHomeResultAuthority;
    environment: IHomeSourceEnvironment;
    force: boolean;
    priority: IRuntimeRequestPriority;
    sessionId: string;
    sink: IHomeResultSink<IHomeRuntimeJsonValue>;
    sourceId: IHomeStoreSourceId;
    sourceKey: string;
    yieldIfMainBudgetExceeded: () => Promise<void>;
  }): Promise<void> {
    try {
      if (sourceId === 'capability') {
        const facts = await this.loadCapability(environment, sessionId);
        const wire = this.publishModel(sink, facts, 'final');
        this.rememberCache(sourceId, sourceKey, {
          coverageFingerprint: `capability:${sourceKey}`,
          dataRevision: this.dataRevision,
          expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
          phase: 'final',
          payload: wire,
          rowIds: [],
        });
        return;
      }
      if (sourceId === 'banner') {
        const payload = await this.loadBanner(
          environment,
          priority,
          sessionId,
          (intermediate) => {
            this.publishModel(sink, intermediate, 'intermediate');
          },
        );
        const wire = this.publishModel(sink, payload, 'final');
        this.rememberCache(sourceId, sourceKey, {
          coverageFingerprint: buildHomeBannerSemanticFingerprint(payload),
          dataRevision: this.dataRevision,
          expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
          phase: 'final',
          payload: wire,
          rowIds: [],
        });
        return;
      }
      const publishIntermediate = (input: {
        payload: unknown;
        rowIds: readonly string[];
      }) => {
        const wire = this.createSectionWire(input.payload, input.rowIds);
        if (wire) {
          this.dataRevision += 1;
          sink.publish({
            phase: 'intermediate',
            revision: this.dataRevision,
            wireValue: wire,
          });
          if (input.rowIds.length > 0) {
            this.rememberCache(sourceId, sourceKey, {
              coverageFingerprint: [
                input.rowIds.length,
                input.rowIds[0] ?? '',
                input.rowIds[input.rowIds.length - 1] ?? '',
              ].join(':'),
              dataRevision: this.dataRevision,
              expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
              phase: 'intermediate',
              payload: wire,
              rowIds: input.rowIds,
            });
          }
        }
      };
      const section = await this.loadSection({
        environment,
        force,
        priority,
        publishIntermediate,
        sessionId,
        sourceId,
        yieldIfMainBudgetExceeded,
      });
      const wire = this.createSectionWire(section.payload, section.rowIds);
      if (!wire) {
        throw new OneKeyLocalError(
          `Home ${sourceId} result is not serializable`,
        );
      }
      this.dataRevision += 1;
      sink.publish({
        phase: 'final',
        revision: this.dataRevision,
        wireValue: wire,
      });
      this.rememberCache(sourceId, sourceKey, {
        coverageFingerprint: [
          section.rowIds.length,
          section.rowIds[0] ?? '',
          section.rowIds[section.rowIds.length - 1] ?? '',
        ].join(':'),
        dataRevision: this.dataRevision,
        expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
        phase: 'final',
        payload: wire,
        rowIds: section.rowIds,
      });
    } catch {
      if (sourceId === 'banner') {
        this.commitBannerFailure(authority);
      } else if (isSectionSource(sourceId)) {
        this.dataRevision += 1;
        sink.publish({
          phase: 'final',
          revision: this.dataRevision,
          wireValue: {
            empty: true,
            error: true,
            payload: null,
            rowIds: [],
          },
        });
      }
    }
  }

  private commitBannerFailure(authority: IHomeResultAuthority): void {
    const token = createSourceRequestToken({
      authority,
      sourceId: 'banner',
    });
    this.host.dispatchAtomically([
      { type: 'sourceRequested', token },
      {
        type: 'sourceResponded',
        envelope: {
          token,
          result: { kind: 'error', errorKind: 'source' },
        },
      },
    ]);
  }

  private publishModel(
    sink: IHomeResultSink<IHomeRuntimeJsonValue>,
    model: unknown,
    phase: 'intermediate' | 'final',
  ): IHomeRuntimeJsonValue {
    const wire = normalizeHomeStoreJson(model);
    if (wire === undefined) {
      throw new OneKeyLocalError('Home source model is not serializable');
    }
    this.dataRevision += 1;
    sink.publish({
      phase,
      revision: this.dataRevision,
      wireValue: wire,
    });
    return wire;
  }

  private createSectionWire(
    payload: unknown,
    rowIds: readonly string[],
  ): ISectionWireResult | undefined {
    const data = normalizeHomeStoreJson(payload);
    if (data === undefined) {
      return undefined;
    }
    return {
      empty: rowIds.length === 0,
      error: false,
      payload: data,
      rowIds: [...rowIds],
    };
  }

  private commitWireResult({
    authority,
    phase,
    sourceId,
    wire,
  }: {
    authority: IHomeResultAuthority;
    phase: IHomeResultPhase;
    sourceId: IHomeStoreSourceId;
    wire: IHomeRuntimeJsonValue;
  }): void {
    const state = this.host.getStateView();
    const ownerToken = state.session.ownerToken;
    if (!ownerToken) {
      return;
    }
    if (sourceId === 'capability') {
      this.host.dispatch({
        type: 'capabilityChanged',
        facts: wire as unknown as IHomeCapabilityFacts,
      });
      this.reconcile();
      return;
    }
    if (sourceId === 'banner') {
      const bannerPayload = readHomeBannerStorePayload(wire);
      if (!bannerPayload) {
        return;
      }
      const coverageFingerprint =
        buildHomeBannerSemanticFingerprint(bannerPayload);
      const currentBanner = state.resources.banner;
      if (
        currentBanner.kind === 'ready' &&
        currentBanner.freshness === 'live' &&
        currentBanner.refresh === 'idle' &&
        currentBanner.coverageFingerprint === coverageFingerprint
      ) {
        return;
      }
      const token = createSourceRequestToken({
        authority,
        sourceId: 'banner',
      });
      const requestEvent: IHomeStoreEvent = {
        type: 'sourceRequested',
        token,
      };
      const bannerEvent: IHomeStoreEvent = {
        type: 'sourceResponded',
        envelope: {
          token,
          result: {
            kind: 'success',
            data: bannerPayload,
            coverageFingerprint,
          },
        },
      };
      const balanceEvent = this.createBalanceEvent({
        sourceId: 'banner',
        payload: bannerPayload,
        rowIds: [],
        empty: false,
      });
      this.host.dispatchAtomically(
        balanceEvent
          ? [requestEvent, bannerEvent, balanceEvent]
          : [requestEvent, bannerEvent],
      );
      return;
    }
    if (!isSectionSource(sourceId)) {
      return;
    }
    let sectionWire = wire as ISectionWireResult;
    const currentResource = state.resources[sourceId];
    if (
      phase === 'intermediate' &&
      sectionWire.empty &&
      (currentResource.kind === 'ready' || currentResource.kind === 'empty')
    ) {
      return;
    }
    let intermediateFreshness: 'confirmedCache' | 'live' = 'live';
    if (phase === 'intermediate' && currentResource.kind === 'ready') {
      intermediateFreshness = currentResource.freshness;
      if (sourceId === 'portfolio' && sectionWire.payload) {
        const basePayload = readHomeStoreSectionPayload<IHomeSpotLegacyPayload>(
          currentResource.data,
        );
        if (basePayload) {
          const mergedPayload = mergeHomePortfolioProgressivePayload({
            base: basePayload,
            incoming: sectionWire.payload as unknown as IHomeSpotLegacyPayload,
          });
          const normalizedPayload = normalizeHomeStoreJson(mergedPayload);
          if (normalizedPayload) {
            sectionWire = {
              ...sectionWire,
              payload: normalizedPayload,
              rowIds: [...mergedPayload.displayIds],
            };
          }
        }
      }
    }
    let sectionResult: Extract<
      IHomeStoreEvent,
      { type: 'sectionSourceChanged' }
    >['result'];
    if (sectionWire.error) {
      sectionResult = { kind: 'error' };
    } else if (phase === 'intermediate' && sectionWire.empty) {
      sectionResult = { kind: 'loading' };
    } else if (sectionWire.empty) {
      sectionResult = { kind: 'empty' };
    } else {
      sectionResult = {
        kind: 'ready',
        rowIds: sectionWire.rowIds as string[],
        data: sectionWire.payload ?? undefined,
        freshness: phase === 'intermediate' ? intermediateFreshness : 'live',
        refresh: phase === 'final' ? 'idle' : 'refreshing',
      };
    }
    const sectionEvent: IHomeStoreEvent = {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: sourceId,
      token: createSourceRequestToken({ authority, sourceId }),
      result: sectionResult,
    };
    const balanceEvent =
      sourceId === 'portfolio' || sourceId === 'defi' || sourceId === 'perps'
        ? this.createBalanceEvent({
            sourceId,
            payload: sectionWire.payload,
            rowIds: sectionWire.rowIds as string[],
            empty: sectionWire.empty,
            freshness:
              phase === 'intermediate' ? intermediateFreshness : 'live',
            phase,
          })
        : undefined;
    this.host.dispatchAtomically(
      balanceEvent ? [sectionEvent, balanceEvent] : [sectionEvent],
    );
  }

  private createBalanceEvent(override?: {
    sourceId: 'banner' | 'portfolio' | 'defi' | 'perps';
    payload: IHomeRuntimeJsonValue;
    rowIds: readonly string[];
    empty: boolean;
    freshness?: 'confirmedCache' | 'live';
    phase?: IHomeResultPhase;
  }): IHomeStoreEvent | undefined {
    const state = this.host.getStateView();
    const facts = state.facts;
    const ownerToken = state.session.ownerToken;
    if (!facts || !ownerToken || !this.environment) {
      return undefined;
    }
    const getPayload = <TPayload>(
      sourceId: 'portfolio' | 'defi' | 'perps',
    ): TPayload | undefined => {
      if (override?.sourceId === sourceId) {
        return override.payload as TPayload;
      }
      const resource = state.resources[sourceId];
      return resource.kind === 'ready' || resource.kind === 'partial'
        ? readHomeStoreSectionPayload<TPayload>(resource.data)
        : undefined;
    };
    const portfolio = getPayload<IHomeSpotLegacyPayload>('portfolio');
    const defi = getPayload<IHomeDeFiLegacyPayload>('defi');
    const perps = getPayload<IHomePerpsLegacyPayload>('perps');
    const quoteBasis = {
      currency: USD_CURRENCY_ID,
      pricingRevision: [
        'home-balance-v3',
        this.environment.settings.currencyInfo.id,
      ].join(':'),
    };
    const requiredSetRevision = 'home-balance-required:portfolio:v3';
    const makeContributor = ({
      amount,
      amountComplete = true,
      id,
      positiveEvidence,
    }: {
      amount: BigNumber.Value | undefined;
      amountComplete?: boolean;
      id: IHomeBalanceContributorId;
      positiveEvidence: boolean;
    }): IHomeBalanceContributorFact => {
      let resource = state.resources[id];
      if (override?.sourceId === id) {
        if (override.empty && override.phase !== 'intermediate') {
          resource = {
            kind: 'empty',
            coverageFingerprint: 'empty:v2',
            freshness: override.freshness ?? 'live',
            refresh: 'idle',
          };
        } else {
          resource = {
            kind: 'ready',
            data: {
              payload: override.payload,
              section: {
                kind: 'ready',
                rowIds: override.rowIds,
                freshness: override.freshness ?? 'live',
                refresh:
                  override.phase === 'intermediate' ? 'refreshing' : 'idle',
              },
            },
            coverageFingerprint: [
              override.rowIds.length,
              override.rowIds[0] ?? '',
              override.rowIds[override.rowIds.length - 1] ?? '',
            ].join(':'),
            freshness: override.freshness ?? 'live',
            refresh: 'idle',
          };
        }
      }
      let factResource: IHomeFactResource<{
        amount: string;
        positiveEvidence: boolean;
      }>;
      const normalizedAmount =
        amount === undefined ? undefined : new BigNumber(amount);
      const hasUsableAmount = Boolean(normalizedAmount?.isFinite());
      const data = {
        amount: hasUsableAmount ? (normalizedAmount?.toFixed() ?? '0') : '0',
        positiveEvidence,
      };
      const coverageFingerprint =
        'coverageFingerprint' in resource
          ? resource.coverageFingerprint
          : `${id}:intermediate`;
      if (resource.kind === 'error') {
        factResource = {
          kind: 'error',
          errorKind: resource.errorKind,
        };
      } else if (
        override?.sourceId === id &&
        override.phase === 'intermediate'
      ) {
        factResource =
          hasUsableAmount || positiveEvidence
            ? {
                kind: 'partial',
                data,
                coverageFingerprint,
              }
            : { kind: 'loading' };
      } else if (
        (resource.kind === 'ready' || resource.kind === 'empty') &&
        resource.freshness === 'confirmedCache'
      ) {
        factResource =
          hasUsableAmount || positiveEvidence
            ? {
                kind: 'partial',
                data,
                coverageFingerprint: resource.coverageFingerprint,
              }
            : { kind: 'loading' };
      } else if (!amountComplete) {
        factResource =
          hasUsableAmount || positiveEvidence
            ? {
                kind: 'partial',
                data,
                coverageFingerprint,
              }
            : { kind: 'loading' };
      } else if (resource.kind === 'ready' || resource.kind === 'empty') {
        if (!hasUsableAmount) {
          factResource = positiveEvidence
            ? {
                kind: 'partial',
                data,
                coverageFingerprint: resource.coverageFingerprint,
              }
            : { kind: 'loading' };
        } else {
          factResource = {
            kind: 'complete',
            result:
              normalizedAmount?.isZero() && !positiveEvidence
                ? { kind: 'empty' }
                : { kind: 'success', data },
            coverageFingerprint: resource.coverageFingerprint,
          };
        }
      } else if (resource.kind === 'partial') {
        factResource = {
          kind: 'partial',
          data,
          coverageFingerprint: resource.coverageFingerprint,
        };
      } else {
        factResource = { kind: 'loading' };
      }
      const sourceKeyIdentity = [
        ownerToken.scopeKey,
        id,
        resource.kind === 'idle'
          ? 'idle'
          : (('token' in resource
              ? resource.token?.sourceKey.paramsFingerprint
              : undefined) ?? resource.kind),
        quoteBasis.pricingRevision,
      ].join('|');
      return {
        id,
        ownerToken,
        requiredSetRevision,
        sourceKeyIdentity,
        quoteBasis,
        resource: factResource,
      };
    };
    const portfolioAmount =
      portfolio?.accountTokensValueAvailable === true
        ? portfolio.accountTokensValue
        : undefined;
    const defiAmount = defi?.overview.netWorth;
    const perpsAmount = perps?.view.accountValueUsd;
    const contributors = {
      portfolio: makeContributor({
        id: 'portfolio',
        amount: portfolioAmount,
        amountComplete: portfolio?.accountTokensValueComplete === true,
        positiveEvidence: Boolean(
          portfolio?.fundedIds.length ||
          (portfolioAmount && !new BigNumber(portfolioAmount).isZero()),
        ),
      }),
      ...((override?.sourceId === 'defi' && !override.empty) ||
      state.resources.defi.kind === 'ready'
        ? {
            defi: makeContributor({
              id: 'defi' as const,
              amount: defiAmount,
              positiveEvidence: Boolean(
                defiAmount && !new BigNumber(defiAmount).isZero(),
              ),
            }),
          }
        : {}),
      ...((override?.sourceId === 'perps' && !override.empty) ||
      state.resources.perps.kind === 'ready'
        ? {
            perps: makeContributor({
              id: 'perps' as const,
              amount: perpsAmount,
              positiveEvidence: Boolean(
                perpsAmount && !new BigNumber(perpsAmount).isZero(),
              ),
            }),
          }
        : {}),
    };
    const balance = {
      ownerToken,
      requiredContributors: ['portfolio'] as const,
      requiredSetRevision,
      sourceKeyIdentity: [
        ownerToken.scopeKey,
        requiredSetRevision,
        contributors.portfolio.sourceKeyIdentity,
        contributors.defi?.sourceKeyIdentity ?? '',
        contributors.perps?.sourceKeyIdentity ?? '',
      ].join('|'),
      quoteBasis,
      contributors,
      bannerAvailable:
        (override?.sourceId === 'banner' &&
          (() => {
            const payload =
              override.payload as unknown as IHomeBannerStorePayload;
            return Boolean(payload.banners.length > 0 || payload.tronResource);
          })()) ||
        (state.resources.banner.kind === 'ready' &&
          (() => {
            const payload = readHomeBannerStorePayload(
              state.resources.banner.data,
            );
            return Boolean(
              payload && (payload.banners.length > 0 || payload.tronResource),
            );
          })()),
    };
    return {
      type: 'balanceChanged',
      facts: { ...facts, balance },
      observedAt: Date.now(),
    };
  }

  private async loadCapability(
    environment: IHomeSourceEnvironment,
    sessionId: string,
  ): Promise<IHomeCapabilityFacts> {
    const state = this.host.getStateView();
    const ownerToken = state.session.ownerToken;
    const { account, indexedAccount, network, vaultSettings, wallet } =
      environment.activeAccount;
    if (!ownerToken || !account || !network || !wallet) {
      throw new OneKeyLocalError('Home capability owner is unavailable');
    }
    const accountScopeId = resolveHomeWalletTabSupportAccountScopeId({
      accountId: account.id,
      indexedAccountId: indexedAccount?.id,
      walletId: wallet.id,
    });
    const scopeKey = buildHomeWalletTabSupportScopeKey({
      accountScopeId,
      networkId: network.id,
      isAllNetworks: Boolean(network.isAllNetworks),
    });
    const support = network.isAllNetworks
      ? buildHomeWalletTabSupport({
          network,
          deFiEnabledNetworksMap: {},
          perpDisabled: false,
        })
      : await this.host.leafPool
          .run(
            'critical',
            () =>
              backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMapState({
                syncIfEmpty: true,
              }),
            sessionId,
          )
          .then(({ enabledNetworksMap, isReady }) =>
            buildHomeWalletTabSupport({
              network,
              deFiEnabledNetworksMap: enabledNetworksMap,
              perpDisabled: false,
              isReady,
            }),
          );
    const accountType = state.facts?.wallet.accountType ?? 'unknown';
    const nftEnabled = Boolean(
      network.isAllNetworks ||
      (vaultSettings?.NFTEnabled &&
        networkUtils.getEnabledNFTNetworkIds().includes(network.id)),
    );
    return adaptCurrentHomeCapabilityFacts({
      accountType,
      allNetworks: Boolean(network.isAllNetworks),
      expectedSourceScopeKey: scopeKey,
      isReady: support.isReady,
      networkFamily: toNetworkFamily(network),
      ownerToken,
      perpsDestination: support.isPerpsSupported ? 'inline' : 'unavailable',
      productAvailability: {
        defi: support.isDeFiSupported,
        history: true,
        market: true,
        nft: nftEnabled,
        perps: support.isPerpsSupported,
      },
      serverConfig: {
        defi: support.isDeFiSupported,
        history: true,
        market: true,
        nft: nftEnabled,
        perps: support.isPerpsSupported,
      },
      sourceRevision: 'capability-v2',
      sourceScopeKey: support.isReady ? scopeKey : undefined,
    });
  }

  private async loadBanner(
    environment: IHomeSourceEnvironment,
    priority: IRuntimeRequestPriority,
    sessionId: string,
    publishIntermediate: (payload: IHomeBannerStorePayload) => void,
  ): Promise<IHomeBannerStorePayload> {
    const { account, network, vaultSettings, wallet } =
      environment.activeAccount;
    if (!account || !network || !wallet) {
      throw new OneKeyLocalError('Home banner owner is unavailable');
    }
    type ILeafState<T> =
      | { status: 'pending' }
      | { status: 'failed' }
      | { status: 'ready'; value: T };
    let remoteState: ILeafState<
      Awaited<
        ReturnType<
          typeof backgroundApiProxy.serviceWalletBanner.fetchWalletBanner
        >
      >
    > = { status: 'pending' };
    let localState: ILeafState<
      Awaited<
        ReturnType<typeof backgroundApiProxy.simpleDb.walletBanner.getRawData>
      >
    > = { status: 'pending' };
    let botState: ILeafState<boolean> = accountUtils.isBotWallet({
      walletId: wallet.id,
    })
      ? { status: 'pending' }
      : { status: 'ready', value: false };
    let referralState: ILeafState<
      IHomeBannerStorePayload['referralEligibility']
    > = { status: 'pending' };
    let normalResultCount = 0;
    let lastPublishedFingerprint: string | undefined;

    const buildPayload = (): IHomeBannerStorePayload => {
      const local =
        localState.status === 'ready' ? localState.value : undefined;
      const remote =
        remoteState.status === 'ready' ? remoteState.value : undefined;
      const referralEligibility =
        referralState.status === 'ready' ? referralState.value : null;
      const closedForever = local?.closedForever ?? {};
      const dismissedIds = new Set(
        this.host.getStateView().interaction.dismissedBannerIds,
      );
      const banners = (remote ?? local?.topBanners ?? []).filter(
        (banner) =>
          (!banner.position || banner.position === 'home') &&
          (!banner.networkIds?.length ||
            banner.networkIds.includes(network.id)) &&
          !closedForever[banner.id] &&
          !dismissedIds.has(banner.id),
      );
      const referralBanner =
        referralEligibility?.shouldShow &&
        !dismissedIds.has(HOME_PERPS_REFERRAL_BANNER_ID)
          ? toHomeBannerStoreItem({
              _id: HOME_PERPS_REFERRAL_BANNER_ID,
              id: HOME_PERPS_REFERRAL_BANNER_ID,
              title: environment.bannerLabels.referralTitle,
              description: environment.bannerLabels.referralDescription,
              src: '',
              button: '',
              rank: 0,
              closeable: false,
              closeForever: false,
              useSystemBrowser: false,
              theme: 'light',
              position: 'home',
              icon: 'GiftSolid',
            })
          : undefined;
      return {
        banners: [
          ...(referralBanner ? [referralBanner] : []),
          ...banners.map(toHomeBannerStoreItem),
        ],
        referralEligibility,
        tronResource:
          vaultSettings?.hasResource && account.id && network.id
            ? { accountId: account.id, networkId: network.id }
            : null,
        // Unknown bot status must not be treated as an authoritative safe value.
        isBotWalletReceiveBlocked:
          botState.status === 'ready' ? botState.value : true,
      };
    };
    const publishNormalResult = () => {
      if (remoteState.status !== 'ready' && localState.status !== 'ready') {
        return;
      }
      const payload = buildPayload();
      const fingerprint = buildHomeBannerSemanticFingerprint(payload);
      if (fingerprint !== lastPublishedFingerprint) {
        lastPublishedFingerprint = fingerprint;
        publishIntermediate(payload);
      }
    };

    const remoteTask = this.host.leafPool
      .run(
        priority,
        () =>
          backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
            accountId: account.id,
          }),
        sessionId,
      )
      .then((remote) => {
        normalResultCount += 1;
        remoteState = { status: 'ready', value: remote };
        publishNormalResult();
        void backgroundApiProxy.serviceWalletBanner.updateLocalTopBanners({
          topBanners: remote,
        });
      })
      .catch(() => {
        remoteState = { status: 'failed' };
        publishNormalResult();
      });
    const localTask = this.host.leafPool
      .run(
        priority,
        () => backgroundApiProxy.simpleDb.walletBanner.getRawData(),
        sessionId,
      )
      .then((local) => {
        normalResultCount += 1;
        localState = { status: 'ready', value: local };
        publishNormalResult();
      })
      .catch(() => {
        localState = { status: 'failed' };
        publishNormalResult();
      });
    const botTask =
      botState.status === 'pending'
        ? this.host.leafPool
            .run(
              priority,
              () =>
                backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
                  walletId: wallet.id,
                }),
              sessionId,
            )
            .then((botDeactivated) => {
              botState = { status: 'ready', value: botDeactivated };
              publishNormalResult();
            })
            .catch(() => {
              botState = { status: 'failed' };
              publishNormalResult();
            })
        : Promise.resolve();
    const referralTask = this.host.leafPool
      .run(
        'background',
        async () => {
          const deriveType =
            await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork(
              { networkId: PERPS_NETWORK_ID },
            );
          const result =
            await backgroundApiProxy.serviceHyperliquidReferral.checkBannerReferralEligibility(
              {
                accountId: account.id,
                indexedAccountId:
                  environment.activeAccount.indexedAccount?.id || undefined,
                deriveType,
              },
            );
          return {
            shouldShow: result.shouldShow,
            resolvedAccountId: result.resolvedAccountId,
            resolvedAddress: result.resolvedAddress,
            reason: result.reason ?? null,
          };
        },
        sessionId,
      )
      .then((referralEligibility) => {
        referralState = { status: 'ready', value: referralEligibility };
        publishNormalResult();
      })
      .catch(() => {
        referralState = { status: 'failed' };
        publishNormalResult();
      });

    await Promise.allSettled([remoteTask, localTask, botTask, referralTask]);
    if (normalResultCount === 0) {
      throw new OneKeyLocalError('Home banner sources are unavailable');
    }
    return buildPayload();
  }

  private async loadSection({
    environment,
    force,
    priority,
    publishIntermediate,
    sessionId,
    sourceId,
    yieldIfMainBudgetExceeded,
  }: {
    environment: IHomeSourceEnvironment;
    force: boolean;
    priority: IRuntimeRequestPriority;
    publishIntermediate: (input: {
      payload: unknown;
      rowIds: readonly string[];
    }) => void;
    sessionId: string;
    sourceId: IHomeSectionId;
    yieldIfMainBudgetExceeded: () => Promise<void>;
  }): Promise<{ payload: unknown; rowIds: readonly string[] }> {
    if (sourceId === 'portfolio') {
      return this.loadPortfolio({
        environment,
        force,
        priority,
        publishIntermediate,
        sessionId,
        yieldIfMainBudgetExceeded,
      });
    }
    if (sourceId === 'nft') {
      return this.loadNFT(environment, force, priority, sessionId);
    }
    if (sourceId === 'defi') {
      return this.loadDeFi(environment, force, priority, sessionId);
    }
    if (sourceId === 'history') {
      return this.loadHistory(environment, force, priority, sessionId);
    }
    if (sourceId === 'perps') {
      return this.loadPerps(environment, priority, sessionId);
    }
    return this.loadMarket(
      environment,
      priority,
      sessionId,
      publishIntermediate,
    );
  }

  private async loadPortfolio({
    environment,
    force,
    priority,
    publishIntermediate,
    sessionId,
    yieldIfMainBudgetExceeded,
  }: {
    environment: IHomeSourceEnvironment;
    force: boolean;
    priority: IRuntimeRequestPriority;
    publishIntermediate: (input: {
      payload: unknown;
      rowIds: readonly string[];
    }) => void;
    sessionId: string;
    yieldIfMainBudgetExceeded: () => Promise<void>;
  }): Promise<{ payload: IHomeSpotLegacyPayload; rowIds: readonly string[] }> {
    const { account, indexedAccount, network, vaultSettings, wallet } =
      environment.activeAccount;
    const state = this.host.getStateView();
    if (!account || !network || !wallet || !state.session.ownerToken) {
      throw new OneKeyLocalError('Home Portfolio owner is unavailable');
    }
    const requestedLpMode =
      state.interaction.sectionControls.portfolio?.[
        HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID
      ] === true;
    const isDeFiEnabled = network.isAllNetworks
      ? true
      : await this.host.leafPool
          .run(
            priority,
            () =>
              backgroundApiProxy.serviceDeFi.isNetworkDeFiEnabled(network.id),
            sessionId,
          )
          .catch(() => false);
    const showLpTokenFilterSwitch =
      isTokenSelectorDappTokenFilterSupportedNetwork({
        network,
        isDeFiEnabled,
      });
    const showLpTokensOnly = showLpTokenFilterSwitch && requestedLpMode;
    const mergeDeriveAddressData = Boolean(
      vaultSettings?.mergeDeriveAssetsEnabled &&
      indexedAccount?.id &&
      !accountUtils.isOthersAccount({ accountId: account.id }),
    );
    const walletTokenFilterParams = buildTokenSelectorDappTokenFilterParams({
      lpToken: false,
    });
    const lpTokenFilterParams = buildTokenSelectorDappTokenFilterParams({
      lpToken: true,
    });
    const mergeDeriveByNetworkId = new Map<string, Promise<boolean>>();
    type IPortfolioFetchTarget = {
      accountId: string;
      accountAddress?: string;
      accountXpub?: string;
      dbAccount?: IAccountSelectorActiveAccountInfo['dbAccount'];
      mergeDeriveAssets?: boolean;
      networkId: string;
    };
    await this.host.leafPool.run(
      priority,
      () =>
        backgroundApiProxy.serviceToken.updateCurrentAccount({
          accountId: account.id,
          networkId: network.id,
        }),
      sessionId,
    );
    const fetchTokens = async (
      target: IPortfolioFetchTarget,
      lpToken: boolean,
    ): Promise<INativeHomeAllNetworkTokenResponse> => {
      let mergeDerivePromise = mergeDeriveByNetworkId.get(target.networkId);
      if (!mergeDerivePromise) {
        mergeDerivePromise =
          target.mergeDeriveAssets !== undefined
            ? Promise.resolve(target.mergeDeriveAssets)
            : this.host.leafPool
                .run(
                  priority,
                  () =>
                    backgroundApiProxy.serviceNetwork.getVaultSettings({
                      networkId: target.networkId,
                    }),
                  sessionId,
                )
                .then((settings) => Boolean(settings?.mergeDeriveAssetsEnabled))
                .catch(() => false);
        mergeDeriveByNetworkId.set(target.networkId, mergeDerivePromise);
      }
      const [response, mergeDeriveAssets] = await Promise.all([
        this.host.leafPool.run(
          priority,
          () =>
            backgroundApiProxy.serviceToken.fetchAccountTokens({
              accountId: target.accountId,
              dbAccount: target.dbAccount,
              indexedAccountId: indexedAccount?.id,
              networkId: target.networkId,
              mergeTokens: true,
              flag: 'home-token-list',
              isAllNetworks: Boolean(network.isAllNetworks),
              isManualRefresh: force,
              allNetworksAccountId: account.id,
              allNetworksNetworkId: network.id,
              saveToLocal: true,
              ...(lpToken ? lpTokenFilterParams : walletTokenFilterParams),
            }),
          sessionId,
        ),
        mergeDerivePromise,
      ]);
      return {
        ...response,
        accountId: response.accountId ?? target.accountId,
        mergeDeriveAssets,
        networkId: response.networkId ?? target.networkId,
      };
    };
    const fetchTargets = async ({
      lpToken,
      onProgress,
      targets,
    }: {
      lpToken: boolean;
      onProgress?: (
        responses: readonly INativeHomeAllNetworkTokenResponse[],
        processedTargetCount: number,
      ) => Promise<void>;
      targets: readonly IPortfolioFetchTarget[];
    }) => {
      const responses: INativeHomeAllNetworkTokenResponse[] = [];
      for (let index = 0; index < targets.length; index += 4) {
        const chunk = targets.slice(index, index + 4);
        const settled = await Promise.allSettled(
          chunk.map((target) => fetchTokens(target, lpToken)),
        );
        responses.push(
          ...settled.flatMap((item) =>
            item.status === 'fulfilled' &&
            item.value.isSameAllNetworksAccountData !== false
              ? [item.value]
              : [],
          ),
        );
        if (
          onProgress &&
          responses.length > 0 &&
          (index + 4) % 12 === 0 &&
          index + 4 < targets.length
        ) {
          await onProgress(responses, Math.min(index + 4, targets.length));
        }
      }
      return responses;
    };
    let publishedCacheResponseCount = 0;
    const fetchCachedTargets = async (
      targets: readonly IPortfolioFetchTarget[],
    ) => {
      const responses: INativeHomeAllNetworkTokenResponse[] = [];
      const publishCachedResponses = async (processedTargetCount: number) => {
        if (
          responses.length === 0 ||
          responses.length === publishedCacheResponseCount
        ) {
          return;
        }
        const intermediate = await this.buildPortfolioPayload({
          environment,
          mergeDeriveAddressData,
          priority,
          responses: [...responses],
          sessionId,
          shouldIngest: true,
          showLpTokenFilterSwitch,
          showLpTokensOnly: false,
        });
        if (intermediate.displayIds.length === 0) {
          return;
        }
        publishedCacheResponseCount = responses.length;
        defaultLogger.wallet.homeUi.homePortfolioProgress({
          publicationKind: 'localCacheIntermediate',
          mode: 'wallet',
          processedTargetCount,
          responseCount: responses.length,
          rowCount: intermediate.displayIds.length,
        });
        publishIntermediate({
          payload: intermediate,
          rowIds: intermediate.displayIds,
        });
        await yieldIfMainBudgetExceeded();
      };
      for (let index = 0; index < targets.length; index += 4) {
        const chunk = targets.slice(index, index + 4);
        const settled = await Promise.allSettled(
          chunk.map(async (target) => {
            const cached = await this.host.leafPool.run(
              priority,
              () =>
                backgroundApiProxy.serviceToken.getAccountLocalTokens({
                  accountId: target.accountId,
                  networkId: target.networkId,
                  accountAddress: target.accountAddress,
                  xpub: target.accountXpub,
                }),
              sessionId,
            );
            if (!cached.hasCache) {
              return undefined;
            }
            const pickMap = (
              tokens: typeof cached.tokenList,
            ): typeof cached.tokenListMap =>
              Object.fromEntries(
                tokens.flatMap((token) => {
                  const fiat = cached.tokenListMap[token.$key];
                  return fiat ? [[token.$key, fiat] as const] : [];
                }),
              );
            return {
              accountId: target.accountId,
              networkId: target.networkId,
              mergeDeriveAssets: target.mergeDeriveAssets,
              isSameAllNetworksAccountData: true,
              tokens: {
                data: cached.tokenList,
                currency: cached.currency,
                fiatValue: cached.currency ? cached.tokenListValue : undefined,
                keys: cached.tokenList.map((token) => token.$key).join('_'),
                map: pickMap(cached.tokenList),
              },
              smallBalanceTokens: {
                data: cached.smallBalanceTokenList,
                currency: cached.currency,
                fiatValue: cached.currency ? '0' : undefined,
                keys: cached.smallBalanceTokenList
                  .map((token) => token.$key)
                  .join('_'),
                map: pickMap(cached.smallBalanceTokenList),
              },
              riskTokens: {
                data: cached.riskyTokenList,
                currency: cached.currency,
                fiatValue: cached.currency ? '0' : undefined,
                keys: cached.riskyTokenList
                  .map((token) => token.$key)
                  .join('_'),
                map: pickMap(cached.riskyTokenList),
              },
            } satisfies INativeHomeAllNetworkTokenResponse;
          }),
        );
        responses.push(
          ...settled.flatMap((item) =>
            item.status === 'fulfilled' && item.value ? [item.value] : [],
          ),
        );
        if (publishedCacheResponseCount === 0) {
          await publishCachedResponses(Math.min(index + 4, targets.length));
        }
      }
      await publishCachedResponses(targets.length);
      return responses;
    };
    let walletTargets: IPortfolioFetchTarget[];
    let lpTargets: IPortfolioFetchTarget[] = [];
    if (network.isAllNetworks) {
      const walletAccounts = await this.allNetworkAccounts.get(
        {
          accountId: account.id,
          indexedAccountId: indexedAccount?.id,
          networkId: network.id,
          networksEnabledOnly: true,
          excludeTestNetwork: true,
          maxConcurrency: 4,
        },
        { force, walletId: wallet.id },
      );
      walletTargets = walletAccounts.accountsInfo.map((item) => ({
        accountId: item.accountId,
        accountAddress: item.apiAddress,
        accountXpub: item.accountXpub,
        dbAccount: item.dbAccount,
        networkId: item.networkId,
      }));
      if (showLpTokensOnly) {
        const lpAccounts = await this.allNetworkAccounts.get(
          {
            accountId: account.id,
            indexedAccountId: indexedAccount?.id,
            networkId: network.id,
            DeFiEnabledOnly: true,
            networksEnabledOnly: true,
            excludeTestNetwork: true,
            maxConcurrency: 4,
          },
          { force, walletId: wallet.id },
        );
        lpTargets = lpAccounts.accountsInfo.map((item) => ({
          accountId: item.accountId,
          accountAddress: item.apiAddress,
          accountXpub: item.accountXpub,
          dbAccount: item.dbAccount,
          networkId: item.networkId,
        }));
      }
    } else if (mergeDeriveAddressData && indexedAccount?.id) {
      const { networkAccounts } = await this.host.leafPool.run(
        priority,
        () =>
          backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
            {
              networkId: network.id,
              indexedAccountId: indexedAccount.id,
              excludeEmptyAccount: true,
            },
          ),
        sessionId,
      );
      walletTargets = networkAccounts.flatMap((item) =>
        item.account?.id
          ? [
              {
                accountId: item.account.id,
                mergeDeriveAssets: true,
                networkId: network.id,
              },
            ]
          : [],
      );
      lpTargets = showLpTokensOnly ? walletTargets : [];
    } else {
      walletTargets = [{ accountId: account.id, networkId: network.id }];
      lpTargets = showLpTokensOnly ? walletTargets : [];
    }

    await fetchCachedTargets(walletTargets);
    const walletResponses = await fetchTargets({
      lpToken: false,
      targets: walletTargets,
      onProgress: showLpTokensOnly
        ? undefined
        : async (responses, processedTargetCount) => {
            const intermediate = await this.buildPortfolioPayload({
              environment,
              mergeDeriveAddressData,
              priority,
              responses: [...responses],
              sessionId,
              shouldIngest: true,
              showLpTokenFilterSwitch,
              showLpTokensOnly: false,
            });
            defaultLogger.wallet.homeUi.homePortfolioProgress({
              publicationKind: 'liveIntermediate',
              mode: 'wallet',
              processedTargetCount,
              responseCount: responses.length,
              rowCount: intermediate.displayIds.length,
            });
            publishIntermediate({
              payload: intermediate,
              rowIds: intermediate.displayIds,
            });
            await yieldIfMainBudgetExceeded();
          },
    });
    const walletPayload = await this.buildPortfolioPayload({
      environment,
      mergeDeriveAddressData,
      priority,
      responses: walletResponses,
      expectedResponseCount: walletTargets.length,
      sessionId,
      shouldIngest: true,
      showLpTokenFilterSwitch,
      showLpTokensOnly: false,
    });
    if (!showLpTokensOnly) {
      return { payload: walletPayload, rowIds: walletPayload.displayIds };
    }
    const lpResponses = await fetchTargets({
      lpToken: true,
      targets: lpTargets,
      onProgress: async (responses, processedTargetCount) => {
        const intermediate = await this.buildPortfolioPayload({
          environment,
          mergeDeriveAddressData,
          priority,
          responses: [...responses],
          sessionId,
          shouldIngest: false,
          showLpTokenFilterSwitch,
          showLpTokensOnly: true,
          valuationPayload: walletPayload,
        });
        defaultLogger.wallet.homeUi.homePortfolioProgress({
          publicationKind: 'liveIntermediate',
          mode: 'lp',
          processedTargetCount,
          responseCount: responses.length,
          rowCount: intermediate.displayIds.length,
        });
        publishIntermediate({
          payload: intermediate,
          rowIds: intermediate.displayIds,
        });
        await yieldIfMainBudgetExceeded();
      },
    });
    const payload = await this.buildPortfolioPayload({
      environment,
      mergeDeriveAddressData,
      priority,
      responses: lpResponses,
      expectedResponseCount: lpTargets.length,
      sessionId,
      shouldIngest: false,
      showLpTokenFilterSwitch,
      showLpTokensOnly: true,
      valuationPayload: walletPayload,
    });
    return { payload, rowIds: payload.displayIds };
  }

  private async buildPortfolioPayload({
    environment,
    mergeDeriveAddressData,
    priority,
    responses,
    sessionId,
    shouldIngest,
    showLpTokenFilterSwitch,
    showLpTokensOnly,
    valuationPayload,
    expectedResponseCount,
  }: {
    environment: IHomeSourceEnvironment;
    mergeDeriveAddressData: boolean;
    priority: IRuntimeRequestPriority;
    responses: INativeHomeAllNetworkTokenResponse[];
    expectedResponseCount?: number;
    sessionId: string;
    shouldIngest: boolean;
    showLpTokenFilterSwitch: boolean;
    showLpTokensOnly: boolean;
    valuationPayload?: IHomeSpotLegacyPayload;
  }): Promise<IHomeSpotLegacyPayload> {
    const { account, network } = environment.activeAccount;
    const projection = buildNativeHomeAllNetworkPortfolioProjection({
      responses,
    });
    const networksMap = await this.getAllNetworksMap(sessionId);
    const aggregateTokenListMap = Object.assign(
      {},
      ...responses.map((item) => item.aggregateTokenListMap ?? {}),
    );
    const aggregateTokenMap = Object.assign(
      {},
      ...responses.map((item) => item.aggregateTokenMap ?? {}),
    );
    const displayIds = projection.tokens.map((token) => token.$key);
    const accountWorthByNetwork: Record<string, string> = {};
    let createAtNetworkWorth = new BigNumber(0);
    responses.forEach((response) => {
      const responseAccountId = response.accountId ?? account?.id;
      const responseNetworkId = response.networkId ?? network?.id;
      if (!responseAccountId || !responseNetworkId) {
        return;
      }
      const worth = sumTokenGroupsFiatValueIgnoringUnavailable(response);
      accountWorthByNetwork[
        accountUtils.buildAccountValueKey({
          accountId: responseAccountId,
          networkId: responseNetworkId,
        })
      ] = worth;
      if (
        account &&
        (!accountUtils.isOthersAccount({ accountId: account.id }) ||
          account.createAtNetwork === responseNetworkId)
      ) {
        createAtNetworkWorth = createAtNetworkWorth.plus(worth);
      }
    });
    const ownerKey =
      this.host.getStateView().session.ownerToken?.scopeKey ?? '';
    const responseValues = responses.map(sumTokenValue);
    const accountTokensValueAvailable = valuationPayload
      ? valuationPayload.accountTokensValueAvailable === true
      : responseValues.some((value) => value !== undefined);
    const accountTokensValueComplete = valuationPayload
      ? valuationPayload.accountTokensValueComplete === true
      : responses.length > 0 &&
        (expectedResponseCount === undefined ||
          responses.length === expectedResponseCount) &&
        responseValues.every((value) => value !== undefined);
    const accountTokensValue =
      valuationPayload?.accountTokensValue ??
      responseValues
        .reduce(
          (total, value) =>
            value === undefined ? total : total.plus(new BigNumber(value)),
          new BigNumber(0),
        )
        .toFixed();
    const payload: IHomeSpotLegacyPayload = {
      ...createHomeSpotSnapshotDefaults(),
      accountTokensValue,
      accountTokensValueAvailable,
      accountTokensValueComplete,
      accountTokensWorthCurrency: USD_CURRENCY_ID,
      accountWorthByNetwork:
        valuationPayload?.accountWorthByNetwork ?? accountWorthByNetwork,
      aggregateTokenListMap,
      allAggregateTokenMap: aggregateTokenListMap,
      createAtNetworkWorth:
        valuationPayload?.createAtNetworkWorth ??
        createAtNetworkWorth.toFixed(),
      displayIds,
      fundedIds: displayIds,
      generation: this.dataRevision + 1,
      isAllNetworkEmptyAccount: Boolean(
        network?.isAllNetworks &&
        (valuationPayload?.displayIds ?? displayIds).length === 0,
      ),
      mergeDeriveAddressData,
      networksMap,
      ownerKey,
      riskMap: showLpTokensOnly ? {} : projection.riskMap,
      riskTokens: showLpTokensOnly ? [] : projection.riskTokens,
      scopedLpTokenList: showLpTokensOnly
        ? {
            keys: `${ownerKey}:${this.dataRevision + 1}`,
            tokens: projection.tokens,
          }
        : { keys: '', tokens: [] },
      scopedLpTokenListMap: showLpTokensOnly ? projection.map : {},
      showLpTokenFilterSwitch,
      showLpTokensOnly,
      smallBalanceFiatValue: responses
        .reduce(
          (total, response) =>
            total.plus(response.smallBalanceTokens.fiatValue ?? 0),
          new BigNumber(0),
        )
        .toFixed(),
      smallBalanceMap: showLpTokensOnly ? {} : projection.smallBalanceMap,
      smallBalanceTokens: showLpTokensOnly ? [] : projection.smallBalanceTokens,
      tapTokenMap: { ...projection.map, ...aggregateTokenMap },
      tokenListMap: projection.map,
      tokens: projection.tokens.map((token) => ({
        ...token,
        accountId: token.accountId ?? account?.id,
      })),
    };
    if (shouldIngest) {
      await this.ingestTokenListPayload(payload, priority, sessionId);
    }
    return payload;
  }

  private async ingestTokenListPayload(
    payload: IHomeSpotLegacyPayload,
    priority: IRuntimeRequestPriority,
    sessionId: string,
  ): Promise<void> {
    const { account, network } = this.environment?.activeAccount ?? {};
    if (!account || !network || !payload.ownerKey) {
      return;
    }
    await this.host.leafPool.run(
      priority,
      () =>
        backgroundApiProxy.serviceTokenViewModel.ingestRound({
          ownerKey: payload.ownerKey,
          orderedTokens: payload.tokens,
          smallBalanceTokens: payload.smallBalanceTokens,
          tokenListMap: {
            ...payload.tokenListMap,
            ...payload.smallBalanceMap,
          },
          aggregateTokensMap: {},
          ownedAggregateTokenListMap: payload.aggregateTokenListMap,
          smallBalanceFiatValue: payload.smallBalanceFiatValue ?? '0',
          storeData: {
            storeName: EJotaiContextStoreNames.homeTokenList,
          },
          keepDefault: true,
          homeDefaultTokenMap: payload.homeDefaultTokenMap,
          riskyTokens: payload.riskTokens,
          riskyMap: payload.riskMap,
          accountId: account.id,
          networkId: network.id,
          rawKeys: [
            payload.generation,
            payload.displayIds.length,
            payload.displayIds[0] ?? '',
            payload.displayIds[payload.displayIds.length - 1] ?? '',
          ].join(':'),
          source: network.isAllNetworks ? 'authoritative' : 'single',
        }),
      sessionId,
    );
  }

  private getAllNetworksMap(
    sessionId: string,
  ): Promise<IHomeSpotLegacyPayload['networksMap']> {
    const now = Date.now();
    if (this.allNetworksMapCache && this.allNetworksMapCache.expiresAt > now) {
      return Promise.resolve(this.allNetworksMapCache.value);
    }
    if (this.allNetworksMapPromise) {
      return this.allNetworksMapPromise;
    }
    this.allNetworksMapPromise = this.host.leafPool
      .run(
        'background',
        () =>
          backgroundApiProxy.serviceNetwork.getAllNetworks({
            excludeTestNetwork: true,
          }),
        sessionId,
      )
      .then(({ networks }) => {
        const value = Object.fromEntries(
          networks.map((item) => [item.id, item]),
        );
        this.allNetworksMapCache = {
          expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
          value,
        };
        return value;
      })
      .finally(() => {
        this.allNetworksMapPromise = undefined;
      });
    return this.allNetworksMapPromise;
  }

  private async loadNFT(
    environment: IHomeSourceEnvironment,
    force: boolean,
    priority: IRuntimeRequestPriority,
    sessionId: string,
  ): Promise<{ payload: { data: unknown[] }; rowIds: readonly string[] }> {
    const { account, indexedAccount, network, wallet } =
      environment.activeAccount;
    if (!account || !network) {
      throw new OneKeyLocalError('Home NFT owner is unavailable');
    }
    await this.host.leafPool.run(
      priority,
      () =>
        backgroundApiProxy.serviceNFT.updateCurrentAccount({
          accountId: account.id,
          networkId: network.id,
        }),
      sessionId,
    );
    const fetch = (
      accountId: string,
      networkId: string,
      dbAccount?: IAccountSelectorActiveAccountInfo['dbAccount'],
    ) =>
      this.host.leafPool.run(
        priority,
        () =>
          backgroundApiProxy.serviceNFT.fetchAccountNFTs({
            accountId,
            dbAccount,
            networkId,
            isAllNetworks: Boolean(network.isAllNetworks),
            isManualRefresh: force,
            allNetworksAccountId: account.id,
            allNetworksNetworkId: network.id,
            saveToLocal: true,
          }),
        sessionId,
      );
    const responses: PromiseSettledResult<Awaited<ReturnType<typeof fetch>>>[] =
      [];
    if (network.isAllNetworks) {
      const { accountsInfo } = await this.allNetworkAccounts.get(
        {
          accountId: account.id,
          indexedAccountId: indexedAccount?.id,
          networkId: network.id,
          nftEnabledOnly: true,
          networksEnabledOnly: true,
          excludeTestNetwork: true,
          maxConcurrency: 4,
        },
        { force, walletId: wallet?.id },
      );
      for (let index = 0; index < accountsInfo.length; index += 4) {
        const chunk = accountsInfo.slice(index, index + 4);
        responses.push(
          ...(await Promise.allSettled(
            chunk.map((item) =>
              fetch(item.accountId, item.networkId, item.dbAccount),
            ),
          )),
        );
      }
    } else {
      responses.push({
        status: 'fulfilled',
        value: await fetch(account.id, network.id),
      });
    }
    const dataById = new Map<
      string,
      (typeof responses)[number] extends {
        value: { data: Array<infer T> };
      }
        ? T
        : never
    >();
    responses.forEach((response) => {
      if (response.status === 'fulfilled') {
        response.value.data.forEach((nft) =>
          dataById.set(getHomeNFTItemRowId(nft), nft as never),
        );
      }
    });
    const data = Array.from(dataById.values());
    return {
      payload: { data },
      rowIds: data.map((nft) => getHomeNFTItemRowId(nft as never)),
    };
  }

  private async loadDeFi(
    environment: IHomeSourceEnvironment,
    force: boolean,
    priority: IRuntimeRequestPriority,
    sessionId: string,
  ): Promise<{ payload: unknown; rowIds: readonly string[] }> {
    const { account, indexedAccount, network, wallet } =
      environment.activeAccount;
    if (!account || !network) {
      throw new OneKeyLocalError('Home DeFi owner is unavailable');
    }
    await this.host.leafPool.run(
      priority,
      () =>
        backgroundApiProxy.serviceDeFi.updateCurrentAccount({
          accountId: account.id,
          networkId: network.id,
        }),
      sessionId,
    );
    const sourceCurrencyInfo =
      environment.currencyMap[environment.settings.currencyInfo.id];
    const targetCurrencyInfo = environment.currencyMap.usd;
    const fetch = (accountId: string, networkId: string) =>
      this.host.leafPool.run(
        priority,
        () =>
          backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions({
            accountId,
            indexedAccountId: indexedAccount?.id,
            networkId,
            isAllNetworks: Boolean(network.isAllNetworks),
            allNetworksAccountId: account.id,
            allNetworksNetworkId: network.id,
            saveToLocal: true,
            excludeLowValueProtocols: true,
            sourceCurrencyInfo,
            targetCurrencyInfo,
            isForceRefresh: force,
          }),
        sessionId,
      );
    const accounts = network.isAllNetworks
      ? (
          await this.allNetworkAccounts.get(
            {
              accountId: account.id,
              indexedAccountId: indexedAccount?.id,
              networkId: network.id,
              DeFiEnabledOnly: true,
              networksEnabledOnly: true,
              excludeTestNetwork: true,
              maxConcurrency: 4,
            },
            { force, walletId: wallet?.id },
          )
        ).accountsInfo
      : [{ accountId: account.id, networkId: network.id }];
    const supportedActionsPromise = this.host.leafPool
      .run(
        priority,
        () => backgroundApiProxy.serviceDeFi.fetchSupportedDeFiProtocols(),
        sessionId,
      )
      .catch(() => [] as IDeFiSupportedProtocolAction[]);
    const settled: PromiseSettledResult<Awaited<ReturnType<typeof fetch>>>[] =
      [];
    for (let index = 0; index < accounts.length; index += 4) {
      const chunk = accounts.slice(index, index + 4);
      settled.push(
        ...(await Promise.allSettled(
          chunk.map((item) => fetch(item.accountId, item.networkId)),
        )),
      );
    }
    const supportedActions = await supportedActionsPromise;
    const protocols = new Map<string, IDeFiProtocol>();
    const protocolMap: Record<string, IProtocolSummary> = {};
    const overview = {
      totalValue: 0,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 0,
    };
    settled.forEach((item) => {
      if (item.status !== 'fulfilled') {
        return;
      }
      item.value.protocols.forEach((protocol) => {
        protocols.set(
          defiUtils.buildProtocolMapKey({
            networkId: protocol.networkId,
            protocol: protocol.protocol,
          }),
          protocol,
        );
      });
      Object.assign(protocolMap, item.value.protocolMap);
      overview.totalValue += item.value.overview.totalValue ?? 0;
      overview.totalDebt += item.value.overview.totalDebt ?? 0;
      overview.totalReward += item.value.overview.totalReward ?? 0;
      overview.netWorth += item.value.overview.netWorth ?? 0;
    });
    const payload = {
      currency: environment.settings.currencyInfo.id,
      overview,
      protocolMap,
      protocols: Array.from(protocols.values()),
      supportedActions,
    };
    return { payload, rowIds: getHomeDeFiProtocolRowIds(payload) };
  }

  private async loadHistory(
    environment: IHomeSourceEnvironment,
    force: boolean,
    priority: IRuntimeRequestPriority,
    sessionId: string,
  ): Promise<{ payload: unknown; rowIds: readonly string[] }> {
    const { account, indexedAccount, network, vaultSettings } =
      environment.activeAccount;
    if (!account || !network) {
      throw new OneKeyLocalError('Home History owner is unavailable');
    }
    const mergeDerive = Boolean(
      !network.isAllNetworks &&
      vaultSettings?.mergeDeriveAssetsEnabled &&
      indexedAccount?.id,
    );
    const indexedAccountId = indexedAccount?.id;
    const common = {
      currencyMap: environment.currencyMap,
      excludeTestNetwork: true,
      filterLowValue: environment.settings.isFilterLowValueHistoryEnabled,
      filterScam: environment.settings.isFilterScamHistoryEnabled,
      isManualRefresh: force,
      networkId: network.id,
      sourceCurrency: environment.settings.currencyInfo.id,
    };
    const response = await this.host.leafPool.run(
      priority,
      () =>
        mergeDerive
          ? backgroundApiProxy.serviceHistory.fetchAccountHistoryForMergeDerive(
              {
                ...common,
                indexedAccountId: indexedAccountId ?? '',
              },
            )
          : backgroundApiProxy.serviceHistory.fetchAccountHistory({
              ...common,
              accountId: account.id,
              indexedAccountId: network.isAllNetworks
                ? indexedAccount?.id
                : undefined,
            }),
      sessionId,
    );
    const payload = {
      addressMap: response.addressMap ?? {},
      cursor: response.next ?? null,
      data: response.txs,
      hasMore:
        !network.isAllNetworks && Boolean(response.hasMoreOnChainHistory),
      isLoadingMore: false,
      refresh: 'idle',
      tokenMap: {},
    };
    return { payload, rowIds: getHomeHistoryRowIds(payload) };
  }

  private async loadPerps(
    environment: IHomeSourceEnvironment,
    priority: IRuntimeRequestPriority,
    sessionId: string,
  ): Promise<{ payload: unknown; rowIds: readonly string[] }> {
    const { account, indexedAccount } = environment.activeAccount;
    if (!account) {
      throw new OneKeyLocalError('Home Perps owner is unavailable');
    }
    const deriveType = await this.host.leafPool.run(
      priority,
      () =>
        backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
          networkId: PERPS_NETWORK_ID,
        }),
      sessionId,
    );
    const networkAccount = await this.host.leafPool.run(
      priority,
      () =>
        backgroundApiProxy.serviceAccount.getNetworkAccount({
          accountId: indexedAccount ? undefined : account.id,
          indexedAccountId: indexedAccount?.id,
          deriveType,
          networkId: PERPS_NETWORK_ID,
        }),
      sessionId,
    );
    const address =
      networkAccount?.addressDetail?.normalizedAddress ??
      networkAccount?.address ??
      '';
    const snapshot = address
      ? await this.host.leafPool.run(
          priority,
          () =>
            backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
              { address },
            ),
          sessionId,
        )
      : undefined;
    const view = snapshot
      ? mapSnapshotToPerpsHomeView(snapshot)
      : {
          accountValueUsd: 0,
          holdings: [],
          isDegraded: false,
          isEmpty: true,
          positions: [],
        };
    const payload = {
      address,
      scopeKey: this.host.getStateView().session.ownerToken?.scopeKey,
      view,
    };
    return {
      payload,
      rowIds: [
        ...view.positions.map((item) => `position:${item.coin}`),
        ...view.holdings.map((item) => `holding:${item.symbol}`),
      ],
    };
  }

  private async loadMarket(
    environment: IHomeSourceEnvironment,
    priority: IRuntimeRequestPriority,
    sessionId: string,
    publishIntermediate: (input: {
      payload: unknown;
      rowIds: readonly string[];
    }) => void,
  ): Promise<{ payload: unknown; rowIds: readonly string[] }> {
    const state = this.host.getStateView();
    const currentMarketPayload =
      state.resources.market.kind === 'ready'
        ? readHomeStoreSectionPayload<IHomePopularTradingPayload>(
            state.resources.market.data,
          )
        : undefined;
    const retainedPerpsHotRows = currentMarketPayload?.perpsHotRows ?? [];
    const selectedControl =
      state.interaction.sectionControls.market?.[
        'home.market.selectedCategory'
      ];
    type IMarketRuntimePayload = IHomePopularTradingPayload & {
      quoteCurrency: string;
    };
    type ISpotResult =
      | {
          kind: 'ready';
          payload: Omit<IMarketRuntimePayload, 'perpsHotRows'>;
        }
      | { kind: 'failed' };
    type IPerpsHotResult =
      | {
          kind: 'ready';
          rows: IHomePopularTradingPayload['perpsHotRows'];
        }
      | { kind: 'failed' };

    const tokenSearchAliasesPromise = this.host.leafPool
      .run(
        priority,
        () => backgroundApiProxy.serviceHyperliquid.getTokenSearchAliases(),
        sessionId,
      )
      .catch(() => undefined);
    let settledPerpsHotResult: IPerpsHotResult | undefined;
    const perpsHotResultPromise = this.host.leafPool
      .run(
        priority,
        () =>
          backgroundApiProxy.serviceMarketV2.fetchMarketPerpsTokenList({
            category: HOME_PERPS_HOT_REQUEST_CATEGORY_ID,
          }),
        sessionId,
      )
      .then(async (response): Promise<IPerpsHotResult> => {
        const tokenSearchAliases = await tokenSearchAliasesPromise;
        return {
          kind: 'ready',
          rows: response.tokens
            .map((token) =>
              mapMarketPerpsTokenToDisplay({
                token,
                subtitle: getTokenSubtitle(token.name, tokenSearchAliases),
              }),
            )
            .slice(0, HOME_PERPS_HOT_ROW_LIMIT),
        };
      })
      .catch((): IPerpsHotResult => ({ kind: 'failed' }))
      .then((result) => {
        settledPerpsHotResult = result;
        return result;
      });

    let settledSpotResult: ISpotResult | undefined;
    const spotResultPromise = (async (): Promise<ISpotResult> => {
      const watchListPromise = this.host.leafPool
        .run(
          priority,
          () => backgroundApiProxy.serviceMarketV2.getMarketWatchListV2(),
          sessionId,
        )
        .catch(() => undefined);
      const configResponse = await this.host.leafPool.run(
        priority,
        () => backgroundApiProxy.serviceMarketV2.fetchMarketBasicConfig(),
        sessionId,
      );
      const config = configResponse.data;
      const categories = (
        config.homeTab?.length
          ? config.homeTab.map((item) => ({ id: item.type, name: item.name }))
          : (config.spotCategories?.map((item) => ({
              id: item.type,
              name: item.name,
              icon: item.icon,
            })) ?? [])
      ).filter((item) => item.id !== FAVORITES_CATEGORY_ID);
      const requestedCategory =
        typeof selectedControl === 'string'
          ? selectedControl
          : DEFAULT_MARKET_CATEGORY_ID;
      const resolvedCategoryId = categories.some(
        (item) => item.id === requestedCategory,
      )
        ? requestedCategory
        : (categories[0]?.id ?? DEFAULT_MARKET_CATEGORY_ID);
      const response = await this.host.leafPool.run(
        priority,
        () =>
          backgroundApiProxy.serviceMarketV2.fetchMarketTokenList({
            networkId: '',
            sortBy: 'v24hUSD',
            sortType: 'desc',
            page: 1,
            limit: HOME_MARKET_CATEGORY_REQUEST_LIMIT,
            minLiquidity: config.minLiquidity || 5000,
            type: resolvedCategoryId,
            timeFrame: '4',
          }),
        sessionId,
      );
      const rows = response.list
        .map(mapMarketTokenToDisplay)
        .filter((item): item is NonNullable<typeof item> => item !== null);
      const watchListResponse = await watchListPromise;
      const watchListItems =
        watchListResponse?.data ?? currentMarketPayload?.watchListItems ?? [];
      return {
        kind: 'ready',
        payload: {
          categories,
          earnRows: [],
          favoriteMode:
            watchListItems.length > 0 ? 'favorites' : 'recommendation',
          prefetchCategoryIds: [],
          prefetchedRowsByRequestKey: {},
          resolvedCategoryId,
          rows,
          selectedCategoryId: resolvedCategoryId,
          totalFavorites: watchListItems.length,
          watchListContentKey: watchListItems
            .map((item) => getTokenKey(item))
            .join('|'),
          watchListItems,
          quoteCurrency: environment.settings.currencyInfo.id,
        },
      };
    })()
      .catch((): ISpotResult => ({ kind: 'failed' }))
      .then((result) => {
        settledSpotResult = result;
        return result;
      });

    const fallbackPayload: IMarketRuntimePayload = {
      categories: currentMarketPayload?.categories ?? [],
      earnRows: currentMarketPayload?.earnRows ?? [],
      favoriteMode: currentMarketPayload?.favoriteMode ?? 'recommendation',
      perpsHotRows: retainedPerpsHotRows,
      prefetchCategoryIds: currentMarketPayload?.prefetchCategoryIds ?? [],
      prefetchedRowsByRequestKey:
        currentMarketPayload?.prefetchedRowsByRequestKey ?? {},
      resolvedCategoryId:
        currentMarketPayload?.resolvedCategoryId ?? DEFAULT_MARKET_CATEGORY_ID,
      rows: currentMarketPayload?.rows ?? [],
      selectedCategoryId:
        currentMarketPayload?.selectedCategoryId ?? DEFAULT_MARKET_CATEGORY_ID,
      totalFavorites: currentMarketPayload?.totalFavorites ?? 0,
      watchListContentKey: currentMarketPayload?.watchListContentKey ?? '',
      watchListItems: currentMarketPayload?.watchListItems ?? [],
      quoteCurrency: environment.settings.currencyInfo.id,
    };
    const buildPayload = (
      spotResult: ISpotResult | undefined,
      perpsHotRows: IHomePopularTradingPayload['perpsHotRows'],
    ): IMarketRuntimePayload => ({
      ...(spotResult?.kind === 'ready' ? spotResult.payload : fallbackPayload),
      perpsHotRows,
      quoteCurrency: environment.settings.currencyInfo.id,
    });

    await Promise.race([spotResultPromise, perpsHotResultPromise]);
    const hasPendingBranch = !settledSpotResult || !settledPerpsHotResult;
    const hasFreshBranch =
      settledSpotResult?.kind === 'ready' ||
      settledPerpsHotResult?.kind === 'ready';
    const intermediatePayload = buildPayload(
      settledSpotResult,
      settledPerpsHotResult?.kind === 'ready'
        ? settledPerpsHotResult.rows
        : retainedPerpsHotRows,
    );
    const intermediateRowIds = getHomeMarketRowIds(intermediatePayload);
    if (hasPendingBranch && hasFreshBranch && intermediateRowIds.length > 0) {
      publishIntermediate({
        payload: intermediatePayload,
        rowIds: intermediateRowIds,
      });
    }

    const spotResult = settledSpotResult ?? (await spotResultPromise);
    const perpsHotResult =
      settledPerpsHotResult ?? (await perpsHotResultPromise);
    if (spotResult.kind === 'failed' && perpsHotResult.kind === 'failed') {
      throw new OneKeyLocalError('Home Market sources are unavailable');
    }
    const payload = buildPayload(
      spotResult,
      perpsHotResult.kind === 'ready'
        ? perpsHotResult.rows
        : retainedPerpsHotRows,
    );
    return { payload, rowIds: getHomeMarketRowIds(payload) };
  }

  private hydrateCache(
    sourceId: IHomeStoreSourceId,
    sourceKey: string,
    authority: IHomeResultAuthority,
    sink: IHomeResultSink<IHomeRuntimeJsonValue>,
  ): void {
    const entry = this.cache.get(sourceId)?.get(sourceKey);
    if (!entry) {
      return;
    }
    const state = this.host.getStateView();
    if (
      state.session.ownerToken?.scopeKey !== authority.ownerScopeKey ||
      state.session.ownerToken.sessionId !== authority.sessionId
    ) {
      return;
    }
    if (!isSectionSource(sourceId)) {
      const hydrationEvent: IHomeStoreEvent = {
        type: 'displaySnapshotHydrated',
        ownerScopeKey: authority.ownerScopeKey,
        sessionId: authority.sessionId,
        records: [
          {
            sourceId,
            sourceKeyIdentity: sourceKey,
            dataSchemaVersion: 1,
            coverageFingerprint: entry.coverageFingerprint,
            quoteBasis: null,
            confirmedAt: entry.expiresAt - SOURCE_CACHE_TTL_MS,
            expiresAt: entry.expiresAt,
            payload: entry.payload,
          },
        ],
      };
      if (sourceId === 'banner') {
        const payload = readHomeBannerStorePayload(entry.payload);
        const balanceEvent = payload
          ? this.createBalanceEvent({
              sourceId,
              payload,
              rowIds: [],
              empty: false,
            })
          : undefined;
        this.host.dispatchAtomically(
          balanceEvent ? [hydrationEvent, balanceEvent] : [hydrationEvent],
        );
      } else {
        this.host.dispatch(hydrationEvent);
      }
      sink.flushBuffered();
      return;
    }
    const currentResource = state.resources[sourceId];
    if (currentResource.kind === 'ready' || currentResource.kind === 'empty') {
      return;
    }
    const wire = entry.payload as ISectionWireResult;
    const sectionEvent: IHomeStoreEvent = {
      type: 'sectionSourceChanged',
      ownerToken: state.session.ownerToken,
      sectionId: sourceId,
      result: wire.empty
        ? { kind: 'empty' }
        : {
            kind: 'ready',
            rowIds: [...entry.rowIds],
            data: wire.payload ?? undefined,
            freshness: 'confirmedCache',
            refresh: 'refreshing',
          },
    };
    const balanceEvent =
      sourceId === 'portfolio' || sourceId === 'defi' || sourceId === 'perps'
        ? this.createBalanceEvent({
            sourceId,
            payload: wire.payload,
            rowIds: [...entry.rowIds],
            empty: wire.empty,
            freshness: 'confirmedCache',
            phase: entry.phase,
          })
        : undefined;
    this.host.dispatchAtomically(
      balanceEvent ? [sectionEvent, balanceEvent] : [sectionEvent],
    );
    sink.flushBuffered();
  }

  private rememberCache(
    sourceId: IHomeStoreSourceId,
    sourceKey: string,
    entry: ISourceCacheEntry,
  ): void {
    let entries = this.cache.get(sourceId);
    if (!entries) {
      entries = new Map();
      this.cache.set(sourceId, entries);
    }
    entries.delete(sourceKey);
    entries.set(sourceKey, entry);
    while (entries.size > SOURCE_CACHE_MAX_IDENTITIES) {
      const oldest = entries.keys().next().value as string | undefined;
      if (!oldest) {
        return;
      }
      entries.delete(oldest);
    }
  }

  private scheduleWarm(selected: IHomeSectionId | undefined): void {
    if (this.warmTimer) {
      return;
    }
    this.warmGeneration += 1;
    const generation = this.warmGeneration;
    this.warmTimer = setTimeout(() => {
      this.warmTimer = undefined;
      const warm = async () => {
        const candidates: IHomeSectionId[] = [
          ...(selected ? [selected] : []),
          'perps',
          'defi',
          'nft',
          'history',
          'market',
        ];
        const order = candidates.filter(
          (sourceId, index, all) =>
            sourceId !== 'portfolio' && all.indexOf(sourceId) === index,
        );
        for (const sourceId of order) {
          const state = this.host.getStateView();
          if (
            generation !== this.warmGeneration ||
            state.session.surfaceVisibility !== 'visible' ||
            state.session.appActivity !== 'active'
          ) {
            return;
          }
          await this.runSource(sourceId, 'background');
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
          });
        }
      };
      void warm();
    }, FIRST_FRAME_WARM_DELAY_MS);
  }

  private schedulePolling(): void {
    if (this.pollingTimer) {
      return;
    }
    this.pollingTimer = setTimeout(() => {
      this.pollingTimer = undefined;
      const state = this.host.getStateView();
      if (
        state.session.surfaceVisibility !== 'visible' ||
        state.session.appActivity !== 'active'
      ) {
        return;
      }
      if (!this.inFlight.has('portfolio')) {
        void this.runSource('portfolio', 'background', true);
      }
      const selected = sourceForSelectedTab(state);
      if (
        selected &&
        selected !== 'portfolio' &&
        !this.inFlight.has(selected)
      ) {
        void this.runSource(selected, 'background', true);
      }
      if (selected === 'perps' && !this.inFlight.has('market')) {
        void this.runSource('market', 'background', true);
      }
      this.schedulePolling();
    }, POLLING_INTERVAL_MS);
  }

  private stopTimers(): void {
    this.warmGeneration += 1;
    if (this.warmTimer) {
      clearTimeout(this.warmTimer);
      this.warmTimer = undefined;
    }
    if (this.pollingTimer) {
      clearTimeout(this.pollingTimer);
      this.pollingTimer = undefined;
    }
  }
}
