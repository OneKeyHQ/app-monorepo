import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Page } from '@onekeyhq/components';
import { PageBody } from '@onekeyhq/components/src/layouts/Page/PageBody';
import { PageHeader } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { usePerpTradesHistoryViewAllUrl } from '../../hooks/usePerpOrderInfoPanel';
import { PerpsAccountSelectorProviderMirror } from '../../PerpsAccountSelectorProviderMirror';
import { PerpsProviderMirror } from '../../PerpsProviderMirror';

import { PerpTradesHistoryList } from './List/PerpTradesHistoryList';

export function PerpTradersHistoryListModal() {
  const intl = useIntl();
  const { onViewAllUrl } = usePerpTradesHistoryViewAllUrl();
  const headerRight = useCallback(
    () => (
      <Button onPress={onViewAllUrl} variant="tertiary" size="small">
        {intl.formatMessage({
          id: ETranslations.global_view_more,
        })}
      </Button>
    ),
    [onViewAllUrl, intl],
  );
  return (
    <Page>
      <PageHeader
        title={intl.formatMessage({
          id: ETranslations.perp_trades_history_title,
        })}
        headerRight={headerRight}
      />
      <PageBody>
        <PerpTradesHistoryList isMobile useTabsList={false} />
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
