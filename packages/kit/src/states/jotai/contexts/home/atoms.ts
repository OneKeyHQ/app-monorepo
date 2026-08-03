import type { IHomeSectionId } from '@onekeyhq/kit/src/views/Home/model/semantic/homeSemanticTypes';
import {
  createInitialHomeStoreResources,
  createInitialHomeStoreSections,
  createInitialHomeStoreState,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreInitialState';
import type {
  IHomeStoreResourceSlot,
  IHomeStoreSectionSlice,
  IHomeStoreSourceId,
  IHomeStoreSourcePayloadMap,
  IHomeStoreState,
} from '@onekeyhq/kit/src/views/Home/model/store/homeStoreTypes';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { createJotaiContext } from '../../utils/createJotaiContext';

export type IHomeStoreContextConfig = {
  sceneId?: string;
};

const {
  Provider: ProviderJotaiContextHome,
  contextAtom,
  contextAtomMethod,
  useContextAtom,
  useContextData,
  withProvider: withHomeProvider,
} = createJotaiContext<IHomeStoreContextConfig>();

const initial = createInitialHomeStoreState();
const initialResources = createInitialHomeStoreResources();
const initialSections = createInitialHomeStoreSections();

const homeSessionState = contextAtom(initial.session);
const homeRuntimeState = contextAtom(initial.runtime);
const homeWalletInputsState = contextAtom(initial.walletInputs);
const homeEnvironmentInputsState = contextAtom(initial.environmentInputs);
const homeCapabilityInputsState = contextAtom(initial.capabilityInputs);
const homeFactsState = contextAtom(initial.facts);

type IHomeAnyResource = IHomeStoreResourceSlot<
  IHomeStoreSourcePayloadMap[keyof IHomeStoreSourcePayloadMap]
>;

const homeCapabilityResourceState = contextAtom<IHomeAnyResource>(
  initialResources.capability,
);
const homeBannerResourceState = contextAtom<IHomeAnyResource>(
  initialResources.banner,
);
const homePortfolioResourceState = contextAtom<IHomeAnyResource>(
  initialResources.portfolio,
);
const homePerpsResourceState = contextAtom<IHomeAnyResource>(
  initialResources.perps,
);
const homeDeFiResourceState = contextAtom<IHomeAnyResource>(
  initialResources.defi,
);
const homeNFTResourceState = contextAtom<IHomeAnyResource>(
  initialResources.nft,
);
const homeHistoryResourceState = contextAtom<IHomeAnyResource>(
  initialResources.history,
);
const homeMarketResourceState = contextAtom<IHomeAnyResource>(
  initialResources.market,
);

const homeBalanceRoundState = contextAtom(initial.balanceRound);
const homeConfirmedBalanceState = contextAtom(initial.confirmedBalance);
const homeInteractionState = contextAtom(initial.interaction);
const homeShellState = contextAtom(initial.shell);
const homeNavigationState = contextAtom(initial.navigation);
const homePortfolioSectionState = contextAtom(initialSections.portfolio);
const homePerpsSectionState = contextAtom(initialSections.perps);
const homeDeFiSectionState = contextAtom(initialSections.defi);
const homeNFTSectionState = contextAtom(initialSections.nft);
const homeHistorySectionState = contextAtom(initialSections.history);
const homeMarketSectionState = contextAtom(initialSections.market);
const homeDiagnosticsState = contextAtom(initial.diagnostics);
const homeCommitIdentityState = contextAtom(initial.commitIdentity);

export type IHomeDisplaySnapshotLoadState =
  | { status: 'idle' }
  | {
      ownerScopeKey: string;
      sessionId: string;
      status: 'loading' | 'hit' | 'miss';
    };

const homeDisplaySnapshotLoadState = contextAtom<IHomeDisplaySnapshotLoadState>(
  { status: 'idle' },
);

const resourceStates = {
  capability: homeCapabilityResourceState,
  banner: homeBannerResourceState,
  portfolio: homePortfolioResourceState,
  perps: homePerpsResourceState,
  defi: homeDeFiResourceState,
  nft: homeNFTResourceState,
  history: homeHistoryResourceState,
  market: homeMarketResourceState,
} as const;

const sectionStates = {
  portfolio: homePortfolioSectionState,
  perps: homePerpsSectionState,
  defi: homeDeFiSectionState,
  nft: homeNFTSectionState,
  history: homeHistorySectionState,
  market: homeMarketSectionState,
} as const;

export function useHomeSessionState() {
  return homeSessionState.use()[0];
}

export function useHomeRuntimeState() {
  return homeRuntimeState.use()[0];
}

export function useHomeWalletInputs() {
  return homeWalletInputsState.use()[0];
}

export function useHomeEnvironmentInputs() {
  return homeEnvironmentInputsState.use()[0];
}

export function useHomeCapabilityInputs() {
  return homeCapabilityInputsState.use()[0];
}

export function useHomeFacts() {
  return homeFactsState.use()[0];
}

export function useHomeResource<TSourceId extends IHomeStoreSourceId>(
  sourceId: TSourceId,
): IHomeStoreState['resources'][TSourceId] {
  return useContextAtom(
    resourceStates[sourceId].atom(),
  )[0] as IHomeStoreState['resources'][TSourceId];
}

export function useHomeBalanceRound() {
  return homeBalanceRoundState.use()[0];
}

export function useHomeConfirmedBalance() {
  return homeConfirmedBalanceState.use()[0];
}

export function useHomeInteraction() {
  return homeInteractionState.use()[0];
}

export function useHomeShell() {
  return homeShellState.use()[0];
}

export function useHomeNavigation() {
  return homeNavigationState.use()[0];
}

export function useHomeSection(
  sectionId: IHomeSectionId,
): IHomeStoreSectionSlice {
  return useContextAtom(sectionStates[sectionId].atom())[0];
}

export function useHomeDiagnostics() {
  return homeDiagnosticsState.use()[0];
}

export function useHomeCommitIdentity() {
  return homeCommitIdentityState.use()[0];
}

export function useHomeDisplaySnapshotLoadState() {
  return homeDisplaySnapshotLoadState.use()[0];
}

export function useHomeStoreConfig(): IHomeStoreContextConfig | undefined {
  return useContextData().config;
}

export function useHomeContextStore() {
  const store = useContextData().store;
  if (!store) {
    throw new OneKeyLocalError('Home context store is not initialized');
  }
  return store;
}

export {
  ProviderJotaiContextHome,
  contextAtomMethod,
  homeBalanceRoundState,
  homeCapabilityInputsState,
  homeCommitIdentityState,
  homeConfirmedBalanceState,
  homeDiagnosticsState,
  homeDisplaySnapshotLoadState,
  homeEnvironmentInputsState,
  homeFactsState,
  homeInteractionState,
  homeNavigationState,
  homeRuntimeState,
  homeSessionState,
  homeShellState,
  homeWalletInputsState,
  initial,
  resourceStates,
  sectionStates,
  withHomeProvider,
};
