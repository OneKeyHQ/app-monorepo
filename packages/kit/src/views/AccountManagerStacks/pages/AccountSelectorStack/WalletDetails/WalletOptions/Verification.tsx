import { useCallback } from 'react';

import { HardwareErrorCode } from '@onekeyfe/hd-shared';
import { get } from 'lodash';
import { useIntl } from 'react-intl';

import { type IIconProps, type IKeyOfIcons, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useFirmwareVerifyDialog } from '@onekeyhq/kit/src/views/Onboarding/pages/ConnectHardwareWallet/FirmwareVerifyDialog';
import type { IDBDevice } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { OneKeyHardwareError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { WalletOptionItem } from './WalletOptionItem';

import type { SearchDevice } from '@onekeyfe/hd-core';

export function Verification({ device }: { device?: IDBDevice | undefined }) {
  const intl = useIntl();
  // const returnVerified = () => {
  //   setVerified(true);
  //   Toast.success({
  //     title: 'Verified',
  //     message: 'You are good to go',
  //   });
  // };

  // const returnUnofficial = () => {
  //   setUnofficial(true);
  //   Toast.error({
  //     title: 'Unofficial',
  //     message: 'Please contact support',
  //   });
  // };

  const getIconNameAndIconColor = (): {
    iconName: IKeyOfIcons;
    iconColor: IIconProps['color'];
  } => {
    if (device?.verifiedAtVersion) {
      return {
        iconName: 'BadgeVerifiedSolid',
        iconColor: '$iconSuccess',
      };
    }

    if (device?.verifiedAtVersion === '') {
      // unUnofficial device cannot create a wallet
      return {
        iconName: 'ErrorSolid',
        iconColor: '$iconCritical',
      };
    }

    return {
      iconName: 'DocumentSearch2Outline',
      iconColor: '$iconSubdued',
    };
  };

  const { iconColor, iconName } = getIconNameAndIconColor();

  const { showFirmwareVerifyDialog } = useFirmwareVerifyDialog();

  const connectDevice = useCallback(async (deviceInfo: SearchDevice) => {
    try {
      return await backgroundApiProxy.serviceHardware.connect({
        device: deviceInfo,
        awaitBonded: true,
      });
    } catch (error: any) {
      if (error instanceof OneKeyHardwareError) {
        const { code, message } = error;
        // ui prop window handler
        if (
          code === HardwareErrorCode.CallMethodNeedUpgradeFirmware ||
          code === HardwareErrorCode.BlePermissionError ||
          code === HardwareErrorCode.BleLocationError
        ) {
          return;
        }
        Toast.error({
          title: message || 'DeviceConnectError',
        });
      } else {
        console.error('connectDevice error:', get(error, 'message', ''));
      }
    }
  }, []);

  return (
    <WalletOptionItem
      icon={iconName}
      iconColor={iconColor}
      // icon="BadgeVerifiedSolid"
      // iconColor="$iconSuccess"
      label={intl.formatMessage({
        id: ETranslations.device_auth_request_title,
      })}
      onPress={async () => {
        if (!device) {
          return;
        }
        const features = await connectDevice(device);
        if (features) {
          await showFirmwareVerifyDialog({
            device,
            features,
            onContinue: async ({ checked }) => {
              console.log(checked);
            },
          });
        }
        // setTimeout(async () => {
        //   // TODO: dialog.close().then(() => doDomeThing())
        //   await dialog.close();

        //   // if official
        //   returnVerified();

        //   // if unofficial
        //   // returnUnofficial();
        // }, 1500);
      }}
    />
  );
}
