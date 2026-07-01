import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { showTrezorBleBindingDialog } from '@onekeyhq/kit/src/components/Hardware/TrezorBleBindingDialog';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  useDeviceAtom,
  useDeviceDetailsActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useDeviceBackNavigation } from '../../hooks/useDeviceBackNavigation';
import { DeviceManagementTestIDs } from '../../testIDs';
import { ListItemGroup } from '../ListItemGroup';

import { useDialogForgetDevice } from './dialog/DialogForgetDevice';
import { canShowTrezorBleBinding } from './utils';

function DeviceSectionDeviceConnect() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const accountActions = useAccountSelectorActions();
  const { handleBackPress } = useDeviceBackNavigation();
  const { show: showDialogForgetDevice } = useDialogForgetDevice();
  const [device] = useDeviceAtom();

  // Trezor-only USB→BLE binding entry. This section renders for every
  // third-party device (Trezor + Ledger), so gate strictly on the vendor and
  // hide once a BLE connectId is already bound — Ledger never sees this row.
  const canBindTrezorBle = canShowTrezorBleBinding(device);

  const onPressBindBluetooth = useCallback(() => {
    if (!device?.connectId || !device?.deviceId) return;
    showTrezorBleBindingDialog({
      usbConnectId: device.connectId,
      featuresDeviceId: device.deviceId,
      intl,
    });
  }, [device?.connectId, device?.deviceId, intl]);

  const onPressForgetDevice = useCallback(async () => {
    const walletWithDevice = await actions.getWalletWithDevice();
    if (!walletWithDevice) return;
    const walletId = walletWithDevice.wallet.id;
    showDialogForgetDevice({
      onConfirmForgetDevice: async () => {
        try {
          await accountActions.current.removeWallet({
            walletId,
            isRemoveToMocked: false,
          });
          defaultLogger.account.wallet.deleteWallet();
          Toast.success({
            title: intl.formatMessage({
              id: ETranslations.global_forget_device_success,
            }),
          });
          handleBackPress();
        } catch (_error) {
          Toast.error({
            title: intl.formatMessage({
              id: ETranslations.global_cancel,
            }),
          });
        }
      },
    });
  }, [accountActions, actions, intl, handleBackPress, showDialogForgetDevice]);

  return (
    <ListItemGroup
      withSeparator
      itemProps={{ minHeight: '$12' }}
      title={intl.formatMessage({
        id: ETranslations.global_device_connection,
      })}
    >
      {canBindTrezorBle ? (
        <ListItem
          title={intl.formatMessage({ id: ETranslations.global_bluetooth })}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          drillIn
          onPress={onPressBindBluetooth}
        />
      ) : null}
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.global_forget_device,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressForgetDevice}
        testID={DeviceManagementTestIDs.forgetDeviceItem}
      />
    </ListItemGroup>
  );
}

export default DeviceSectionDeviceConnect;
