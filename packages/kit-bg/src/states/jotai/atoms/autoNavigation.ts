import { ETabRoutes } from '@onekeyhq/shared/src/routes';

import { EAtomNames } from '../atomNames';
import { globalAtom } from '../utils';

// This interface controls the auto-navigation behavior when the app launches
interface IAutoNavigationAtom {
  enabled: boolean;
  selectedTab: ETabRoutes | null;
}

export const { target: autoNavigationAtom, use: useAutoNavigationAtom } =
  globalAtom<IAutoNavigationAtom>({
    persist: true,
    name: EAtomNames.autoNavigationAtom,
    initialValue: {
      enabled: true, // Default to true to maintain existing behavior
      selectedTab: ETabRoutes.Discovery, // Default to Discovery tab
    },
  });
