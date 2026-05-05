import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useDeviceDetailsActions } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useFirmwareVerifyDialog } from '../../../Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import { useDeviceManagerNavigation } from '../../hooks/useDeviceManagerNavigation';
import { ListItemGroup } from '../ListItemGroup';

import { useDialogDeviceAbout } from './dialog/DialogDeviceAbout';

import type { AllFirmwareRelease } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

function DeviceSectionSupport({
  onPressCheckForUpdates,
}: {
  onPressCheckForUpdates: (
    firmwareType?: EFirmwareType,
    baseReleaseInfo?: AllFirmwareRelease,
  ) => void;
}) {
  const intl = useIntl();
  const { pushToTroubleshooting } = useDeviceManagerNavigation();

  const actions = useDeviceDetailsActions();

  const { show: showDialogDeviceAbout } = useDialogDeviceAbout();

  const onPressAboutDevice = useCallback(async () => {
    const walletWithDevice = await actions.getWalletWithDevice();
    if (!walletWithDevice) return;

    showDialogDeviceAbout(walletWithDevice);
  }, [actions, showDialogDeviceAbout]);

  const { showFirmwareVerifyDialog, isLoading: isFirmwareVerifyDialogLoading } =
    useFirmwareVerifyDialog();
  const onPressAuthRequest = useCallback(async () => {
    const deviceData = await actions.getWalletWithDevice();
    if (!deviceData?.device) {
      return;
    }
    await showFirmwareVerifyDialog({
      device: deviceData.device,
      features: deviceData.device.featuresInfo,
      onContinue: async ({ checked }) => {
        console.log(checked);
      },
      onClose: async () => {},
    });
  }, [showFirmwareVerifyDialog, actions]);

  const onPressTroubleshooting = useCallback(async () => {
    const walletWithDevice = await actions.getWalletWithDevice();
    if (!walletWithDevice) return;
    pushToTroubleshooting({
      walletWithDevice,
    });
  }, [pushToTroubleshooting, actions]);

  return (
    <ListItemGroup withSeparator itemProps={{ minHeight: '$12' }}>
      <ListItem
        key="authRequest"
        title={intl.formatMessage({
          id: ETranslations.global_about_device,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressAboutDevice}
      />
      <ListItem
        key="authRequest"
        title={intl.formatMessage({
          id: ETranslations.device_auth_request_title,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressAuthRequest}
        isLoading={isFirmwareVerifyDialogLoading}
      />
      <ListItem
        key="checkForUpdates"
        title={intl.formatMessage({
          id: ETranslations.global_check_for_updates,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={() => onPressCheckForUpdates()}
      />
      <ListItem
        key="troubleshooting"
        title={intl.formatMessage({
          id: ETranslations.global_hardware_troubleshooting,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressTroubleshooting}
      />
    </ListItemGroup>
  );
}

export default DeviceSectionSupport;
