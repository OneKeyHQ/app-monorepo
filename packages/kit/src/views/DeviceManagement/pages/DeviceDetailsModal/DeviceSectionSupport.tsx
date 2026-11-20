import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  resolveDeviceState,
  useDeviceDetailsActions,
  useDeviceStateSnapshotAtom,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { useFirmwareVerifyDialog } from '../../../Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import { useDeviceManagerNavigation } from '../../hooks/useDeviceManagerNavigation';
import { DeviceManagementTestIDs } from '../../testIDs';
import { ListItemGroup } from '../ListItemGroup';
import { LIST_ITEM_TITLE_SIZE } from '../listItemGroupLayout';

import { useDialogDeviceAbout } from './dialog/DialogDeviceAbout';

import type { AllFirmwareRelease } from '@onekeyfe/hd-core';
import type { EFirmwareType } from '@onekeyfe/hd-shared';

function DeviceSectionSupport({
  onPressCheckForUpdates,
  showFirmwareVerify = true,
  showFirmwareUpdate = true,
  showTroubleshooting = true,
}: {
  onPressCheckForUpdates: (
    firmwareType?: EFirmwareType,
    baseReleaseInfo?: AllFirmwareRelease,
  ) => void;
  showFirmwareVerify?: boolean;
  showFirmwareUpdate?: boolean;
  // Off while the help sidebar is on screen; it covers troubleshooting.
  showTroubleshooting?: boolean;
}) {
  const intl = useIntl();
  const { pushToTroubleshooting } = useDeviceManagerNavigation();

  const actions = useDeviceDetailsActions();
  const [deviceStateSnapshot] = useDeviceStateSnapshotAtom();

  const { show: showDialogDeviceAbout } = useDialogDeviceAbout();

  const onPressAboutDevice = useCallback(async () => {
    const walletWithDevice = await actions.getWalletWithDevice();
    if (!walletWithDevice) return;

    showDialogDeviceAbout(
      walletWithDevice,
      resolveDeviceState({
        persistedState: walletWithDevice.device?.deviceStateInfo,
        snapshot: deviceStateSnapshot,
      }),
    );
  }, [actions, deviceStateSnapshot, showDialogDeviceAbout]);

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
    <ListItemGroup withSeparator>
      <ListItem
        key="aboutDevice"
        title={intl.formatMessage({
          id: ETranslations.global_about_device,
        })}
        titleProps={{ size: LIST_ITEM_TITLE_SIZE, color: '$text' }}
        drillIn
        onPress={onPressAboutDevice}
        testID={DeviceManagementTestIDs.aboutDeviceItem}
      />
      {showFirmwareVerify ? (
        <ListItem
          key="authRequest"
          title={intl.formatMessage({
            id: ETranslations.device_auth_request_title,
          })}
          titleProps={{ size: LIST_ITEM_TITLE_SIZE, color: '$text' }}
          drillIn
          onPress={onPressAuthRequest}
          isLoading={isFirmwareVerifyDialogLoading}
          testID={DeviceManagementTestIDs.authRequestItem}
        />
      ) : null}
      {showFirmwareUpdate ? (
        <ListItem
          key="checkForUpdates"
          title={intl.formatMessage({
            id: ETranslations.global_check_for_updates,
          })}
          titleProps={{ size: LIST_ITEM_TITLE_SIZE, color: '$text' }}
          drillIn
          onPress={() => onPressCheckForUpdates()}
          testID={DeviceManagementTestIDs.checkForUpdatesItem}
        />
      ) : null}
      {showTroubleshooting ? (
        <ListItem
          key="troubleshooting"
          title={intl.formatMessage({
            id: ETranslations.global_hardware_troubleshooting,
          })}
          titleProps={{ size: LIST_ITEM_TITLE_SIZE, color: '$text' }}
          drillIn
          onPress={onPressTroubleshooting}
          testID={DeviceManagementTestIDs.troubleshootingItem}
        />
      ) : null}
    </ListItemGroup>
  );
}

export default DeviceSectionSupport;
