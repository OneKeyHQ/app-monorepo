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
import deviceUtils from '@onekeyhq/shared/src/utils/deviceUtils';
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
      gap="$2"
      flex={1}
      {...(containerProps as IXStackProps)}
    >
      <Icon size="$5" name="OnekeyDeviceCustom" color="$iconInfo" />
      <SizableText
        flex={1}
        size="$bodyMdMedium"
        color="$text"
        numberOfLines={1}
      >
        {message}
      </SizableText>
      <Button size="small" onPress={onPress} borderRadius="$1">
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
      let message = 'New firmware is available';
      if (result?.detectResult?.toVersion) {
        const firmwareTypeLabel =
          deviceUtils.getFirmwareTypeLabelByFirmwareType({
            firmwareType: result?.detectResult?.toFirmwareType,
            displayFormat: 'withSpace',
          });
        const version = `${firmwareTypeLabel}${result?.detectResult?.toVersion}`;
        message = intl.formatMessage(
          { id: ETranslations.update_firmware_version_available },
          {
            version,
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
          containerProps={{
            pl: '$3',
            pr: '$2',
            py: '$1.5',
            borderWidth: StyleSheet.hairlineWidth,
            borderRadius: '$2',
            borderCurve: 'continuous',
          }}
          message={message}
          onPress={async () => {
            await closePopover?.();
            await closeTooltip?.();
            actions.openChangeLogModal({ connectId });
          }}
        />
      );
    }
    return null;
  }, [
    result?.shouldUpdate,
    result?.detectResult?.toVersion,
    result?.detectResult?.toVersionBle,
    result?.detectResult?.toFirmwareType,
    intl,
    closePopover,
    closeTooltip,
    actions,
    connectId,
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
