import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Empty, Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function BulkExportHistoryTaskCreated() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleViewHistory = useCallback(() => {
    // TODO: navigate to the export history list page once it is implemented
  }, []);

  const handleClose = useCallback(() => {
    navigation.popStack();
  }, [navigation]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_export_transaction_history,
        })}
      />
      <Page.Body pt="$10">
        <Empty
          icon="CheckRadioSolid"
          iconProps={{ color: '$iconSuccess' }}
          title="Export started"
          description="Your CSV is being generated in the background. We'll notify you when it's ready. You can also view this export in Export History."
        />
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onCancelText="View history"
          cancelButtonProps={{
            onPress: handleViewHistory,
          }}
          onConfirmText={intl.formatMessage({
            id: ETranslations.global_done,
          })}
          confirmButtonProps={{
            onPress: handleClose,
          }}
        />
      </Page.Footer>
    </Page>
  );
}

export default BulkExportHistoryTaskCreated;
