import { useCallback, useState } from 'react';

import { StackActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Alert,
  Page,
  Progress,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useV4migrationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/v4migration';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import {
  V4MigrationLogCopy,
  V4MigrationLogCopyHeaderRight,
} from './components/V4MigrationLogCopy';
import { V4MigrationModalPage } from './components/V4MigrationModalPage';
import { EModalExitPreventMode } from './hooks/useV4MigrationExitPrevent';

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

export function V4MigrationProcess({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  route,
}: IPageScreenProps<
  IOnboardingParamList,
  EOnboardingPages.V4MigrationProcess
>) {
  const navigation = useAppNavigation();
  const intl = useIntl();
  const [migrateLoading, setMigrateLoading] = useState(false);
  const { serviceV4Migration } = backgroundApiProxy;
  const [preventClose, setPreventClose] = useState(true);

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
    <V4MigrationModalPage
      scrollEnabled={false}
      exitPreventMode={
        preventClose
          ? EModalExitPreventMode.always
          : EModalExitPreventMode.disabled
      }
      onMounted={handleMigrateFromV4}
    >
      <Page.Header
        headerBackTitle={undefined}
        headerBackVisible={false}
        headerRight={V4MigrationLogCopyHeaderRight}
        headerTitle={intl.formatMessage({
          id: ETranslations.v4_migration_update_in_progress,
        })}
        disableClose
      />
      <Page.Body
        py="$2.5"
        px="$5"
        space="$5"
        flex={1}
        alignItems="center"
        justifyContent="center"
      >
        <V4MigrationLogCopy alignSelf="stretch">
          <Alert
            type="warning"
            title={intl.formatMessage({
              id: ETranslations.v4_migration_update_in_progress_alert_title,
            })}
            description={intl.formatMessage({
              id: ETranslations.v4_migration_update_in_progress_alert_description,
            })}
          />
        </V4MigrationLogCopy>

        <V4MigrationProgressBar />
      </Page.Body>
    </V4MigrationModalPage>
  );
}

export default V4MigrationProcess;
