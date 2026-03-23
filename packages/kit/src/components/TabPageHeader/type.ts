import type { ReactNode } from 'react';

import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import type { SharedValue } from 'react-native-reanimated';

export interface ITabPageHeaderProp {
  children?: ReactNode;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  selectedHeaderTab?: ETranslations;
  renderCustomHeaderRightItems?: ({
    fixedItems,
  }: {
    fixedItems: ReactNode;
  }) => ReactNode;
  customHeaderRightItems?: ReactNode;
  customHeaderLeftItems?: ReactNode;
  customToolbarItems?: ReactNode;
  hideSearch?: boolean;
  hideHeaderLeft?: boolean;
  headerPx?: string;
  pageScrollPosition?: SharedValue<number>;
}

export interface ITabPageHeaderContainerProps {
  children: ReactNode;
}
