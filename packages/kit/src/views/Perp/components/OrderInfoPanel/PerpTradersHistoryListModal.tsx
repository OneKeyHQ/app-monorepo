import { useIntl } from 'react-intl';

import { Page } from '@onekeyhq/components';
import { PageBody } from '@onekeyhq/components/src/layouts/Page/PageBody';
import { PageHeader } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';

export function PerpTradersHistoryListModal() {
  const intl = useIntl();
  return (
    <Page>
      <PageHeader
        title={intl.formatMessage({
          id: ETranslations.perp_trades_history_title,
        })}
      />
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
