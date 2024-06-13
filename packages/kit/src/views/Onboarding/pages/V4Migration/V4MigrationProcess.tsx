import { useCallback, useMemo, useState } from 'react';

import { StackActions } from '@react-navigation/native';
import { useIntl } from 'react-intl';

import type { IPageScreenProps } from '@onekeyhq/components';
import {
  Page,
  Progress,
  SizableText,
  Stack,
  usePreventRemove,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useV4migrationAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms/v4migration';
import type { IOnboardingParamList } from '@onekeyhq/shared/src/routes';
import { EOnboardingPages } from '@onekeyhq/shared/src/routes';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { V4MigrationWarningMessage } from './V4MigrationWarningMessage';

function V4MigrationProgressBar() {
  const [val] = useV4migrationAtom();

  const intl = useIntl();
  const progress = val?.progress ?? 0;
  const desc = useMemo(() => {
    const t = `${progress}% complete`;
    return t;
  }, [progress]);
  return (
    <Stack py="$6">
      <Stack mt="$12" mb="$3">
        <Progress size="medium" value={progress} />
      </Stack>
      <Stack alignItems="center" justifyContent="center">
        <SizableText size="$bodyLg" color="$textSubdued">
          {desc}
        </SizableText>
      </Stack>
    </Stack>
  );
}

export function V4MigrationProcess({
  route,
}: IPageScreenProps<IOnboardingParamList, EOnboardingPages.GetStarted>) {
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
        headerTitle="Update in progress"
      />
      <Page.Body>
        <V4MigrationWarningMessage
          title="Don't close your app during update"
          description="Migration for users with many accounts can take up to several minutes."
        />
        <Stack alignItems="center" justifyContent="center">
          <V4MigrationProgressBar />
        </Stack>
      </Page.Body>
    </Page>
  );
}

export default V4MigrationProcess;
