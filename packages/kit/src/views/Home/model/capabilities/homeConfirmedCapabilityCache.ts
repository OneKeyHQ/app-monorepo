import type {
  IHomeCapabilityFacts,
  IHomeCapabilitySet,
} from './homeCapabilityTypes';

const HOME_CONFIRMED_CAPABILITY_CACHE_LIMIT = 8;

type IHomeConfirmedCapabilityRecord = {
  coverageFingerprint: string;
  ownerScopeKey: string;
  sourceKeyIdentity: string;
  value: IHomeCapabilitySet;
};

type IHomeConfirmedCapabilityCacheState = {
  entries: readonly IHomeConfirmedCapabilityRecord[];
};

type IHomeConfirmedCapabilityCacheIdentity = Pick<
  IHomeConfirmedCapabilityRecord,
  'ownerScopeKey' | 'sourceKeyIdentity'
>;

type IHomeConfirmedCapabilityCacheCommand =
  | { kind: 'commit'; record: IHomeConfirmedCapabilityRecord }
  | { kind: 'touch'; identity: IHomeConfirmedCapabilityCacheIdentity }
  | { kind: 'clear' };

const initialHomeConfirmedCapabilityCacheState: IHomeConfirmedCapabilityCacheState =
  { entries: [] };

function identityMatches(
  record: IHomeConfirmedCapabilityCacheIdentity,
  identity: IHomeConfirmedCapabilityCacheIdentity,
): boolean {
  return (
    record.ownerScopeKey === identity.ownerScopeKey &&
    record.sourceKeyIdentity === identity.sourceKeyIdentity
  );
}

function getHomeConfirmedCapability(
  state: IHomeConfirmedCapabilityCacheState,
  identity: IHomeConfirmedCapabilityCacheIdentity,
): IHomeConfirmedCapabilityRecord | undefined {
  return state.entries.find((entry) => identityMatches(entry, identity));
}

function reduceHomeConfirmedCapabilityCache(
  state: IHomeConfirmedCapabilityCacheState,
  command: IHomeConfirmedCapabilityCacheCommand,
): IHomeConfirmedCapabilityCacheState {
  if (command.kind === 'clear') {
    return state.entries.length > 0
      ? initialHomeConfirmedCapabilityCacheState
      : state;
  }
  const identity =
    command.kind === 'commit' ? command.record : command.identity;
  const current = getHomeConfirmedCapability(state, identity);
  if (command.kind === 'touch' && !current) {
    return state;
  }
  const nextRecord = command.kind === 'commit' ? command.record : current;
  if (!nextRecord) {
    return state;
  }
  if (state.entries.at(-1) === current && command.kind === 'touch') {
    return state;
  }
  if (
    command.kind === 'commit' &&
    current?.coverageFingerprint === command.record.coverageFingerprint &&
    current.value.revision === command.record.value.revision &&
    state.entries.at(-1) === current
  ) {
    return state;
  }
  return {
    entries: [
      ...state.entries.filter((entry) => !identityMatches(entry, identity)),
      nextRecord,
    ].slice(-HOME_CONFIRMED_CAPABILITY_CACHE_LIMIT),
  };
}

function buildHomeConfirmedCapabilityIdentity(
  facts: IHomeCapabilityFacts,
): IHomeConfirmedCapabilityCacheIdentity {
  return {
    ownerScopeKey: facts.ownerToken.scopeKey,
    sourceKeyIdentity: facts.sourceKeyIdentity,
  };
}

export {
  HOME_CONFIRMED_CAPABILITY_CACHE_LIMIT,
  buildHomeConfirmedCapabilityIdentity,
  getHomeConfirmedCapability,
  initialHomeConfirmedCapabilityCacheState,
  reduceHomeConfirmedCapabilityCache,
};
export type {
  IHomeConfirmedCapabilityCacheCommand,
  IHomeConfirmedCapabilityCacheIdentity,
  IHomeConfirmedCapabilityCacheState,
  IHomeConfirmedCapabilityRecord,
};
