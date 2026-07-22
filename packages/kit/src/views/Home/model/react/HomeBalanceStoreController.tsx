import { useEffect, useRef } from 'react';

import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { useHomeBalanceFacts } from './useHomeBalanceFacts';
import { useHomeStoreSourcePublisher } from './useHomeStoreSourcePublisher';

import type { IHomeFacts } from '../facts/homeFacts';

export function HomeBalanceStoreController() {
  const facts = useHomeBalanceFacts();
  const homeBalanceInputsKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!facts?.balance) {
      return;
    }
    const decision = {
      networkScope:
        facts.owner.network.kind === 'allNetworks'
          ? ('allNetworks' as const)
          : ('singleNetwork' as const),
      requiredContributors: [...facts.balance.requiredContributors]
        .toSorted()
        .join(','),
      portfolioResourceKind:
        facts.balance.contributors.portfolio?.resource.kind ?? 'missing',
      deFiResourceKind:
        facts.balance.contributors.defi?.resource.kind ?? 'missing',
      perpsResourceKind:
        facts.balance.contributors.perps?.resource.kind ?? 'missing',
      bannerAvailable: facts.balance.bannerAvailable,
      capabilityReady: facts.capabilityInputs.ready,
    } as const;
    const key = stringUtils.stableStringify(decision);
    if (homeBalanceInputsKeyRef.current === key) {
      return;
    }
    homeBalanceInputsKeyRef.current = key;
    defaultLogger.wallet.homeUi.homeBalanceInputs(decision);
  }, [facts]);
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
