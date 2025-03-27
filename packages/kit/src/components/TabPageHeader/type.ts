import type { IPageHeaderProps } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import type { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

export interface ITabPageHeaderProp {
  sceneName: EAccountSelectorSceneName;
  showHeaderRight?: boolean;
  showCustomHeaderRight?: IPageHeaderProps['headerRight'];
}
