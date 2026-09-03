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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { useDeviceManagerNavigation } from '../../DeviceManagement/hooks/useDeviceManagerNavigation';
import { useFirmwareUpdateDetectStatus } from '../hooks/useFirmwareUpdateDetectStatus';
import { FirmwareUpdateTestIDs } from '../testIDs';

import { BootloaderModeUpdateReminder } from './BootloaderModeUpdateReminder';

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
  const detectResult = useFirmwareUpdateDetectStatus(connectId);
  const shouldUpdate = detectResult?.hasUpgrade;

  const updateButton = useMemo(() => {
    if (shouldUpdate) {
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
  }, [shouldUpdate, intl, closePopover, closeTooltip, pushToDeviceList]);

  if (!updateButton) {
    return null;
  }

  return (
    <XStack>
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
