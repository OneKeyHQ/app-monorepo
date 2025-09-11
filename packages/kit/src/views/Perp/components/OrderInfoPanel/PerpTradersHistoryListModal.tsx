import { Page } from '@onekeyhq/components';
import { PageBody } from '@onekeyhq/components/src/layouts/Page/PageBody';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ProviderJotaiContextHyperliquid } from '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

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
    <ProviderJotaiContextHyperliquid>
      <PerpTradersHistoryListModal />
    </ProviderJotaiContextHyperliquid>
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
