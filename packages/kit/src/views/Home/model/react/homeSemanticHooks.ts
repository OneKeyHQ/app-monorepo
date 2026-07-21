import { useMemo } from 'react';

import {
  useHomeFactsShadowAtom,
  useHomeSemanticNavigationAtom,
  useHomeSemanticSectionsAtom,
  useHomeSemanticShellAtom,
  useHomeShadowComparisonAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import type { IHomeFacts } from '../facts/homeFacts';
import type { IHomeSectionId } from '../semantic/homeSemanticTypes';

type IStableHomeFactsOwner = Pick<IHomeFacts, 'owner' | 'ownerToken'>;

export function useHomeFactsShadow() {
  return useHomeFactsShadowAtom()[0];
}

export function useStableHomeFactsOwner(): IStableHomeFactsOwner | undefined {
  const facts = useHomeFactsShadow();
  const walletId = facts?.owner.walletId;
  const accountId = facts?.owner.accountId;
  const networkKind = facts?.owner.network.kind;
  const networkId =
    facts?.owner.network.kind === 'singleNetwork'
      ? facts.owner.network.networkId
      : undefined;
  const scopeKey = facts?.ownerToken.scopeKey;
  const sessionId = facts?.ownerToken.sessionId;

  return useMemo(() => {
    if (!walletId || !accountId || !networkKind || !scopeKey || !sessionId) {
      return undefined;
    }
    if (networkKind === 'singleNetwork') {
      if (!networkId) {
        return undefined;
      }
      return {
        owner: {
          walletId,
          accountId,
          network: { kind: networkKind, networkId },
        },
        ownerToken: { scopeKey, sessionId },
      };
    }
    return {
      owner: {
        walletId,
        accountId,
        network: { kind: networkKind },
      },
      ownerToken: { scopeKey, sessionId },
    };
  }, [accountId, networkId, networkKind, scopeKey, sessionId, walletId]);
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
