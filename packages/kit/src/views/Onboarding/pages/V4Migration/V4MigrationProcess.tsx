import { useCallback, useState } from 'react';

import { StackActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import {
  Alert,
  Page,
  Progress,
  SizableText,
  Stack,
  usePreventRemove,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useV4migrationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/v4migration';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

function V4MigrationProgressBar() {
  const intl = useIntl();
  const [val] = useV4migrationAtom();
  const progress = val?.progress ?? 0;

  return (
    <Stack
      flex={1}
      alignItems="center"
      justifyContent="center"
      alignSelf="center"
      w="100%"
      maxWidth="$80"
    >
      <Progress w="100%" size="medium" value={progress} />
      <SizableText mt="$5" size="$bodyLg" textAlign="center">
        {intl.formatMessage(
          { id: ETranslations.global_pct_complete },
          {
            ptc: progress,
          },
        )}
      </SizableText>
    </Stack>
  );
}

export function V4MigrationProcess() {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const [migrateLoading, setMigrateLoading] = useState(false);
  const { serviceV4Migration } = backgroundApiProxy;
  const [preventClose, setPreventClose] = useState(true);

  // TODO prevent back, prevent gesture back
  usePreventRemove(preventClose, () => null);

  const handleMigrateFromV4 = useCallback(async () => {
    if (migrateLoading) {
      return;
    }
    try {
      setMigrateLoading(true);
      // TODO error handler
      const result = await serviceV4Migration.startV4MigrationFlow();
      console.log('Migration result:', result);

      // unlock close
      setPreventClose(false);
      await timerUtils.wait(300);

      navigation.dispatch(
        StackActions.replace(EOnboardingPages.V4MigrationDone, undefined),
      );
      // Dialog.show({
      //   showCancelButton: false,
      //   onConfirmText: 'OK',
      //   title: 'Migration Complete',
      //   description: 'Your V4 data have been migrated successfully.',
      //   async onClose() {
      //     setPreventClose(false);
      //     await timerUtils.wait(300);
      //     navigation.popStack();
      //   },
      // });
    } finally {
      setMigrateLoading(false);
    }
  }, [migrateLoading, navigation, serviceV4Migration]);

  return (
    <Page onMounted={handleMigrateFromV4}>
      <Page.Header
        headerBackTitle={undefined}
        headerBackVisible={false}
        headerRight={() => null}
        headerTitle={intl.formatMessage({
          id: ETranslations.v4_migration_update_in_progress,
        })}
      />
      <Page.Body
        py="$2.5"
        px="$5"
        space="$5"
        flex={1}
        alignItems="center"
        justifyContent="center"
      >
        <Alert
          alignSelf="stretch"
          type="warning"
          title={intl.formatMessage({
            id: ETranslations.v4_migration_update_in_progress_alert_title,
          })}
          description={intl.formatMessage({
            id: ETranslations.v4_migration_update_in_progress_alert_description,
          })}
        />
        <V4MigrationProgressBar />
      </Page.Body>
    </Page>
  );
}

export default V4MigrationProcess;
