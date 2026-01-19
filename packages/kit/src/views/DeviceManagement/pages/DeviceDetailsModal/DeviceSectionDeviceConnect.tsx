import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Toast } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useAccountSelectorActions } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { useDeviceDetailsActions } from '@onekeyhq/kit/src/states/jotai/contexts/deviceDetails';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import { useDeviceBackNavigation } from '../../hooks/useDeviceBackNavigation';
import { ListItemGroup } from '../ListItemGroup';

import { useDialogForgetDevice } from './dialog/DialogForgetDevice';

function DeviceSectionDeviceConnect() {
  const intl = useIntl();
  const actions = useDeviceDetailsActions();
  const accountActions = useAccountSelectorActions();
  const { handleBackPress } = useDeviceBackNavigation();
  const { show: showDialogForgetDevice } = useDialogForgetDevice();

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
      <ListItem
        title={intl.formatMessage({
          id: ETranslations.global_forget_device,
        })}
        titleProps={{ size: '$bodyMdMedium', color: '$text' }}
        drillIn
        onPress={onPressForgetDevice}
      />
    </ListItemGroup>
  );
}

export default DeviceSectionDeviceConnect;
