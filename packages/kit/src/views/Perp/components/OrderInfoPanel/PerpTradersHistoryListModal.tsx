import { Page } from '@onekeyhq/components';
import { PageBody } from '@onekeyhq/components/src/layouts/Page/PageBody';

import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
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
    <PerpsProviderMirror>
      <PerpTradersHistoryListModal />
    </PerpsProviderMirror>
  );
};

export default function PerpTradersHistoryModal() {
  return (
    <PerpsAccountSelectorProviderMirror>
      <PerpTradersHistoryListModalWithProvider />
    </PerpsAccountSelectorProviderMirror>
  );
}
