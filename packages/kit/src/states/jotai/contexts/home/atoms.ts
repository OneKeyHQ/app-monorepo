import {
  type IHomeConfirmedBalanceCacheState,
  initialHomeConfirmedBalanceCacheState,
} from '@onekeyhq/kit/src/views/Home/model/cache/homeConfirmedBalanceCacheReducer';
import {
  type IHomeConfirmedCapabilityCacheState,
  initialHomeConfirmedCapabilityCacheState,
} from '@onekeyhq/kit/src/views/Home/model/capabilities/homeConfirmedCapabilityCache';
import type { IHomeFacts } from '@onekeyhq/kit/src/views/Home/model/facts/homeFacts';
import type { IHomeAuthorityShadowSnapshot } from '@onekeyhq/kit/src/views/Home/model/lifecycle/homeSessionCoordinator';
import {
  type IHomeTabIntentState,
  initialHomeTabIntentState,
} from '@onekeyhq/kit/src/views/Home/model/navigation/homeTabIntentReducer';
import type {
  IHomeAuthoritativeNavigationSnapshot,
  IHomeAuthoritativeShellSnapshot,
  IHomeNavigationSemanticModel,
  IHomeSectionId,
  IHomeSectionSemanticModel,
  IHomeShellSemanticModel,
  IVersionedHomeSemanticSlice,
} from '@onekeyhq/kit/src/views/Home/model/semantic/homeSemanticTypes';
import type {
  IHomeShadowComparison,
  IHomeShadowTrace,
} from '@onekeyhq/kit/src/views/Home/model/semantic/homeShadowComparator';

import { createJotaiContext } from '../../utils/createJotaiContext';

const {
  Provider: ProviderJotaiContextHome,
  contextAtom,
  contextAtomMethod,
  withProvider: withHomeProvider,
} = createJotaiContext();

export const initialHomeAuthorityShadowState: IHomeAuthorityShadowSnapshot = {
  topology: 'single',
  status: 'idle',
  staleRejectCount: 0,
  revision: 0,
};

export const {
  atom: homeAuthorityShadowAtom,
  use: useHomeAuthorityShadowAtom,
} = contextAtom<IHomeAuthorityShadowSnapshot>(initialHomeAuthorityShadowState);

export const { atom: homeFactsShadowAtom, use: useHomeFactsShadowAtom } =
  contextAtom<IHomeFacts | undefined>(undefined);

export const {
  atom: homeConfirmedBalanceCacheAtom,
  use: useHomeConfirmedBalanceCacheAtom,
} = contextAtom<IHomeConfirmedBalanceCacheState>(
  initialHomeConfirmedBalanceCacheState,
);

export const {
  atom: homeConfirmedCapabilityCacheAtom,
  use: useHomeConfirmedCapabilityCacheAtom,
} = contextAtom<IHomeConfirmedCapabilityCacheState>(
  initialHomeConfirmedCapabilityCacheState,
);

export const { atom: homeTabIntentAtom, use: useHomeTabIntentAtom } =
  contextAtom<IHomeTabIntentState>(initialHomeTabIntentState);

export const {
  atom: homeAuthoritativeShellAtom,
  use: useHomeAuthoritativeShellAtom,
} = contextAtom<IHomeAuthoritativeShellSnapshot | undefined>(undefined);

export const {
  atom: homeAuthoritativeNavigationAtom,
  use: useHomeAuthoritativeNavigationAtom,
} = contextAtom<IHomeAuthoritativeNavigationSnapshot | undefined>(undefined);

export const { atom: homeSemanticShellAtom, use: useHomeSemanticShellAtom } =
  contextAtom<IVersionedHomeSemanticSlice<IHomeShellSemanticModel> | undefined>(
    undefined,
  );

export const {
  atom: homeSemanticNavigationAtom,
  use: useHomeSemanticNavigationAtom,
} = contextAtom<
  IVersionedHomeSemanticSlice<IHomeNavigationSemanticModel> | undefined
>(undefined);

export type IHomeSemanticSectionSlices = Readonly<
  Partial<
    Record<
      IHomeSectionId,
      IVersionedHomeSemanticSlice<IHomeSectionSemanticModel>
    >
  >
>;

export const {
  atom: homeSemanticSectionsAtom,
  use: useHomeSemanticSectionsAtom,
} = contextAtom<IHomeSemanticSectionSlices>({});

export type IHomeSemanticSectionRevisions = Readonly<
  Partial<Record<IHomeSectionId, number>>
>;

export const {
  atom: homeSemanticSectionRevisionsAtom,
  use: useHomeSemanticSectionRevisionsAtom,
} = contextAtom<IHomeSemanticSectionRevisions>({});

export const {
  atom: homeShadowComparisonAtom,
  use: useHomeShadowComparisonAtom,
} = contextAtom<IHomeShadowComparison | undefined>(undefined);

export const { atom: homeShadowTraceAtom, use: useHomeShadowTraceAtom } =
  contextAtom<IHomeShadowTrace | undefined>(undefined);

export { ProviderJotaiContextHome, contextAtomMethod, withHomeProvider };
