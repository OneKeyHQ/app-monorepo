import { useEffect, useRef } from 'react';

import {
  useHomeFacts,
  useHomeInteraction,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';
import { useTokenSelectorFilterPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import { createHomeAuthorityId } from '../core/homeIdentity';
import { HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID } from '../sections/spot/homePortfolioControls';

export function HomePortfolioControlPersistenceController() {
  const facts = useHomeFacts();
  const interaction = useHomeInteraction();
  const portfolioSection = useHomeSection('portfolio');
  const [persistedFilter, setPersistedFilter] =
    useTokenSelectorFilterPersistAtom();
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;
  const hydratedSessionIdRef = useRef<string | undefined>(undefined);
  const runtimeValue =
    interaction.sectionControls.portfolio?.[
      HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID
    ];
  const showLpTokensOnly =
    typeof runtimeValue === 'boolean' ? runtimeValue : undefined;
  const persistedValue = Boolean(persistedFilter.homeShowLpTokensOnly);

  useEffect(() => {
    if (!facts) {
      hydratedSessionIdRef.current = undefined;
      return;
    }
    const sessionId = facts.ownerToken.sessionId;
    if (hydratedSessionIdRef.current === sessionId) {
      return;
    }
    if (showLpTokensOnly !== undefined) {
      hydratedSessionIdRef.current = sessionId;
      return;
    }
    const effects = dispatchHomeIntent({
      type: 'sectionControlChanged',
      intentId: createHomeAuthorityId('intent'),
      owner: facts.owner,
      sessionId,
      sectionId: 'portfolio',
      controlId: HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID,
      value: persistedValue,
      authority: {
        kind: 'sectionCommands',
        sectionId: 'portfolio',
        revision: portfolioSection.sectionCommandRevision,
      },
    });
    if (!effects.some((effect) => effect.kind === 'traceReject')) {
      hydratedSessionIdRef.current = sessionId;
    }
  }, [
    dispatchHomeIntent,
    facts,
    persistedValue,
    portfolioSection.sectionCommandRevision,
    showLpTokensOnly,
  ]);

  useEffect(() => {
    if (
      !facts ||
      hydratedSessionIdRef.current !== facts.ownerToken.sessionId ||
      showLpTokensOnly === undefined ||
      showLpTokensOnly === persistedValue
    ) {
      return;
    }
    setPersistedFilter((previous) => ({
      ...previous,
      homeShowLpTokensOnly: showLpTokensOnly,
    }));
  }, [facts, persistedValue, setPersistedFilter, showLpTokensOnly]);

  return null;
}
