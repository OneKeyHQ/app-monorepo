import { useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IStackProps, IXStackProps } from '@onekeyhq/components';
import {
  Button,
  Icon,
  SizableText,
  XStack,
  usePopoverContext,
  useTooltipContext,
} from '@onekeyhq/components';
import { useFirmwareUpdatesDetectStatusPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useDeviceManagerNavigation } from '../../DeviceManagement/hooks/useDeviceManagerNavigation';
import { FirmwareUpdateTestIDs } from '../testIDs';

import { BootloaderModeUpdateReminder } from './BootloaderModeUpdateReminder';
import { HomeFirmwareUpdateDetect } from './HomeFirmwareUpdateDetect';

export function FirmwareUpdateReminderAlert({
  message,
  onPress,
  containerProps,
}: {
  message: string;
  onPress?: () => any;
  containerProps?: IStackProps;
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
      gap="$3"
      justifyContent="space-between"
      flex={1}
      {...(containerProps as IXStackProps)}
    >
      <XStack alignItems="center" gap="$2" flex={1}>
        <Icon
          name="DownloadOutline"
          color="$iconInfo"
          size="$5"
          flexShrink={0}
        />
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          flex={1}
          numberOfLines={1}
        >
          {message}
        </SizableText>
      </XStack>
      <Button
        size="small"
        variant="secondary"
        onPress={onPress}
        borderRadius="$1"
        testID={FirmwareUpdateTestIDs.reminderViewBtn}
      >
        {intl.formatMessage({ id: ETranslations.global_view })}
      </Button>
    </XStack>
  );
}

function HomeFirmwareUpdateReminderCmp() {
  const intl = useIntl();
  const { activeAccount } = useActiveAccount({ num: 0 });
  const connectId = activeAccount.device?.connectId;
  const { pushToDeviceList } = useDeviceManagerNavigation();
  const { closePopover } = usePopoverContext();
  const { closeTooltip } = useTooltipContext();
  const [detectStatus] = useFirmwareUpdatesDetectStatusPersistAtom();

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
      const message = intl.formatMessage({
        id: ETranslations.update_firmware_available,
      });
      return (
        <FirmwareUpdateReminderAlert
          containerProps={{
            px: '$5',
            py: '$1.5',
            borderWidth: StyleSheet.hairlineWidth,
            borderLeftWidth: 0,
            borderRightWidth: 0,
            borderCurve: 'continuous',
          }}
          message={message}
          onPress={async () => {
            await closePopover?.();
            await closeTooltip?.();
            pushToDeviceList();
          }}
        />
      );
    }
    return null;
  }, [
    result?.shouldUpdate,
    intl,
    closePopover,
    closeTooltip,
    pushToDeviceList,
  ]);

  if (!updateButton) {
    return null;
  }

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
