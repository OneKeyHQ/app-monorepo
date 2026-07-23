import type {
  IHomeStoreResourceSlot,
  IHomeStoreResourcesState,
  IHomeStoreSectionSlice,
  IHomeStoreSectionsState,
  IHomeStoreSourcePayloadMap,
  IHomeStoreState,
} from './homeStoreTypes';

const idleResource = <
  TPayload extends IHomeStoreSourcePayloadMap[keyof IHomeStoreSourcePayloadMap],
>(): IHomeStoreResourceSlot<TPayload> => ({ kind: 'idle' });

export function createInitialHomeStoreResources(): IHomeStoreResourcesState {
  return {
    capability: idleResource(),
    banner: idleResource(),
    portfolio: idleResource(),
    perps: idleResource(),
    defi: idleResource(),
    nft: idleResource(),
    history: idleResource(),
    market: idleResource(),
  };
}

export function createInitialHomeStoreSection(
  sectionId: 'portfolio' | 'perps' | 'defi' | 'nft' | 'history' | 'market',
): IHomeStoreSectionSlice {
  return {
    presentationRevision: 0,
    sectionCommandRevision: 0,
    value: { kind: 'loading', placeholder: sectionId },
  };
}

export function createInitialHomeStoreSections(): IHomeStoreSectionsState {
  return {
    portfolio: createInitialHomeStoreSection('portfolio'),
    perps: createInitialHomeStoreSection('perps'),
    defi: createInitialHomeStoreSection('defi'),
    nft: createInitialHomeStoreSection('nft'),
    history: createInitialHomeStoreSection('history'),
    market: createInitialHomeStoreSection('market'),
  };
}

export function createInitialHomeStoreState(): IHomeStoreState {
  return {
    session: { status: 'idle' },
    runtime: {
      topology: 'single',
      connection: 'waiting',
      protocolVersion: 0,
    },
    walletInputs: {
      ready: false,
      hasNetworkAccount: false,
      backupStatus: 'unknown',
      accountType: 'unknown',
    },
    environmentInputs: { theme: 'unknown' },
    capabilityInputs: {
      ready: false,
      networkFamily: 'unknown',
      accountType: 'unknown',
      allNetworks: false,
      serverConfig: {
        perps: false,
        defi: false,
        nft: false,
        history: false,
        market: false,
      },
      productAvailability: {
        perps: false,
        defi: false,
        nft: false,
        history: false,
        market: false,
      },
    },
    resources: createInitialHomeStoreResources(),
    interaction: {
      dismissedBannerIds: [],
      sectionControls: {},
      visibility: 'foreground',
      acceptedIntentIds: [],
      pendingSectionCommands: [],
      pendingShellCommands: [],
    },
    shell: {
      presentationRevision: 0,
      shellCommandRevision: 0,
      value: { kind: 'loading' },
    },
    navigation: {
      presentationRevision: 0,
      tabApplicabilityRevision: 0,
      value: { kind: 'hidden' },
    },
    sections: createInitialHomeStoreSections(),
    diagnostics: {
      acceptedEventCount: 0,
      rejectedEventCount: 0,
      staleRejectCount: 0,
    },
    commitIdentity: { storeCommitId: 0 },
  };
}
