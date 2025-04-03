import type { ReactNode } from 'react';

import type { IPageHeaderProps } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export interface ITabPageHeaderProp {
  children?: ReactNode;
  sceneName: EAccountSelectorSceneName;
  showHeaderRight?: boolean;
  showCustomHeaderRight?: IPageHeaderProps['headerRight'];
}
