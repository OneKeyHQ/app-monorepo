import { useRef } from 'react';

import { isEqual } from 'lodash';

import {
  type IHomeConfirmedBalanceCacheCommand,
  initialHomeConfirmedBalanceCacheState,
  reduceHomeConfirmedBalanceCache,
} from '@onekeyhq/kit/src/views/Home/model/cache/homeConfirmedBalanceCacheReducer';
import {
  type IHomeConfirmedCapabilityCacheCommand,
  initialHomeConfirmedCapabilityCacheState,
  reduceHomeConfirmedCapabilityCache,
} from '@onekeyhq/kit/src/views/Home/model/capabilities/homeConfirmedCapabilityCache';
import type { IHomeFacts } from '@onekeyhq/kit/src/views/Home/model/facts/homeFacts';
import type { IHomeAuthorityShadowSnapshot } from '@onekeyhq/kit/src/views/Home/model/lifecycle/homeSessionCoordinator';
import {
  type IHomeTabIntentState,
  initialHomeTabIntentState,
} from '@onekeyhq/kit/src/views/Home/model/navigation/homeTabIntentReducer';
import {
  advanceHomeAuthoritativeNavigationSnapshot,
  advanceHomeAuthoritativeShellSnapshot,
} from '@onekeyhq/kit/src/views/Home/model/semantic/homeSemanticStore';
import type {
  IHomeAuthoritativeNavigationSnapshot,
  IHomeAuthoritativeSectionSnapshot,
  IHomeAuthoritativeShellSnapshot,
  IHomeSectionId,
  IHomeSemanticStoreSnapshot,
} from '@onekeyhq/kit/src/views/Home/model/semantic/homeSemanticTypes';
import type {
  IHomeShadowComparison,
  IHomeShadowTrace,
} from '@onekeyhq/kit/src/views/Home/model/semantic/homeShadowComparator';
import { memoFn } from '@onekeyhq/shared/src/utils/cacheUtils';

import { ContextJotaiActionsBase } from '../../utils/ContextJotaiActionsBase';

import {
  type IHomeSemanticSectionRevisions,
  type IHomeSemanticSectionSlices,
  contextAtomMethod,
  homeAuthoritativeNavigationAtom,
  homeAuthoritativeShellAtom,
  homeAuthorityShadowAtom,
  homeConfirmedBalanceCacheAtom,
  homeConfirmedCapabilityCacheAtom,
  homeFactsShadowAtom,
  homeSemanticNavigationAtom,
  homeSemanticSectionRevisionsAtom,
  homeSemanticSectionsAtom,
  homeSemanticShellAtom,
  homeShadowComparisonAtom,
  homeShadowTraceAtom,
  homeTabIntentAtom,
  initialHomeAuthorityShadowState,
} from './atoms';

const homeSectionIds: readonly IHomeSectionId[] = [
  'portfolio',
  'perps',
  'defi',
  'nft',
  'history',
  'market',
];

function mergeHomeSemanticSectionPublication({
  currentRevisions,
  currentSections,
  incomingSections,
  sameOwner,
}: {
  currentRevisions: IHomeSemanticSectionRevisions;
  currentSections: IHomeSemanticSectionSlices;
  incomingSections: IHomeSemanticStoreSnapshot['sections'];
  sameOwner: boolean;
}): {
  revisions: IHomeSemanticSectionRevisions;
  sections: IHomeSemanticSectionSlices;
} {
  if (!sameOwner) {
    const revisions: Partial<Record<IHomeSectionId, number>> = {};
    homeSectionIds.forEach((sectionId) => {
      revisions[sectionId] = incomingSections[sectionId].revision;
    });
    return { revisions, sections: incomingSections };
  }
  let nextSections: Partial<
    Record<
      IHomeSectionId,
      IHomeSemanticStoreSnapshot['sections'][IHomeSectionId]
    >
  > | null = null;
  let nextRevisions: Partial<Record<IHomeSectionId, number>> | null = null;
  homeSectionIds.forEach((sectionId) => {
    const incoming = incomingSections[sectionId];
    if ((currentRevisions[sectionId] ?? 0) >= incoming.revision) return;
    if (!nextSections) {
      nextSections = { ...currentSections };
    }
    if (!nextRevisions) {
      nextRevisions = { ...currentRevisions };
    }
    nextSections[sectionId] = incoming;
    nextRevisions[sectionId] = incoming.revision;
  });
  return {
    revisions: nextRevisions ?? currentRevisions,
    sections: nextSections ?? currentSections,
  };
}

class ContextJotaiActionsHome extends ContextJotaiActionsBase {
  setAuthorityShadow = contextAtomMethod(
    (_get, set, snapshot: IHomeAuthorityShadowSnapshot) => {
      set(homeAuthorityShadowAtom(), snapshot);
    },
  );

  dispatchConfirmedBalanceCache = contextAtomMethod(
    (get, set, command: IHomeConfirmedBalanceCacheCommand) => {
      const current = get(homeConfirmedBalanceCacheAtom());
      const next = reduceHomeConfirmedBalanceCache(current, command);
      if (next !== current) {
        set(homeConfirmedBalanceCacheAtom(), next);
      }
    },
  );

  dispatchConfirmedCapabilityCache = contextAtomMethod(
    (get, set, command: IHomeConfirmedCapabilityCacheCommand) => {
      const current = get(homeConfirmedCapabilityCacheAtom());
      const next = reduceHomeConfirmedCapabilityCache(current, command);
      if (next !== current) {
        set(homeConfirmedCapabilityCacheAtom(), next);
      }
    },
  );

  setHomeTabIntent = contextAtomMethod(
    (_get, set, intent: IHomeTabIntentState) => {
      set(homeTabIntentAtom(), intent);
    },
  );

  publishAuthoritativeShell = contextAtomMethod(
    (get, set, snapshot: IHomeAuthoritativeShellSnapshot) => {
      const current = get(homeAuthoritativeShellAtom());
      set(
        homeAuthoritativeShellAtom(),
        advanceHomeAuthoritativeShellSnapshot(current, snapshot),
      );
    },
  );

  publishAuthoritativeNavigation = contextAtomMethod(
    (get, set, snapshot: IHomeAuthoritativeNavigationSnapshot) => {
      const current = get(homeAuthoritativeNavigationAtom());
      set(
        homeAuthoritativeNavigationAtom(),
        advanceHomeAuthoritativeNavigationSnapshot(current, snapshot),
      );
    },
  );

  publishSemanticShadow = contextAtomMethod(
    (
      get,
      set,
      payload: {
        comparison: IHomeShadowComparison;
        facts: IHomeFacts;
        store: IHomeSemanticStoreSnapshot;
        trace: IHomeShadowTrace;
      },
    ) => {
      const currentFacts = get(homeFactsShadowAtom());
      const sameOwner =
        currentFacts?.ownerToken.scopeKey ===
          payload.facts.ownerToken.scopeKey &&
        currentFacts.ownerToken.sessionId ===
          payload.facts.ownerToken.sessionId;
      const sectionPublication = mergeHomeSemanticSectionPublication({
        currentRevisions: get(homeSemanticSectionRevisionsAtom()),
        currentSections: get(homeSemanticSectionsAtom()),
        incomingSections: payload.store.sections,
        sameOwner,
      });
      if (!isEqual(currentFacts, payload.facts)) {
        set(homeFactsShadowAtom(), payload.facts);
      }
      set(homeSemanticShellAtom(), payload.store.shell);
      set(homeSemanticNavigationAtom(), payload.store.navigation);
      set(homeSemanticSectionsAtom(), sectionPublication.sections);
      set(homeSemanticSectionRevisionsAtom(), sectionPublication.revisions);
      set(homeShadowComparisonAtom(), payload.comparison);
      set(homeShadowTraceAtom(), payload.trace);
    },
  );

  publishSemanticSection = contextAtomMethod(
    (get, set, snapshot: IHomeAuthoritativeSectionSnapshot) => {
      const facts = get(homeFactsShadowAtom());
      if (
        facts?.ownerToken.scopeKey !== snapshot.owner.scopeKey ||
        facts.ownerToken.sessionId !== snapshot.owner.sessionId
      ) {
        return;
      }
      const revisions = get(homeSemanticSectionRevisionsAtom());
      if ((revisions[snapshot.sectionId] ?? 0) >= snapshot.revision) {
        return;
      }
      const current = get(homeSemanticSectionsAtom());
      set(homeSemanticSectionsAtom(), {
        ...current,
        [snapshot.sectionId]: {
          revision: snapshot.revision,
          value: snapshot.value,
        },
      });
      set(homeSemanticSectionRevisionsAtom(), {
        ...revisions,
        [snapshot.sectionId]: snapshot.revision,
      });
    },
  );

  clearSemanticSection = contextAtomMethod(
    (
      get,
      set,
      input: Pick<
        IHomeAuthoritativeSectionSnapshot,
        'owner' | 'revision' | 'sectionId'
      >,
    ) => {
      const facts = get(homeFactsShadowAtom());
      if (
        facts?.ownerToken.scopeKey !== input.owner.scopeKey ||
        facts.ownerToken.sessionId !== input.owner.sessionId
      ) {
        return;
      }
      const revisions = get(homeSemanticSectionRevisionsAtom());
      if ((revisions[input.sectionId] ?? 0) >= input.revision) return;
      const current = get(homeSemanticSectionsAtom());
      if (current[input.sectionId]) {
        const next = { ...current };
        delete next[input.sectionId];
        set(homeSemanticSectionsAtom(), next);
      }
      set(homeSemanticSectionRevisionsAtom(), {
        ...revisions,
        [input.sectionId]: input.revision,
      });
    },
  );

  clearSemanticShadow = contextAtomMethod((_get, set) => {
    set(homeFactsShadowAtom(), undefined);
    set(homeSemanticShellAtom(), undefined);
    set(homeSemanticNavigationAtom(), undefined);
    set(homeSemanticSectionsAtom(), {});
    set(homeSemanticSectionRevisionsAtom(), {});
    set(homeShadowComparisonAtom(), undefined);
    set(homeShadowTraceAtom(), undefined);
    set(homeAuthoritativeShellAtom(), undefined);
    set(homeAuthoritativeNavigationAtom(), undefined);
  });

  resetAuthorityShadow = contextAtomMethod((_get, set) => {
    set(homeAuthorityShadowAtom(), initialHomeAuthorityShadowState);
    set(homeFactsShadowAtom(), undefined);
    set(homeSemanticShellAtom(), undefined);
    set(homeSemanticNavigationAtom(), undefined);
    set(homeSemanticSectionsAtom(), {});
    set(homeSemanticSectionRevisionsAtom(), {});
    set(homeShadowComparisonAtom(), undefined);
    set(homeShadowTraceAtom(), undefined);
    set(homeAuthoritativeShellAtom(), undefined);
    set(homeAuthoritativeNavigationAtom(), undefined);
    set(homeConfirmedBalanceCacheAtom(), initialHomeConfirmedBalanceCacheState);
    set(
      homeConfirmedCapabilityCacheAtom(),
      initialHomeConfirmedCapabilityCacheState,
    );
    set(homeTabIntentAtom(), initialHomeTabIntentState);
  });
}

const createActions = memoFn(() => new ContextJotaiActionsHome());

export function useHomeActions() {
  const actions = createActions();
  const setAuthorityShadow = actions.setAuthorityShadow.use();
  const dispatchConfirmedBalanceCache =
    actions.dispatchConfirmedBalanceCache.use();
  const dispatchConfirmedCapabilityCache =
    actions.dispatchConfirmedCapabilityCache.use();
  const setHomeTabIntent = actions.setHomeTabIntent.use();
  const publishAuthoritativeShell = actions.publishAuthoritativeShell.use();
  const publishAuthoritativeNavigation =
    actions.publishAuthoritativeNavigation.use();
  const publishSemanticShadow = actions.publishSemanticShadow.use();
  const publishSemanticSection = actions.publishSemanticSection.use();
  const clearSemanticSection = actions.clearSemanticSection.use();
  const clearSemanticShadow = actions.clearSemanticShadow.use();
  const resetAuthorityShadow = actions.resetAuthorityShadow.use();

  return useRef({
    setAuthorityShadow,
    dispatchConfirmedBalanceCache,
    dispatchConfirmedCapabilityCache,
    setHomeTabIntent,
    publishAuthoritativeShell,
    publishAuthoritativeNavigation,
    publishSemanticShadow,
    publishSemanticSection,
    clearSemanticSection,
    clearSemanticShadow,
    resetAuthorityShadow,
  });
}

export { mergeHomeSemanticSectionPublication };
