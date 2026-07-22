import { useEffect, useRef } from 'react';

import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useHomeFacts,
  useHomeResource,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { useHomeBalanceFacts } from './useHomeBalanceFacts';
import { useHomeStoreSourcePublisher } from './useHomeStoreSourcePublisher';

import type { IHomeFacts } from '../facts/homeFacts';

export function HomeBalanceStoreController() {
  const facts = useHomeBalanceFacts();
  const storeFacts = useHomeFacts();
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const portfolioResource = useHomeResource('portfolio');
  const deFiResource = useHomeResource('defi');
  const perpsResource = useHomeResource('perps');
  const homeBalanceInputsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const hasOwnerInput = Boolean(wallet?.id && account?.id && network?.id);
    const ownerMatches = Boolean(
      storeFacts &&
      hasOwnerInput &&
      storeFacts.owner.walletId === wallet?.id &&
      storeFacts.owner.accountId === account?.id &&
      (network?.isAllNetworks
        ? storeFacts.owner.network.kind === 'allNetworks'
        : storeFacts.owner.network.kind === 'singleNetwork' &&
          storeFacts.owner.network.networkId === network?.id),
    );
    let guardReason:
      | 'missingStoreFacts'
      | 'missingOwnerInput'
      | 'ownerMismatch'
      | 'ready' = 'ready';
    if (!storeFacts) {
      guardReason = 'missingStoreFacts';
    } else if (!hasOwnerInput) {
      guardReason = 'missingOwnerInput';
    } else if (!ownerMatches) {
      guardReason = 'ownerMismatch';
    }
    let networkScope: 'allNetworks' | 'singleNetwork' | 'unknown' = 'unknown';
    if (network?.isAllNetworks) {
      networkScope = 'allNetworks';
    } else if (network?.id) {
      networkScope = 'singleNetwork';
    }
    const decision = {
      networkScope,
      factsAvailable: Boolean(facts?.balance),
      guardReason,
      requiredContributors: facts?.balance
        ? [...facts.balance.requiredContributors].toSorted().join(',')
        : '',
      portfolioResourceKind: portfolioResource.kind,
      deFiResourceKind: deFiResource.kind,
      perpsResourceKind: perpsResource.kind,
      bannerAvailable: facts?.balance?.bannerAvailable ?? false,
      capabilityReady: storeFacts?.capabilityInputs.ready ?? false,
    } as const;
    const key = stringUtils.stableStringify(decision);
    if (homeBalanceInputsKeyRef.current === key) {
      return;
    }
    homeBalanceInputsKeyRef.current = key;
    defaultLogger.wallet.homeUi.homeBalanceInputs(decision);
  }, [
    account?.id,
    deFiResource.kind,
    facts,
    network?.id,
    network?.isAllNetworks,
    perpsResource.kind,
    portfolioResource.kind,
    storeFacts,
    wallet?.id,
  ]);
  usePublishHomeBalanceFacts(facts);
  return null;
}

export function usePublishHomeBalanceFacts(facts: IHomeFacts | undefined) {
  const { publishHomeBalanceSource } = useHomeStoreSourcePublisher();

  useEffect(() => {
    if (!facts?.balance) {
      return;
    }
    publishHomeBalanceSource({
      facts,
      observedAt: Date.now(),
    });
  }, [facts, publishHomeBalanceSource]);
}
