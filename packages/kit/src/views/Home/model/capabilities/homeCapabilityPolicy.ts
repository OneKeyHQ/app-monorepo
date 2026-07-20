import { projectHomeCapabilitySet } from './homeCapabilityMatrix';

import type {
  IHomeCapabilityFacts,
  IHomeCapabilityPresentation,
} from './homeCapabilityTypes';
import type { IHomeConfirmedCapabilityRecord } from './homeConfirmedCapabilityCache';
import type { IHomeFacts } from '../facts/homeFacts';
import type {
  IHomeNavigationSemanticModel,
  IHomeSectionId,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';

export type IHomeCapabilityProjection = {
  navigation: IHomeNavigationSemanticModel;
  sections: Readonly<Record<IHomeSectionId, boolean>>;
};

type IHomeCapabilityAuthorityDecision = {
  cacheCommit?: IHomeConfirmedCapabilityRecord;
  presentation: IHomeCapabilityPresentation;
};

function projectHomeCapabilityAuthority({
  confirmed,
  facts,
}: {
  confirmed?: IHomeConfirmedCapabilityRecord;
  facts: IHomeCapabilityFacts;
}): IHomeCapabilityAuthorityDecision {
  if (facts.resource.kind === 'complete') {
    const value = projectHomeCapabilitySet(facts.resource.context);
    return {
      cacheCommit: {
        coverageFingerprint: facts.resource.coverageFingerprint,
        ownerScopeKey: facts.ownerToken.scopeKey,
        sourceKeyIdentity: facts.sourceKeyIdentity,
        value,
      },
      presentation: {
        freshness: 'live',
        kind: 'ready',
        refresh: 'idle',
        value,
      },
    };
  }
  if (confirmed) {
    return {
      presentation: {
        freshness: 'confirmedCache',
        kind: 'ready',
        refresh: facts.resource.kind === 'error' ? 'failed' : 'refreshing',
        value: confirmed.value,
      },
    };
  }
  return { presentation: { kind: 'pending' } };
}

function isTabId(value: string | undefined): value is IHomeTabId {
  return (
    value === 'portfolio' ||
    value === 'perps' ||
    value === 'defi' ||
    value === 'nft' ||
    value === 'history'
  );
}

export function projectHomeCapabilities({
  facts,
  selectedTabId,
}: {
  facts: IHomeFacts;
  selectedTabId?: string;
}): IHomeCapabilityProjection {
  const inputs = facts.capabilityInputs;
  if (!inputs.ready) {
    return {
      navigation: { kind: 'hidden' },
      sections: {
        portfolio: false,
        perps: false,
        defi: false,
        nft: false,
        history: false,
        market: false,
      },
    };
  }

  const tabs: [IHomeTabId, ...IHomeTabId[]] = ['portfolio'];
  const enabled = (key: 'perps' | 'defi' | 'nft' | 'history' | 'market') =>
    inputs.serverConfig[key] && inputs.productAvailability[key];
  if (enabled('perps')) tabs.push('perps');
  if (enabled('defi')) tabs.push('defi');
  if (enabled('nft')) tabs.push('nft');
  if (enabled('history')) tabs.push('history');
  const selected =
    isTabId(selectedTabId) && tabs.includes(selectedTabId)
      ? selectedTabId
      : 'portfolio';
  return {
    navigation: {
      kind: 'ready',
      destinations: Object.fromEntries(
        tabs.map((tabId) => [tabId, 'inline'] as const),
      ),
      freshness: 'live',
      perpsDestination: enabled('perps') ? 'inline' : 'unavailable',
      refresh: 'idle',
      sections: {
        portfolio: true,
        perps: enabled('perps'),
        defi: enabled('defi'),
        nft: enabled('nft'),
        history: enabled('history'),
        market: enabled('market'),
      },
      tabs,
      selectedTabId: selected,
    },
    sections: {
      portfolio: true,
      perps: enabled('perps'),
      defi: enabled('defi'),
      nft: enabled('nft'),
      history: enabled('history'),
      market: enabled('market'),
    },
  };
}

export { projectHomeCapabilityAuthority };
export type { IHomeCapabilityAuthorityDecision };
