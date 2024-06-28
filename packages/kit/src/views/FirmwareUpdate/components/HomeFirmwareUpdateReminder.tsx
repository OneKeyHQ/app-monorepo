import { useMemo } from 'react';

import { useIntl } from 'react-intl';

import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';
import { useFirmwareUpdatesDetectStatusAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useFirmwareUpdateActions } from '../hooks/useFirmwareUpdateActions';

import { BootloaderModeUpdateReminder } from './BootloaderModeUpdateReminder';
import { HomeFirmwareUpdateDetect } from './HomeFirmwareUpdateDetect';

export function FirmwareUpdateReminderAlert({
  message,
  onPress,
}: {
  message: string;
  onPress?: () => any;
}) {
  const intl = useIntl();
  return (
    <XStack
      px="$5"
      py="$2"
      borderTopWidth="$px"
      borderBottomWidth="$px"
      bg="$bgInfoSubdued"
      borderColor="$borderInfoSubdued"
      alignItems="center"
      space="$2"
      flex={1}
    >
      <Icon size="$4" name="DownloadOutline" color="$iconInfo" />
      <SizableText
        flex={1}
        size="$bodyMdMedium"
        color="$text"
        numberOfLines={1}
      >
        {message}
      </SizableText>
      <Button size="small" onPress={onPress}>
        {intl.formatMessage({ id: ETranslations.global_view })}
      </Button>
    </XStack>
  );
}

function HomeFirmwareUpdateReminderCmp() {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  const actions = useFirmwareUpdateActions();

  const [detectStatus] = useFirmwareUpdatesDetectStatusAtom();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigation = useAppNavigation();
  const { result } = usePromiseResult(async () => {
    if (!connectId) return undefined;

    const detectResult = detectStatus?.[connectId];
    const shouldUpdate =
      detectResult?.connectId === connectId && detectResult?.hasUpgrade;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const detectInfo =
      await backgroundApiProxy.serviceFirmwareUpdate.getFirmwareUpdateDetectInfo(
        {
          connectId,
        },
      );
    return {
      shouldUpdate,
      detectResult,
    };
  }, [connectId, detectStatus]);

  const updateButton = useMemo(() => {
    if (result?.shouldUpdate) {
      let message = 'New firmware is available';
      if (result?.detectResult?.toVersion) {
        message = intl.formatMessage(
          { id: ETranslations.update_firmware_version_available },
          {
            version: result?.detectResult?.toVersion,
          },
        );
      } else if (result?.detectResult?.toVersionBle) {
        message = intl.formatMessage(
          { id: ETranslations.update_bluetooth_version_available },
          {
            version: result?.detectResult?.toVersionBle,
          },
        );
      }
      return (
        <FirmwareUpdateReminderAlert
          message={message}
          onPress={async () => {
            actions.openChangeLogModal({ connectId });
          }}
        />
      );
    }
    return null;
  }, [intl, actions, connectId, result]);

  return (
    <XStack>
      <HomeFirmwareUpdateDetect />
      <BootloaderModeUpdateReminder />
      {updateButton}
    </XStack>
  );
}

export function HomeFirmwareUpdateReminder() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <HomeFirmwareUpdateReminderCmp />
    </AccountSelectorProviderMirror>
  );
}
