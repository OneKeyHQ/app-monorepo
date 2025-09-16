import { Page } from '@onekeyhq/components';
import { PageBody } from '@onekeyhq/components/src/layouts/Page/PageBody';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';

export function PerpTradersHistoryListModal() {
  return (
    <Page>
      <PageBody>
        <PerpTradesHistoryList isMobile />
      </PageBody>
    </Page>
  );
}

const PerpTradersHistoryListModalWithProvider = () => {
  return (
    <PerpsProviderMirror storeName={EJotaiContextStoreNames.perps}>
      <PerpTradersHistoryListModal />
    </PerpsProviderMirror>
  );
};

export default function PerpTradersHistoryModal() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <PerpTradersHistoryListModalWithProvider />
    </AccountSelectorProviderMirror>
  );
}
