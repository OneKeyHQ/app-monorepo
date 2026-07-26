import BigNumber from 'bignumber.js';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { IAccountSelectorActiveAccountInfo } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import type { ISettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/settings';
import { USD_CURRENCY_ID } from '@onekeyhq/shared/src/consts/currencyConsts';
import { PERPS_NETWORK_ID } from '@onekeyhq/shared/src/consts/perp';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  HOME_RUNTIME_PROTOCOL_VERSION,
  type IHomeRuntimeJsonValue,
  type IRuntimeRequestPriority,
} from '@onekeyhq/shared/src/types/homeRuntime';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import defiUtils from '@onekeyhq/shared/src/utils/defiUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { mapSnapshotToPerpsHomeView } from '@onekeyhq/shared/src/utils/perpsHomeViewUtils';
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
} from '../../components/PopularTrading/constants';
import {
  getTokenKey,
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
  type IHomeResultSink,
  createHomeResultSink,
} from '../results/homeResultSink';
import {
  HOME_PERPS_REFERRAL_BANNER_ID,
  type IHomeBannerStorePayload,
  toHomeBannerStoreItem,
} from '../sections/banner/homeBannerStoreModel';
import { getHomeDeFiProtocolRowIds } from '../sections/defi/homeDeFiSourceAdapter';
import { getHomeHistoryRowIds } from '../sections/history/homeHistorySourceAdapter';
import { getHomeMarketRowIds } from '../sections/market/homeMarketSourceAdapter';
import { getHomeNFTItemRowId } from '../sections/nft/homeNFTSourceAdapter';
import { HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID } from '../sections/spot/homePortfolioControls';
import {
  type IHomeSpotLegacyPayload,
  createHomeSpotSnapshotDefaults,
} from '../sections/spot/homeSpotSourceAdapter';
import {
  normalizeHomeStoreJson,
  readHomeStoreSectionPayload,
} from '../store/homeStoreJson';

import { AllNetworkAccountRepository } from './AllNetworkAccountRepository';

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
  getState(): IHomeStoreState;
}

type ISectionWireResult = {
  [key: string]: IHomeRuntimeJsonValue;
  empty: boolean;
  error: boolean;
  payload: IHomeRuntimeJsonValue | null;
  rowIds: IHomeRuntimeJsonValue[];
};

type ISourceCacheEntry = {
  dataRevision: number;
  expiresAt: number;
  payload: IHomeRuntimeJsonValue;
  rowIds: readonly string[];
};

const SOURCE_CACHE_TTL_MS = 30_000;
const SOURCE_CACHE_MAX_IDENTITIES = 8;
const FIRST_FRAME_WARM_DELAY_MS = 800;
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

function sumTokenValue(response: IFetchAccountTokensResp): string {
  return [
    response.tokens.fiatValue,
    response.smallBalanceTokens.fiatValue,
    response.riskTokens.fiatValue,
  ]
    .reduce(
      (total, value) =>
        value === undefined ? total : total.plus(new BigNumber(value)),
      new BigNumber(0),
    )
    .toFixed();
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
    control =
      state.interaction.sectionControls.portfolio?.[
        HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID
      ];
  }
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

  private readonly lastLoadedKey = new Map<IHomeStoreSourceId, string>();

  private readonly inFlight = new Map<
    IHomeStoreSourceId,
    { key: string; taskId: string }
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
      previous?.activeAccount.wallet?.id !==
        environment.activeAccount.wallet?.id ||
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
    const state = this.host.getState();
    const session = state.session;
    const ready =
      session.authority === 'ready' &&
      Boolean(session.ownerToken && session.producerInstanceId) &&
      this.environment.activeAccount.ready;
    if (!ready || session.surfaceVisibility !== 'visible') {
      this.stopTimers();
      return;
    }
    this.sinks.forEach((sink) => sink.flushBuffered());
    void this.runSource('capability', 'critical');
    void this.runSource('banner', 'critical');
    void this.runSource('portfolio', 'critical');
    const selected = sourceForSelectedTab(state);
    if (selected && selected !== 'portfolio') {
      void this.runSource(selected, 'interactive');
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
    this.inFlight.clear();
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
      await this.runSource(intent.sectionId, 'interactive', true);
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
    const state = this.host.getState();
    void this.runSource('capability', 'critical', true);
    void this.runSource('banner', 'critical', true);
    void this.runSource('portfolio', 'critical', true);
    const selected = sourceForSelectedTab(state);
    if (selected && selected !== 'portfolio') {
      void this.runSource(selected, 'interactive', true);
    }
  }

  updateTokenListDemands(demands: readonly IHomeTokenListDemand[]): void {
    const state = this.host.getState();
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
    const state = this.host.getState();
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
    const sourceKey = buildSourceKey({ environment, sourceId, state });
    if (!force && this.lastLoadedKey.get(sourceId) === sourceKey) {
      return { kind: 'ignored' };
    }
    if (!force && this.inFlight.get(sourceId)?.key === sourceKey) {
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

    this.inFlight.set(sourceId, { key: sourceKey, taskId });
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
          environment,
          force,
          priority,
          sink,
          sourceId,
          sourceKey,
          yieldIfMainBudgetExceeded: () => yieldIfMainBudgetExceeded(),
        });
        if (
          this.activeAuthority.get(sourceId) === authority &&
          !signal.aborted
        ) {
          this.lastLoadedKey.set(sourceId, sourceKey);
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
    if (this.host.getState().session.surfaceVisibility !== 'visible') {
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
        const state = this.host.getState();
        if (
          this.activeAuthority.get(sourceId) !== authority ||
          state.session.ownerToken?.sessionId !== authority.sessionId
        ) {
          return;
        }
        if (sourceId === 'banner') {
          this.host.dispatch({
            type: 'sourceRequested',
            token: {
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
            },
          });
        } else if (isSectionSource(sourceId) && state.session.ownerToken) {
          this.host.dispatch({
            type: 'sectionSourceChanged',
            ownerToken: state.session.ownerToken,
            sectionId: sourceId,
            result: { kind: 'loading' },
          });
        }
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
        const state = this.host.getState();
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
      commit: ({ materialized, publicationRevision }) => {
        this.commitWireResult({
          authority,
          publicationRevision,
          sourceId,
          wire: materialized.model,
        });
      },
    });
  }

  private async loadAndPublish({
    environment,
    force,
    priority,
    sink,
    sourceId,
    sourceKey,
    yieldIfMainBudgetExceeded,
  }: {
    environment: IHomeSourceEnvironment;
    force: boolean;
    priority: IRuntimeRequestPriority;
    sink: IHomeResultSink<IHomeRuntimeJsonValue>;
    sourceId: IHomeStoreSourceId;
    sourceKey: string;
    yieldIfMainBudgetExceeded: () => Promise<void>;
  }): Promise<void> {
    try {
      if (sourceId === 'capability') {
        const facts = await this.loadCapability(environment);
        this.publishModel(sink, facts, 'final');
        return;
      }
      if (sourceId === 'banner') {
        const payload = await this.loadBanner(environment, priority);
        this.publishModel(sink, payload, 'final');
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
        }
      };
      const section = await this.loadSection({
        environment,
        force,
        priority,
        publishIntermediate,
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
        dataRevision: this.dataRevision,
        expiresAt: Date.now() + SOURCE_CACHE_TTL_MS,
        payload: wire,
        rowIds: section.rowIds,
      });
    } catch {
      if (isSectionSource(sourceId)) {
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

  private publishModel(
    sink: IHomeResultSink<IHomeRuntimeJsonValue>,
    model: unknown,
    phase: 'intermediate' | 'final',
  ): void {
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
    publicationRevision,
    sourceId,
    wire,
  }: {
    authority: IHomeResultAuthority;
    publicationRevision: number;
    sourceId: IHomeStoreSourceId;
    wire: IHomeRuntimeJsonValue;
  }): void {
    const state = this.host.getState();
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
      const token = {
        protocolVersion: HOME_RUNTIME_PROTOCOL_VERSION,
        clientInstanceId: authority.clientInstanceId,
        producerInstanceId: authority.producerInstanceId,
        sessionId: authority.sessionId,
        requestSeq: authority.requestSequence,
        sourceKey: {
          scopeKey: authority.ownerScopeKey,
          sourceId: 'banner' as const,
          paramsFingerprint: authority.sourceKey,
          dataSchemaVersion: 1,
        },
      };
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
            data: wire as IHomeBannerStorePayload,
            coverageFingerprint: `banner:${publicationRevision}`,
          },
        },
      };
      const balanceEvent = this.createBalanceEvent({
        sourceId: 'banner',
        payload: wire,
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
    const sectionWire = wire as ISectionWireResult;
    let sectionResult: Extract<
      IHomeStoreEvent,
      { type: 'sectionSourceChanged' }
    >['result'];
    if (sectionWire.error) {
      sectionResult = { kind: 'error' };
    } else if (sectionWire.empty) {
      sectionResult = { kind: 'empty' };
    } else {
      sectionResult = {
        kind: 'ready',
        rowIds: sectionWire.rowIds as string[],
        data: sectionWire.payload ?? undefined,
        freshness: 'live',
        refresh: 'idle',
      };
    }
    const sectionEvent: IHomeStoreEvent = {
      type: 'sectionSourceChanged',
      ownerToken,
      sectionId: sourceId,
      result: sectionResult,
    };
    const balanceEvent =
      sourceId === 'portfolio' || sourceId === 'defi' || sourceId === 'perps'
        ? this.createBalanceEvent({
            sourceId,
            payload: sectionWire.payload,
            rowIds: sectionWire.rowIds as string[],
            empty: sectionWire.empty,
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
  }): IHomeStoreEvent | undefined {
    const state = this.host.getState();
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
      id,
      positiveEvidence,
    }: {
      amount: BigNumber.Value | undefined;
      id: IHomeBalanceContributorId;
      positiveEvidence: boolean;
    }): IHomeBalanceContributorFact => {
      let resource = state.resources[id];
      if (override?.sourceId === id) {
        if (override.empty) {
          resource = {
            kind: 'empty',
            coverageFingerprint: 'empty:v2',
            freshness: 'live',
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
                freshness: 'live',
                refresh: 'idle',
              },
            },
            coverageFingerprint: [
              override.rowIds.length,
              override.rowIds[0] ?? '',
              override.rowIds[override.rowIds.length - 1] ?? '',
            ].join(':'),
            freshness: 'live',
            refresh: 'idle',
          };
        }
      }
      let factResource: IHomeFactResource<{
        amount: string;
        positiveEvidence: boolean;
      }>;
      const normalizedAmount = new BigNumber(amount ?? 0);
      if (resource.kind === 'error') {
        factResource = {
          kind: 'error',
          errorKind: resource.errorKind,
        };
      } else if (resource.kind === 'ready' || resource.kind === 'empty') {
        const data = {
          amount: normalizedAmount.isFinite()
            ? normalizedAmount.toFixed()
            : '0',
          positiveEvidence,
        };
        factResource = {
          kind: 'complete',
          result:
            resource.kind === 'empty' || normalizedAmount.isZero()
              ? { kind: 'empty' }
              : { kind: 'success', data },
          coverageFingerprint: resource.coverageFingerprint,
        };
      } else if (resource.kind === 'partial') {
        factResource = {
          kind: 'partial',
          data: {
            amount: normalizedAmount.isFinite()
              ? normalizedAmount.toFixed()
              : '0',
            positiveEvidence,
          },
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
    const portfolioAmount = portfolio?.accountTokensValue;
    const defiAmount = defi?.overview.netWorth;
    const perpsAmount = perps?.view.accountValueUsd;
    const contributors = {
      portfolio: makeContributor({
        id: 'portfolio',
        amount: portfolioAmount,
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
          (override.payload as unknown as IHomeBannerStorePayload).banners
            .length > 0) ||
        (state.resources.banner.kind === 'ready' &&
          Boolean(
            (state.resources.banner.data as IHomeBannerStorePayload | undefined)
              ?.banners.length,
          )),
    };
    return {
      type: 'balanceChanged',
      facts: { ...facts, balance },
      observedAt: Date.now(),
    };
  }

  private async loadCapability(
    environment: IHomeSourceEnvironment,
  ): Promise<IHomeCapabilityFacts> {
    const state = this.host.getState();
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
          .run('critical', () =>
            backgroundApiProxy.serviceDeFi.getDeFiEnabledNetworksMapState({
              syncIfEmpty: true,
            }),
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
  ): Promise<IHomeBannerStorePayload> {
    const { account, network, vaultSettings, wallet } =
      environment.activeAccount;
    if (!account || !network || !wallet) {
      throw new OneKeyLocalError('Home banner owner is unavailable');
    }
    const [remote, local, botDeactivated, referralEligibility] =
      await Promise.all([
        this.host.leafPool
          .run(priority, () =>
            backgroundApiProxy.serviceWalletBanner.fetchWalletBanner({
              accountId: account.id,
            }),
          )
          .catch(() => undefined),
        this.host.leafPool
          .run(priority, () =>
            backgroundApiProxy.simpleDb.walletBanner.getRawData(),
          )
          .catch(() => undefined),
        accountUtils.isBotWallet({ walletId: wallet.id })
          ? this.host.leafPool
              .run(priority, () =>
                backgroundApiProxy.serviceAccount.isBotWalletDeactivated({
                  walletId: wallet.id,
                }),
              )
              .catch(() => false)
          : false,
        this.host.leafPool
          .run(priority, async () => {
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
          })
          .catch(() => null),
      ]);
    const closedForever = local?.closedForever ?? {};
    const dismissedIds = new Set(
      this.host.getState().interaction.dismissedBannerIds,
    );
    const banners = (remote ?? local?.topBanners ?? []).filter(
      (banner) =>
        (!banner.position || banner.position === 'home') &&
        (!banner.networkIds?.length ||
          banner.networkIds.includes(network.id)) &&
        !closedForever[banner.id] &&
        !dismissedIds.has(banner.id),
    );
    if (remote) {
      void backgroundApiProxy.serviceWalletBanner.updateLocalTopBanners({
        topBanners: remote,
      });
    }
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
      isBotWalletReceiveBlocked: botDeactivated,
    };
  }

  private async loadSection({
    environment,
    force,
    priority,
    publishIntermediate,
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
    sourceId: IHomeSectionId;
    yieldIfMainBudgetExceeded: () => Promise<void>;
  }): Promise<{ payload: unknown; rowIds: readonly string[] }> {
    if (sourceId === 'portfolio') {
      return this.loadPortfolio({
        environment,
        force,
        priority,
        publishIntermediate,
        yieldIfMainBudgetExceeded,
      });
    }
    if (sourceId === 'nft') {
      return this.loadNFT(environment, force, priority);
    }
    if (sourceId === 'defi') {
      return this.loadDeFi(environment, force, priority);
    }
    if (sourceId === 'history') {
      return this.loadHistory(environment, force, priority);
    }
    if (sourceId === 'perps') {
      return this.loadPerps(environment, priority);
    }
    return this.loadMarket(environment, priority);
  }

  private async loadPortfolio({
    environment,
    force,
    priority,
    publishIntermediate,
    yieldIfMainBudgetExceeded,
  }: {
    environment: IHomeSourceEnvironment;
    force: boolean;
    priority: IRuntimeRequestPriority;
    publishIntermediate: (input: {
      payload: unknown;
      rowIds: readonly string[];
    }) => void;
    yieldIfMainBudgetExceeded: () => Promise<void>;
  }): Promise<{ payload: IHomeSpotLegacyPayload; rowIds: readonly string[] }> {
    const { account, indexedAccount, network, vaultSettings, wallet } =
      environment.activeAccount;
    const state = this.host.getState();
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
          .run(priority, () =>
            backgroundApiProxy.serviceDeFi.isNetworkDeFiEnabled(network.id),
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
    await this.host.leafPool.run(priority, () =>
      backgroundApiProxy.serviceToken.updateCurrentAccount({
        accountId: account.id,
        networkId: network.id,
      }),
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
                .run(priority, () =>
                  backgroundApiProxy.serviceNetwork.getVaultSettings({
                    networkId: target.networkId,
                  }),
                )
                .then((settings) => Boolean(settings?.mergeDeriveAssetsEnabled))
                .catch(() => false);
        mergeDeriveByNetworkId.set(target.networkId, mergeDerivePromise);
      }
      const [response, mergeDeriveAssets] = await Promise.all([
        this.host.leafPool.run(priority, () =>
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
          await onProgress(responses);
        }
      }
      return responses;
    };
    const fetchCachedTargets = async (
      targets: readonly IPortfolioFetchTarget[],
    ) => {
      const responses: INativeHomeAllNetworkTokenResponse[] = [];
      for (let index = 0; index < targets.length; index += 4) {
        const chunk = targets.slice(index, index + 4);
        const settled = await Promise.allSettled(
          chunk.map(async (target) => {
            const cached = await this.host.leafPool.run(priority, () =>
              backgroundApiProxy.serviceToken.getAccountLocalTokens({
                accountId: target.accountId,
                networkId: target.networkId,
                accountAddress: target.accountAddress,
                xpub: target.accountXpub,
              }),
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
                fiatValue: cached.tokenListValue,
                keys: cached.tokenList.map((token) => token.$key).join('_'),
                map: pickMap(cached.tokenList),
              },
              smallBalanceTokens: {
                data: cached.smallBalanceTokenList,
                fiatValue: '0',
                keys: cached.smallBalanceTokenList
                  .map((token) => token.$key)
                  .join('_'),
                map: pickMap(cached.smallBalanceTokenList),
              },
              riskTokens: {
                data: cached.riskyTokenList,
                fiatValue: '0',
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
        if (responses.length > 0) {
          const intermediate = await this.buildPortfolioPayload({
            environment,
            mergeDeriveAddressData,
            priority,
            responses: [...responses],
            shouldIngest: true,
            showLpTokenFilterSwitch,
            showLpTokensOnly: false,
          });
          publishIntermediate({
            payload: intermediate,
            rowIds: intermediate.displayIds,
          });
          await yieldIfMainBudgetExceeded();
        }
      }
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
      const { networkAccounts } = await this.host.leafPool.run(priority, () =>
        backgroundApiProxy.serviceAccount.getNetworkAccountsInSameIndexedAccountIdWithDeriveTypes(
          {
            networkId: network.id,
            indexedAccountId: indexedAccount.id,
            excludeEmptyAccount: true,
          },
        ),
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
        : async (responses) => {
            const intermediate = await this.buildPortfolioPayload({
              environment,
              mergeDeriveAddressData,
              priority,
              responses: [...responses],
              shouldIngest: true,
              showLpTokenFilterSwitch,
              showLpTokensOnly: false,
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
      onProgress: async (responses) => {
        const intermediate = await this.buildPortfolioPayload({
          environment,
          mergeDeriveAddressData,
          priority,
          responses: [...responses],
          shouldIngest: false,
          showLpTokenFilterSwitch,
          showLpTokensOnly: true,
          valuationPayload: walletPayload,
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
    shouldIngest,
    showLpTokenFilterSwitch,
    showLpTokensOnly,
    valuationPayload,
  }: {
    environment: IHomeSourceEnvironment;
    mergeDeriveAddressData: boolean;
    priority: IRuntimeRequestPriority;
    responses: INativeHomeAllNetworkTokenResponse[];
    shouldIngest: boolean;
    showLpTokenFilterSwitch: boolean;
    showLpTokensOnly: boolean;
    valuationPayload?: IHomeSpotLegacyPayload;
  }): Promise<IHomeSpotLegacyPayload> {
    const { account, network } = environment.activeAccount;
    const projection = buildNativeHomeAllNetworkPortfolioProjection({
      responses,
    });
    const networksMap = await this.getAllNetworksMap();
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
    const ownerKey = this.host.getState().session.ownerToken?.scopeKey ?? '';
    const accountTokensValue =
      valuationPayload?.accountTokensValue ??
      responses
        .reduce(
          (total, response) => total.plus(sumTokenValue(response)),
          new BigNumber(0),
        )
        .toFixed();
    const payload: IHomeSpotLegacyPayload = {
      ...createHomeSpotSnapshotDefaults(),
      accountTokensValue,
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
      await this.ingestTokenListPayload(payload, priority);
    }
    return payload;
  }

  private async ingestTokenListPayload(
    payload: IHomeSpotLegacyPayload,
    priority: IRuntimeRequestPriority,
  ): Promise<void> {
    const { account, network } = this.environment?.activeAccount ?? {};
    if (!account || !network || !payload.ownerKey) {
      return;
    }
    await this.host.leafPool.run(priority, () =>
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
    );
  }

  private getAllNetworksMap(): Promise<IHomeSpotLegacyPayload['networksMap']> {
    const now = Date.now();
    if (this.allNetworksMapCache && this.allNetworksMapCache.expiresAt > now) {
      return Promise.resolve(this.allNetworksMapCache.value);
    }
    if (this.allNetworksMapPromise) {
      return this.allNetworksMapPromise;
    }
    this.allNetworksMapPromise = this.host.leafPool
      .run('background', () =>
        backgroundApiProxy.serviceNetwork.getAllNetworks({
          excludeTestNetwork: true,
        }),
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
  ): Promise<{ payload: { data: unknown[] }; rowIds: readonly string[] }> {
    const { account, indexedAccount, network, wallet } =
      environment.activeAccount;
    if (!account || !network) {
      throw new OneKeyLocalError('Home NFT owner is unavailable');
    }
    await this.host.leafPool.run(priority, () =>
      backgroundApiProxy.serviceNFT.updateCurrentAccount({
        accountId: account.id,
        networkId: network.id,
      }),
    );
    const fetch = (
      accountId: string,
      networkId: string,
      dbAccount?: IAccountSelectorActiveAccountInfo['dbAccount'],
    ) =>
      this.host.leafPool.run(priority, () =>
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
  ): Promise<{ payload: unknown; rowIds: readonly string[] }> {
    const { account, indexedAccount, network, wallet } =
      environment.activeAccount;
    if (!account || !network) {
      throw new OneKeyLocalError('Home DeFi owner is unavailable');
    }
    await this.host.leafPool.run(priority, () =>
      backgroundApiProxy.serviceDeFi.updateCurrentAccount({
        accountId: account.id,
        networkId: network.id,
      }),
    );
    const sourceCurrencyInfo =
      environment.currencyMap[environment.settings.currencyInfo.id];
    const targetCurrencyInfo = environment.currencyMap.usd;
    const fetch = (accountId: string, networkId: string) =>
      this.host.leafPool.run(priority, () =>
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
      .run(priority, () =>
        backgroundApiProxy.serviceDeFi.fetchSupportedDeFiProtocols(),
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
    const response = await this.host.leafPool.run(priority, () =>
      mergeDerive
        ? backgroundApiProxy.serviceHistory.fetchAccountHistoryForMergeDerive({
            ...common,
            indexedAccountId: indexedAccountId ?? '',
          })
        : backgroundApiProxy.serviceHistory.fetchAccountHistory({
            ...common,
            accountId: account.id,
            indexedAccountId: network.isAllNetworks
              ? indexedAccount?.id
              : undefined,
          }),
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
  ): Promise<{ payload: unknown; rowIds: readonly string[] }> {
    const { account, indexedAccount } = environment.activeAccount;
    if (!account) {
      throw new OneKeyLocalError('Home Perps owner is unavailable');
    }
    const deriveType = await this.host.leafPool.run(priority, () =>
      backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: PERPS_NETWORK_ID,
      }),
    );
    const networkAccount = await this.host.leafPool.run(priority, () =>
      backgroundApiProxy.serviceAccount.getNetworkAccount({
        accountId: indexedAccount ? undefined : account.id,
        indexedAccountId: indexedAccount?.id,
        deriveType,
        networkId: PERPS_NETWORK_ID,
      }),
    );
    const address =
      networkAccount?.addressDetail?.normalizedAddress ??
      networkAccount?.address ??
      '';
    const snapshot = address
      ? await this.host.leafPool.run(priority, () =>
          backgroundApiProxy.serviceHyperliquid.getHyperliquidPortfolioSnapshot(
            { address },
          ),
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
      scopeKey: this.host.getState().session.ownerToken?.scopeKey,
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
  ): Promise<{ payload: unknown; rowIds: readonly string[] }> {
    const state = this.host.getState();
    const selectedControl =
      state.interaction.sectionControls.market?.[
        'home.market.selectedCategory'
      ];
    const [configResponse, watchList] = await Promise.all([
      this.host.leafPool.run(priority, () =>
        backgroundApiProxy.serviceMarketV2.fetchMarketBasicConfig(),
      ),
      this.host.leafPool.run(priority, () =>
        backgroundApiProxy.serviceMarketV2.getMarketWatchListV2(),
      ),
    ]);
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
    const response = await this.host.leafPool.run(priority, () =>
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
    );
    const rows = response.list
      .map(mapMarketTokenToDisplay)
      .filter((item): item is NonNullable<typeof item> => item !== null);
    const payload = {
      categories,
      earnRows: [],
      favoriteMode:
        watchList.data.length > 0
          ? ('favorites' as const)
          : ('recommendation' as const),
      perpsHotRows: [],
      prefetchCategoryIds: [],
      prefetchedRowsByRequestKey: {},
      resolvedCategoryId,
      rows,
      selectedCategoryId: resolvedCategoryId,
      totalFavorites: watchList.data.length,
      watchListContentKey: watchList.data
        .map((item) => getTokenKey(item))
        .join('|'),
      watchListItems: watchList.data,
      quoteCurrency: environment.settings.currencyInfo.id,
    };
    return { payload, rowIds: getHomeMarketRowIds(payload) };
  }

  private hydrateCache(
    sourceId: IHomeStoreSourceId,
    sourceKey: string,
    authority: IHomeResultAuthority,
    sink: IHomeResultSink<IHomeRuntimeJsonValue>,
  ): void {
    if (!isSectionSource(sourceId)) {
      return;
    }
    const entry = this.cache.get(sourceId)?.get(sourceKey);
    if (!entry || entry.expiresAt <= Date.now()) {
      return;
    }
    const state = this.host.getState();
    if (
      state.session.ownerToken?.scopeKey !== authority.ownerScopeKey ||
      state.session.ownerToken.sessionId !== authority.sessionId
    ) {
      return;
    }
    const wire = entry.payload as ISectionWireResult;
    this.host.dispatch({
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
    });
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
          const state = this.host.getState();
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
      const state = this.host.getState();
      if (
        state.session.surfaceVisibility !== 'visible' ||
        state.session.appActivity !== 'active'
      ) {
        return;
      }
      void this.runSource('portfolio', 'background', true);
      const selected = sourceForSelectedTab(state);
      if (selected && selected !== 'portfolio') {
        void this.runSource(selected, 'background', true);
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
