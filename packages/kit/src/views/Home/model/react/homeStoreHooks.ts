import { useMemo } from 'react';

import {
  useHomeFacts,
  useHomeNavigation,
  useHomeResource,
  useHomeSection,
  useHomeShell,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import { readHomeStoreSectionPayload } from '../store/homeStoreJson';

import type { IHomePopularTradingPayload } from '../../components/PopularTrading/types';
import type { IHomeFacts } from '../facts/homeFacts';
import type { IHomeDeFiLegacyPayload } from '../sections/defi/homeDeFiSourceAdapter';
import type { IHomeHistoryStorePayload } from '../sections/history/homeHistorySourceAdapter';
import type { IHomeNFTLegacyPayload } from '../sections/nft/homeNFTSourceAdapter';
import type { IHomePerpsLegacyPayload } from '../sections/perps/homePerpsSourceAdapter';
import type { IHomeSpotLegacyPayload } from '../sections/spot/homeSpotSourceAdapter';
import type { IHomeSectionId } from '../semantic/homeSemanticTypes';

type IStableHomeFactsOwner = Pick<IHomeFacts, 'owner' | 'ownerToken'>;

type IHomeSectionPayloadMap = {
  portfolio: IHomeSpotLegacyPayload;
  perps: IHomePerpsLegacyPayload;
  defi: IHomeDeFiLegacyPayload;
  nft: IHomeNFTLegacyPayload;
  history: IHomeHistoryStorePayload;
  market: IHomePopularTradingPayload;
};

export function useHomeFactsSnapshot() {
  return useHomeFacts();
}

export function useStableHomeFactsOwner(): IStableHomeFactsOwner | undefined {
  const facts = useHomeFacts();
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

export function useHomeShellSnapshot() {
  const shell = useHomeShell();
  return useMemo(
    () => ({ revision: shell.presentationRevision, value: shell.value }),
    [shell],
  );
}

export function useHomeNavigationSnapshot() {
  const navigation = useHomeNavigation();
  return useMemo(
    () => ({
      revision: navigation.presentationRevision,
      value: navigation.value,
    }),
    [navigation],
  );
}

export function useHomeSectionSnapshot(sectionId: IHomeSectionId) {
  const section = useHomeSection(sectionId);
  return useMemo(
    () => ({ revision: section.presentationRevision, value: section.value }),
    [section],
  );
}

export function useHomeSectionPayload<TSectionId extends IHomeSectionId>(
  sectionId: TSectionId,
): IHomeSectionPayloadMap[TSectionId] | undefined {
  const resource = useHomeResource(sectionId);
  const data =
    resource.kind === 'ready' || resource.kind === 'partial'
      ? resource.data
      : undefined;
  return useMemo(
    () => readHomeStoreSectionPayload<IHomeSectionPayloadMap[TSectionId]>(data),
    [data],
  );
}
