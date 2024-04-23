import { Page } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { TabPageHeader } from '../../../components/TabPageHeader';

import SwapMainLand from './components/SwapMainLand';

const SwapPageContainer = () => (
  <Page scrollEnabled>
    <TabPageHeader sceneName={EAccountSelectorSceneName.swap} />
    <Page.Body>
      <SwapMainLand />
    </Page.Body>
  </Page>
);
export default SwapPageContainer;
