import stringUtils from '@onekeyhq/shared/src/utils/stringUtils';

import type {
  IHomeCapabilityContext,
  IHomeCapabilitySet,
} from './homeCapabilityTypes';
import type { IHomeSectionId, IHomeTabId } from '../semantic/homeSemanticTypes';

const configurableCapabilityIds = [
  'perps',
  'defi',
  'nft',
  'history',
  'market',
] as const;

function projectHomeCapabilitySet(
  context: IHomeCapabilityContext,
): IHomeCapabilitySet {
  const enabled = (id: (typeof configurableCapabilityIds)[number]) =>
    context.serverConfig[id] === 'available' &&
    context.productAvailability[id] === 'available';
  const perpsDestination = enabled('perps')
    ? context.perpsDestination
    : 'unavailable';
  const tabs: [IHomeTabId, ...IHomeTabId[]] = ['portfolio'];
  if (perpsDestination !== 'unavailable') {
    tabs.push('perps');
  }
  if (enabled('defi')) {
    tabs.push('defi');
  }
  if (enabled('nft')) {
    tabs.push('nft');
  }
  if (enabled('history')) {
    tabs.push('history');
  }
  const sections: Record<IHomeSectionId, boolean> = {
    portfolio: true,
    perps: perpsDestination === 'inline',
    defi: enabled('defi'),
    nft: enabled('nft'),
    history: enabled('history'),
    market: enabled('market'),
  };
  const destinations: Partial<Record<IHomeTabId, 'inline' | 'web'>> = {
    portfolio: 'inline',
  };
  tabs.forEach((tabId) => {
    destinations[tabId] =
      tabId === 'perps' && perpsDestination === 'web' ? 'web' : 'inline';
  });
  const revision = stringUtils.stableStringify({
    accountType: context.accountType,
    allNetworks: context.allNetworks,
    destinations,
    networkFamily: context.networkFamily,
    sections,
    tabs,
  });
  return {
    destinations,
    perpsDestination,
    revision,
    sections,
    tabs,
  };
}

export { projectHomeCapabilitySet };
