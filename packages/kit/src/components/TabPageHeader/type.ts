import type { ReactNode } from 'react';

import type { ETranslations } from '@onekeyhq/shared/src/locale';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
  hideSearch?: boolean;
  onSelectHeaderTab?: (tab: ETranslations) => void;
}

export interface ITabPageHeaderContainerProps {
  children: ReactNode;
}
