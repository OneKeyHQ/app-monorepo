import { useCallback } from 'react';

import { StackActions } from '@react-navigation/native';
import { noop } from 'lodash';
import { useIntl } from 'react-intl';

import { Alert, Empty, Page, Stack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useRouteIsFocused } from '@onekeyhq/kit/src/hooks/useRouteIsFocused';
import {
  enableNotificationsBestEffort,
  isNotificationFullyEnabled,
} from '@onekeyhq/kit/src/utils/notificationPermissionUtils';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';

function BulkExportHistoryTaskCreated() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const isFocused = useRouteIsFocused();

  // The page copy promises "we'll notify you when it's ready", so remind the
  // user when notifications are not fully enabled (master switch + system
  // permission). Re-check on focus so the reminder hides after the user
  // returns from the permission guide or settings.
  const { result: isNotificationReady, run: recheckNotificationState } =
    usePromiseResult(
      async () => {
        noop(isFocused);
        try {
          return await isNotificationFullyEnabled();
        } catch {
          // Best-effort: hide the reminder when the state can't be resolved.
          return true;
        }
      },
      [isFocused],
      { checkIsFocused: false, initResult: true },
    );

  const handleEnableNotificationsPress = useCallback(() => {
    void (async () => {
      await enableNotificationsBestEffort({ navigation });
      await recheckNotificationState();
    })();
  }, [navigation, recheckNotificationState]);

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
          illustration="TxStatusSuccessCircle"
          title={intl.formatMessage({
            id: ETranslations.export_task_created__title,
          })}
          description={intl.formatMessage({
            id: ETranslations.export_started__desc,
          })}
        />
        {isNotificationReady ? null : (
          <Stack px="$5" pt="$5">
            <Alert
              type="info"
              icon="BellOutline"
              title={intl.formatMessage({
                id: ETranslations.export_notification_reminder__desc,
              })}
              action={{
                primary: intl.formatMessage({
                  id: ETranslations.global_enable,
                }),
                onPrimaryPress: handleEnableNotificationsPress,
              }}
            />
          </Stack>
        )}
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
