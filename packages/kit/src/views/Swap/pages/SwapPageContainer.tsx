import { Page } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabPageHeader } from '../../../components/TabPageHeader';

import SwapMainLandWithPageType from './components/SwapMainLand';

const SwapPageContainer = () => (
  <Page scrollEnabled skipLoading={platformEnv.isNativeIOS}>
    <TabPageHeader sceneName={EAccountSelectorSceneName.swap} />
    <Page.Body>
      <SwapMainLandWithPageType />
    </Page.Body>
  </Page>
);
export default SwapPageContainer;
