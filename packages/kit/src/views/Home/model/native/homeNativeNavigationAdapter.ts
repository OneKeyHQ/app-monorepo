import type { IHomeContainerTabId } from '@onekeyhq/native-components';

import type { IHomePerpsDestination } from '../capabilities/homeCapabilityTypes';
import type { IHomeNavigationSemanticModel } from '../semantic/homeSemanticTypes';

type IHomeNavigationWithDestination = IHomeNavigationSemanticModel & {
  perpsDestination?: IHomePerpsDestination;
};

type IHomeNativeNavigationPresentation =
  | { kind: 'pending'; shouldCommitTabs: false }
  | {
      kind: 'ready';
      perpsDestination: IHomePerpsDestination;
      selectedTabId: IHomeContainerTabId;
      shouldCommitTabs: true;
      tabIds: readonly IHomeContainerTabId[];
    };

function adaptHomeNavigationToNative(
  navigation: IHomeNavigationWithDestination | undefined,
): IHomeNativeNavigationPresentation {
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

export { adaptHomeNavigationToNative };
export type { IHomeNativeNavigationPresentation };
