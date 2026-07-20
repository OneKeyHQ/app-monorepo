import {
  useHomeFactsShadowAtom,
  useHomeSemanticNavigationAtom,
  useHomeSemanticSectionsAtom,
  useHomeSemanticShellAtom,
  useHomeShadowComparisonAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import type { IHomeSectionId } from '../semantic/homeSemanticTypes';

export function useHomeFactsShadow() {
  return useHomeFactsShadowAtom()[0];
}

export function useHomeShellSemantic() {
  return useHomeSemanticShellAtom()[0];
}

export function useHomeNavigationSemantic() {
  return useHomeSemanticNavigationAtom()[0];
}

export function useHomeSectionSemantic(sectionId: IHomeSectionId) {
  return useHomeSemanticSectionsAtom()[0][sectionId];
}

export function useHomeShadowComparison() {
  return useHomeShadowComparisonAtom()[0];
}
