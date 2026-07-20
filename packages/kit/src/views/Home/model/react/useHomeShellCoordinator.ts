import { useEffect, useMemo, useRef } from 'react';

import {
  useHomeActions,
  useHomeConfirmedBalanceCacheAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import { aggregateHomeBalanceFacts } from '../balance/homeBalanceAggregation';
import { getHomeConfirmedBalance } from '../cache/homeConfirmedBalanceCacheReducer';
import { projectHomeBalanceAuthority } from '../policies/homeBalanceAuthorityPolicy';
import { projectHomeShell } from '../policies/homeShellPolicy';

import type { IHomeConfirmedBalanceRecord } from '../cache/homeConfirmedBalanceCacheReducer';
import type { IHomeFacts } from '../facts/homeFacts';
import type { IHomeShellSemanticModel } from '../semantic/homeSemanticTypes';

function compatibilityRecord(
  facts: NonNullable<IHomeFacts['balance']>,
): IHomeConfirmedBalanceRecord | undefined {
  const confirmed = facts.compatibilityConfirmed;
  if (
    !confirmed ||
    confirmed.ownerScopeKey !== facts.ownerToken.scopeKey ||
    confirmed.sourceKeyIdentity !== facts.sourceKeyIdentity ||
    confirmed.quoteBasis.currency !== facts.quoteBasis.currency ||
    confirmed.quoteBasis.pricingRevision !== facts.quoteBasis.pricingRevision
  ) {
    return undefined;
  }
  return {
    ...confirmed,
    confirmedAt: 0,
    quality: 'confirmed',
  };
}

function useHomeShellCoordinator(
  facts: IHomeFacts | undefined,
): IHomeShellSemanticModel | undefined {
  const [cache] = useHomeConfirmedBalanceCacheAtom();
  const actions = useHomeActions().current;
  const publicationRef = useRef<{
    identity: string;
    revision: number;
  }>({ identity: '', revision: 0 });
  const balanceFacts = facts?.balance;
  const aggregation = useMemo(
    () => (balanceFacts ? aggregateHomeBalanceFacts(balanceFacts) : undefined),
    [balanceFacts],
  );
  const liveIdentity = useMemo(
    () =>
      aggregation?.kind === 'complete'
        ? stringUtils.stableStringify(aggregation.aggregate)
        : '',
    [aggregation],
  );
  const confirmedAt = useMemo(
    () => (liveIdentity ? Date.now() : 0),
    [liveIdentity],
  );
  const cached = useMemo(() => {
    if (!balanceFacts) {
      return undefined;
    }
    return getHomeConfirmedBalance(cache, {
      ownerScopeKey: balanceFacts.ownerToken.scopeKey,
      quoteBasis: balanceFacts.quoteBasis,
      sourceKeyIdentity: balanceFacts.sourceKeyIdentity,
    });
  }, [balanceFacts, cache]);
  const compatibility = useMemo(
    () => (balanceFacts ? compatibilityRecord(balanceFacts) : undefined),
    [balanceFacts],
  );
  const decision = useMemo(
    () =>
      facts && aggregation
        ? projectHomeBalanceAuthority({
            aggregation,
            bannerAvailable: facts.balance?.bannerAvailable ?? false,
            confirmed: cached ?? compatibility,
            confirmedAt,
          })
        : undefined,
    [aggregation, cached, compatibility, confirmedAt, facts],
  );
  const shell = useMemo(
    () =>
      facts && decision
        ? projectHomeShell({
            facts,
            portfolioPresentation: decision.presentation,
          })
        : undefined,
    [decision, facts],
  );

  useEffect(() => {
    if (!facts || !shell) {
      return;
    }
    const identity = stringUtils.stableStringify({
      owner: facts.ownerToken,
      shell,
    });
    if (publicationRef.current.identity === identity) {
      return;
    }
    publicationRef.current = {
      identity,
      revision: publicationRef.current.revision + 1,
    };
    actions.publishAuthoritativeShell({
      owner: facts.ownerToken,
      revision: publicationRef.current.revision,
      value: shell,
    });
  }, [actions, facts, shell]);

  useEffect(() => {
    if (decision?.cacheCommit) {
      actions.dispatchConfirmedBalanceCache({
        kind: 'commit',
        record: decision.cacheCommit,
      });
      return;
    }
    if (!cached && compatibility) {
      actions.dispatchConfirmedBalanceCache({
        kind: 'commit',
        record: compatibility,
      });
      return;
    }
    if (cached) {
      actions.dispatchConfirmedBalanceCache({
        identity: cached,
        kind: 'touch',
      });
    }
  }, [actions, cached, compatibility, decision?.cacheCommit]);

  return shell;
}

export { useHomeShellCoordinator };
