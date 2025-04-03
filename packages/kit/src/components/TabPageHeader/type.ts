import type { ReactNode } from 'react';

import type { IPageHeaderProps } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import type { ETabRoutes } from '@onekeyhq/shared/src/routes';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export interface ITabPageHeaderProp {
  children?: ReactNode;
  sceneName: EAccountSelectorSceneName;
  tabRoute: ETabRoutes;
  showHeaderRight?: boolean;
  showCustomHeaderRight?: IPageHeaderProps['headerRight'];
}
