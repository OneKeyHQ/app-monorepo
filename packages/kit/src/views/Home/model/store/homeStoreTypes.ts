import type {
  IHomeRuntimeJsonValue,
  IHomeRuntimeOwnerScope,
  IHomeRuntimeOwnerToken,
  IHomeRuntimeQuoteBasis,
  IHomeRuntimeRequestToken,
  IHomeRuntimeResponseEnvelope,
  IHomeRuntimeSourceKey,
  IHomeRuntimeTopology,
} from '@onekeyhq/shared/src/types/homeRuntime';

import type { IHomeConfirmedBalanceRecord } from '../cache/homeConfirmedBalanceCacheReducer';
import type { IHomeCapabilityFacts } from '../capabilities/homeCapabilityTypes';
import type { IHomeBalanceFacts, IHomeFacts } from '../facts/homeFacts';
import type { IHomeBannerStorePayload } from '../sections/banner/homeBannerStoreModel';
import type {
  IHomeNavigationSemanticModel,
  IHomeSectionId,
  IHomeSectionSemanticModel,
  IHomeShellSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';

export const HOME_STORE_SOURCE_IDS = [
  'capability',
  'banner',
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
  'market',
] as const;

export const HOME_STORE_SECTION_IDS = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
  'market',
] as const satisfies readonly IHomeSectionId[];

export type IHomeStoreSourceId = (typeof HOME_STORE_SOURCE_IDS)[number];

export type IHomeStoreSourcePayloadMap = {
  capability: IHomeRuntimeJsonValue;
  banner: IHomeBannerStorePayload;
  portfolio: IHomeRuntimeJsonValue;
  perps: IHomeRuntimeJsonValue;
  defi: IHomeRuntimeJsonValue;
  nft: IHomeRuntimeJsonValue;
  history: IHomeRuntimeJsonValue;
  market: IHomeRuntimeJsonValue;
};

export type IHomeStoreRequestToken<TSourceId extends IHomeStoreSourceId> = Omit<
  IHomeRuntimeRequestToken,
  'sourceKey'
> & {
  sourceKey: Omit<IHomeRuntimeSourceKey, 'sourceId'> & {
    sourceId: TSourceId;
  };
};

type IHomeStoreSourceResponseEnvelope<TSourceId extends IHomeStoreSourceId> =
  Omit<
    IHomeRuntimeResponseEnvelope<IHomeStoreSourcePayloadMap[TSourceId]>,
    'token'
  > & {
    token: IHomeStoreRequestToken<TSourceId>;
  };

type IHomeStoreSourceRespondedEvent = {
  type: 'sourceResponded';
  envelope: IHomeStoreSourceResponseEnvelope<IHomeStoreSourceId>;
};

export type IHomeStoreResourceSlot<TPayload extends IHomeRuntimeJsonValue> =
  | { kind: 'idle' }
  | { kind: 'loading'; token: IHomeRuntimeRequestToken }
  | {
      kind: 'partial';
      token: IHomeRuntimeRequestToken;
      data: TPayload;
      coverageFingerprint: string;
    }
  | {
      kind: 'ready';
      token?: IHomeRuntimeRequestToken;
      data?: TPayload;
      coverageFingerprint: string;
      confirmedCacheSourceKeyIdentity?: string;
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    }
  | {
      kind: 'empty';
      token?: IHomeRuntimeRequestToken;
      coverageFingerprint: string;
      confirmedCacheSourceKeyIdentity?: string;
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    }
  | {
      kind: 'error';
      token?: IHomeRuntimeRequestToken;
      errorKind:
        | 'source'
        | 'transport'
        | 'schemaMismatch'
        | 'runtimeUnavailable';
    };

export type IHomeStoreResourcesState = {
  readonly [TSourceId in IHomeStoreSourceId]: IHomeStoreResourceSlot<
    IHomeStoreSourcePayloadMap[TSourceId]
  >;
};

export type IHomeStoreSessionState = {
  owner?: IHomeRuntimeOwnerScope;
  ownerToken?: IHomeRuntimeOwnerToken;
  status: 'idle' | 'waitingForProducer' | 'ready' | 'degraded' | 'stopped';
};

export type IHomeStoreRuntimeState = {
  topology: IHomeRuntimeTopology;
  connection: 'waiting' | 'ready' | 'degraded' | 'stopped';
  producerInstanceId?: string;
  protocolVersion: number;
};

export type IHomeStoreWalletInputs = IHomeFacts['wallet'];
export type IHomeStoreEnvironmentInputs = IHomeFacts['environment'];
export type IHomeStoreCapabilityInputs = IHomeFacts['capabilityInputs'];

export type IHomeStoreInteractionState = {
  preferredTabId?: IHomeTabId;
  dismissedBannerIds: readonly string[];
  sectionControls: Readonly<
    Partial<
      Record<IHomeSectionId, Readonly<Record<string, IHomeRuntimeJsonValue>>>
    >
  >;
  visibility: 'foreground' | 'background';
  acceptedIntentIds: readonly string[];
  pendingSectionCommands: readonly IHomeStorePendingSectionCommand[];
  pendingShellCommands: readonly IHomeStorePendingShellCommand[];
};

export type IHomeStoreShellSlice = {
  presentationRevision: number;
  shellCommandRevision: number;
  value: IHomeShellSemanticModel;
};

export type IHomeStoreNavigationSlice = {
  presentationRevision: number;
  tabApplicabilityRevision: number;
  value: IHomeNavigationSemanticModel;
};

export type IHomeStoreSectionSlice = {
  presentationRevision: number;
  sectionCommandRevision: number;
  value: IHomeSectionSemanticModel;
};

export type IHomeStoreSectionsState = Readonly<
  Record<IHomeSectionId, IHomeStoreSectionSlice>
>;

export type IHomeStoreDiagnosticsState = {
  acceptedEventCount: number;
  rejectedEventCount: number;
  staleRejectCount: number;
  lastRejectReason?: IHomeStoreRejectReason;
};

export type IHomeStoreCommitIdentity = {
  storeCommitId: number;
  origin?: 'cacheHydrate' | 'storeEvent';
  changedSourceIds?: readonly IHomeStoreSourceId[];
  presentationChanged?: boolean;
  ownerChanged?: boolean;
};

export type IHomeStoreState = {
  session: IHomeStoreSessionState;
  runtime: IHomeStoreRuntimeState;
  walletInputs: IHomeStoreWalletInputs;
  environmentInputs: IHomeStoreEnvironmentInputs;
  capabilityInputs: IHomeStoreCapabilityInputs;
  facts?: IHomeFacts;
  resources: IHomeStoreResourcesState;
  balanceRound?: IHomeBalanceFacts;
  confirmedBalance?: IHomeConfirmedBalanceRecord;
  interaction: IHomeStoreInteractionState;
  shell: IHomeStoreShellSlice;
  navigation: IHomeStoreNavigationSlice;
  sections: IHomeStoreSectionsState;
  diagnostics: IHomeStoreDiagnosticsState;
  commitIdentity: IHomeStoreCommitIdentity;
};

export type IHomeStoreIntentAuthority =
  | { kind: 'shellCommands'; revision: number }
  | { kind: 'tabApplicability'; revision: number }
  | {
      kind: 'sectionCommands';
      sectionId: IHomeSectionId;
      revision: number;
    };

type IHomeStoreIntentBase = {
  owner: IHomeRuntimeOwnerScope;
  sessionId: string;
  intentId: string;
  authority: IHomeStoreIntentAuthority;
};

export type IHomeStoreIntent =
  | (IHomeStoreIntentBase & {
      type: 'tabSelected';
      tabId: IHomeTabId;
      authority: { kind: 'tabApplicability'; revision: number };
    })
  | (IHomeStoreIntentBase & {
      type: 'tabHandoffInvoked';
      tabId: IHomeTabId;
      actionId: string;
      authority: { kind: 'tabApplicability'; revision: number };
    })
  | (IHomeStoreIntentBase & {
      type: 'headerActionInvoked';
      actionId: string;
      itemId?: string;
      execution?: 'caller' | 'controller';
      authority: { kind: 'shellCommands'; revision: number };
    })
  | (IHomeStoreIntentBase & {
      type: 'sectionActionInvoked' | 'sectionRefreshRequested';
      sectionId: IHomeSectionId;
      actionId: string;
      itemId?: string;
      commandPayload?: IHomeRuntimeJsonValue;
      execution?: 'caller' | 'controller';
      authority: {
        kind: 'sectionCommands';
        sectionId: IHomeSectionId;
        revision: number;
      };
    })
  | (IHomeStoreIntentBase & {
      type: 'sectionControlChanged';
      sectionId: IHomeSectionId;
      controlId: string;
      value: IHomeRuntimeJsonValue;
      authority: {
        kind: 'sectionCommands';
        sectionId: IHomeSectionId;
        revision: number;
      };
    });

export type IHomeStorePendingSectionCommand = Extract<
  IHomeStoreIntent,
  { type: 'sectionActionInvoked' | 'sectionRefreshRequested' }
> & { execution: 'controller' };

export type IHomeStorePendingShellCommand = Extract<
  IHomeStoreIntent,
  { type: 'headerActionInvoked' }
> & { execution: 'controller' };

export type IHomeStoreSectionSourceResult =
  | { kind: 'hidden'; reason: 'notApplicable' | 'capabilityNotReady' }
  | { kind: 'loading' }
  | {
      kind: 'ready';
      rowIds: readonly string[];
      data?: IHomeRuntimeJsonValue;
      freshness: 'live' | 'confirmedCache';
      refresh: 'idle' | 'refreshing' | 'failed';
    }
  | { kind: 'empty' }
  | { kind: 'error' };

export type IHomeStoreEvent =
  | {
      type: 'ownerChanged';
      owner?: IHomeRuntimeOwnerScope;
      ownerToken?: IHomeRuntimeOwnerToken;
      topology: IHomeRuntimeTopology;
    }
  | {
      type: 'factsChanged';
      facts: IHomeFacts;
    }
  | {
      type: 'runtimeChanged';
      runtime: IHomeStoreRuntimeState;
    }
  | { type: 'balanceChanged'; facts: IHomeFacts; observedAt: number }
  | { type: 'capabilityChanged'; facts: IHomeCapabilityFacts }
  | {
      type: 'sectionSourceChanged';
      ownerToken: IHomeRuntimeOwnerToken;
      sectionId: IHomeSectionId;
      result: IHomeStoreSectionSourceResult;
    }
  | {
      type: 'sectionReset';
      ownerToken: IHomeRuntimeOwnerToken;
      sectionId: IHomeSectionId;
    }
  | { type: 'sourceRequested'; token: IHomeRuntimeRequestToken }
  | IHomeStoreSourceRespondedEvent
  | {
      type: 'confirmedSnapshotHydrated';
      ownerScopeKey: string;
      sessionId: string;
      records: readonly IHomeCachedSourceRecord[];
      selectedTabPreference?: IHomeTabId;
    }
  | {
      type: 'displaySnapshotHydrated';
      ownerScopeKey: string;
      sessionId: string;
      records: readonly IHomeCachedSourceRecord[];
      shell?: IHomeShellSemanticModel;
      navigation?: IHomeNavigationSemanticModel;
      selectedTabPreference?: IHomeTabId;
    }
  | { type: 'intentReceived'; intent: IHomeStoreIntent }
  | {
      type: 'commandHandled';
      ownerToken: IHomeRuntimeOwnerToken;
      intentId: string;
    }
  | { type: 'visibilityChanged'; visibility: 'foreground' | 'background' }
  | { type: 'stopped' };

export type IHomeSetOrReset<T> = { kind: 'set'; value: T } | { kind: 'reset' };

type IHomeStoreResourceMutation = {
  slice: 'resource';
  sourceId: IHomeStoreSourceId;
  operation: IHomeSetOrReset<IHomeStoreResourceSlot<IHomeRuntimeJsonValue>>;
};

export type IHomeStoreMutation =
  | { slice: 'session'; operation: IHomeSetOrReset<IHomeStoreSessionState> }
  | { slice: 'runtime'; operation: IHomeSetOrReset<IHomeStoreRuntimeState> }
  | {
      slice: 'walletInputs';
      operation: IHomeSetOrReset<IHomeStoreWalletInputs>;
    }
  | {
      slice: 'environmentInputs';
      operation: IHomeSetOrReset<IHomeStoreEnvironmentInputs>;
    }
  | {
      slice: 'capabilityInputs';
      operation: IHomeSetOrReset<IHomeStoreCapabilityInputs>;
    }
  | { slice: 'facts'; operation: IHomeSetOrReset<IHomeFacts> }
  | IHomeStoreResourceMutation
  | { slice: 'balanceRound'; operation: IHomeSetOrReset<IHomeBalanceFacts> }
  | {
      slice: 'confirmedBalance';
      operation: IHomeSetOrReset<IHomeConfirmedBalanceRecord>;
    }
  | {
      slice: 'interaction';
      operation: IHomeSetOrReset<IHomeStoreInteractionState>;
    }
  | { slice: 'shell'; operation: IHomeSetOrReset<IHomeStoreShellSlice> }
  | {
      slice: 'navigation';
      operation: IHomeSetOrReset<IHomeStoreNavigationSlice>;
    }
  | {
      slice: 'section';
      sectionId: IHomeSectionId;
      operation: IHomeSetOrReset<IHomeStoreSectionSlice>;
    }
  | {
      slice: 'diagnostics';
      operation: IHomeSetOrReset<IHomeStoreDiagnosticsState>;
    };

export type IHomeStoreEffect =
  | { kind: 'executeCommand'; intent: IHomeStoreIntent }
  | {
      kind: 'traceReject';
      reason: IHomeStoreRejectReason;
      intentId?: string;
    };

export type IHomeStoreTransition = {
  patch: { mutations: readonly IHomeStoreMutation[] };
  effects: readonly IHomeStoreEffect[];
};

export type IHomeStoreRejectReason =
  | 'ownerMismatch'
  | 'sessionMismatch'
  | 'sourceMismatch'
  | 'producerMismatch'
  | 'requestSequenceStale'
  | 'requestPhaseRegression'
  | 'intentDuplicate'
  | 'intentAuthorityExpired'
  | 'intentTargetUnavailable'
  | 'snapshotRejected';

export type IHomeCachedSourceRecord = {
  sourceId: IHomeStoreSourceId;
  sourceKeyIdentity: string;
  dataSchemaVersion: number;
  coverageFingerprint: string;
  quoteBasis: IHomeRuntimeQuoteBasis | null;
  confirmedAt: number;
  expiresAt: number;
  payload: IHomeRuntimeJsonValue;
};

export type IHomeCachedSnapshotPayload = {
  codecVersion: number;
  ownerScopeKey: string;
  records: readonly IHomeCachedSourceRecord[];
  selectedTabPreference?: IHomeTabId;
};
