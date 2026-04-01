import { useIntl } from 'react-intl';

import { Empty, Page } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function BulkExportHistory() {
  const intl = useIntl();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_export_transaction_history,
        })}
      />
      <Page.Body>
        <Empty
          mt="$24"
          title={intl.formatMessage({
            id: ETranslations.coming_soon,
          })}
          description={intl.formatMessage({
            id: ETranslations.coming_soon_desc,
          })}
        />
      </Page.Body>
    </Page>
  );
}

export default BulkExportHistory;
