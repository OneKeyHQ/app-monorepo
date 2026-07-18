import { useCallback } from 'react';

import { StackActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import { Empty, Page } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';

function BulkExportHistoryTaskCreated() {
  const intl = useIntl();
  const navigation = useAppNavigation();

  const handleViewHistory = useCallback(() => {
    // Replace instead of push so that going back from the task list returns
    // to the export form page rather than this success page.
    navigation.dispatch(
      StackActions.replace(
        EModalBulkExportHistoryRoutes.BulkExportHistoryTaskList,
      ),
    );
  }, [navigation]);

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
          icon="TxStatusSuccessCircleIllus"
          title={intl.formatMessage({
            id: ETranslations.export_task_created__title,
          })}
          description={intl.formatMessage({
            id: ETranslations.export_started__desc,
          })}
        />
      </Page.Body>
      <Page.Footer>
        <Page.FooterActions
          onCancelText={intl.formatMessage({
            id: ETranslations.view_export_history__action,
          })}
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
