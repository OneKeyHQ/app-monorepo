import { useEffect } from 'react';

import { useHomeBalanceFacts } from './useHomeBalanceFacts';
import { useHomeStoreSourcePublisher } from './useHomeStoreSourcePublisher';

import type { IHomeFacts } from '../facts/homeFacts';

export function HomeBalanceStoreController() {
  const facts = useHomeBalanceFacts();
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
