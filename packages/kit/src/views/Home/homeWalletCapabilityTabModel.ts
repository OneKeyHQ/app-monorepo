import type {
  IHomeNavigationSemanticModel,
  IHomeTabId,
} from './model/semantic/homeSemanticTypes';

export type IHomeWalletCapabilityNavigationModel =
  | {
      status: 'pending';
      shouldCommitTabs: false;
    }
  | {
      status: 'confirmed';
      shouldCommitTabs: true;
      perpsDestination: 'inline' | 'web' | 'unavailable';
      selectedTabId: IHomeTabId;
      tabIds: readonly IHomeTabId[];
    };

export function buildHomeWalletCapabilityNavigationModel(
  navigation: IHomeNavigationSemanticModel | undefined,
): IHomeWalletCapabilityNavigationModel {
  if (
    navigation?.kind !== 'ready' ||
    !navigation.destinations ||
    !navigation.perpsDestination ||
    !navigation.sections
  ) {
    return { status: 'pending', shouldCommitTabs: false };
  }
  return {
    status: 'confirmed',
    shouldCommitTabs: true,
    perpsDestination: navigation.perpsDestination,
    selectedTabId: navigation.selectedTabId,
    tabIds: navigation.tabs,
  };
}
