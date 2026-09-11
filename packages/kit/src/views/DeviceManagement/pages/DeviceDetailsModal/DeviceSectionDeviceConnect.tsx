import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector/actions';
import {
  useDeviceAtom,
  useDeviceDetailsActions,
} from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import thirdPartyDeviceUtils from '@onekeyhq/shared/src/utils/thirdPartyDeviceUtils';
import { EHardwareVendor } from '@onekeyhq/shared/types/device';

import { useDeviceBackNavigation } from '../../hooks/useDeviceBackNavigation';
import { DeviceManagementTestIDs } from '../../testIDs';
import { ListItemGroup } from '../ListItemGroup';

import { useDialogForgetDevice } from './dialog/DialogForgetDevice';

function DeviceSectionDeviceConnect() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const [device] = useDeviceAtom();
  const accountActions = useAccountSelectorActions();
  const { handleBackPress } = useDeviceBackNavigation();
  const { show: showDialogForgetDevice } = useDialogForgetDevice();
  const canRebindBle =
    (platformEnv.isNative || platformEnv.isSupportDesktopBle) &&
    ((device?.vendor === EHardwareVendor.ledger &&
      !!(device.bleConnectId || (platformEnv.isNative && device.connectId))) ||
      (device?.vendor === EHardwareVendor.trezor &&
        thirdPartyDeviceUtils.isTrezorBleSupportedDevice(device)));
  const onPressRebindBle = useCallback(async () => {
    if (!device?.id) return;
    await backgroundApiProxy.serviceThirdPartyHardware.rebindBleDevice({
      dbDeviceId: device.id,
    });
    await actions.refresh(undefined, { skipDeviceStateSnapshot: true });
  }, [actions, device?.id]);

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
      {canRebindBle ? (
        <ListItem
          title={intl.formatMessage({ id: ETranslations.global_bluetooth })}
          subtitle={intl.formatMessage({
            id: ETranslations.device_stage_reconnect__action,
          })}
          titleProps={{ size: '$bodyMdMedium', color: '$text' }}
          drillIn
          onPress={onPressRebindBle}
          testID={DeviceManagementTestIDs.rebindBleItem}
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
