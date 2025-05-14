import { ETabRoutes } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

// eslint-disable-next-line import-path/parent-depth
import { TabPageHeader } from '../../../../../components/TabPageHeader';

export function MarketDetailHeader() {
  return (
    <TabPageHeader
      sceneName={EAccountSelectorSceneName.home}
      tabRoute={ETabRoutes.Market}
    />
  );
}
