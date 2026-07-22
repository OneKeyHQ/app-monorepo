import { useCallback } from 'react';

import {
  useHomeFacts,
  useHomeSection,
  useHomeStoreIntentActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/home';

import { createHomeAuthorityId } from '../core/homeIdentity';
import { HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID } from '../sections/spot/homePortfolioControls';

export function useHomePortfolioIntents() {
  const facts = useHomeFacts();
  const portfolioSection = useHomeSection('portfolio');
  const { dispatchHomeIntent } = useHomeStoreIntentActions().current;

  const setShowLpTokensOnly = useCallback(
    (value: boolean) => {
      if (!facts) {
        return false;
      }
      const effects = dispatchHomeIntent({
        type: 'sectionControlChanged',
        intentId: createHomeAuthorityId('intent'),
        owner: facts.owner,
        sessionId: facts.ownerToken.sessionId,
        sectionId: 'portfolio',
        controlId: HOME_PORTFOLIO_SHOW_LP_TOKENS_CONTROL_ID,
        value,
        authority: {
          kind: 'sectionCommands',
          sectionId: 'portfolio',
          revision: portfolioSection.sectionCommandRevision,
        },
      });
      return !effects.some((effect) => effect.kind === 'traceReject');
    },
    [dispatchHomeIntent, facts, portfolioSection.sectionCommandRevision],
  );

  return { setShowLpTokensOnly };
}
