import type { IHomePerpsDestination } from '../capabilities/homeCapabilityTypes';
import type {
  IHomeNavigationSemanticModel,
  IHomeTabId,
} from '../semantic/homeSemanticTypes';

type IHomeNavigationWithDestination = IHomeNavigationSemanticModel & {
  perpsDestination?: IHomePerpsDestination;
};

type IHomeLegacyNavigationPresentation =
  | { kind: 'pending'; shouldCommitTabs: false }
  | {
      kind: 'ready';
      perpsDestination: IHomePerpsDestination;
      selectedTabId: IHomeTabId;
      shouldCommitTabs: true;
      tabIds: readonly IHomeTabId[];
    };

function adaptHomeNavigationToLegacy(
  navigation: IHomeNavigationWithDestination | undefined,
): IHomeLegacyNavigationPresentation {
  if (
    !navigation ||
    navigation.kind === 'hidden' ||
    !navigation.perpsDestination
  ) {
    return { kind: 'pending', shouldCommitTabs: false };
  }
  return {
    kind: 'ready',
    perpsDestination: navigation.perpsDestination,
    selectedTabId: navigation.selectedTabId,
    shouldCommitTabs: true,
    tabIds: navigation.tabs,
  };
}

export { adaptHomeNavigationToLegacy };
export type { IHomeLegacyNavigationPresentation };
