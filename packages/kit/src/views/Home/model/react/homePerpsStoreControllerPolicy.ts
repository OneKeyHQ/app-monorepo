import type { IHomeNavigationSemanticModel } from '../semantic/homeSemanticTypes';

export function isHomePerpsSourceActive(
  navigation: IHomeNavigationSemanticModel,
) {
  return navigation.kind === 'ready' && navigation.tabs.includes('perps');
}
