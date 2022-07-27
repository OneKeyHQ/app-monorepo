import { FC } from 'react';

import { UI_REQUEST } from '@onekeyfe/hd-core';
import { PermissionsAndroid } from 'react-native';

import { DialogManager } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import PermissionDialog from '@onekeyhq/kit/src/components/PermissionDialog/PermissionDialog';
import { useAppSelector } from '@onekeyhq/kit/src/hooks/redux';
import { navigationRef } from '@onekeyhq/kit/src/provider/NavigationProvider';
import { closeHardwarePopup } from '@onekeyhq/kit/src/store/reducers/hardware';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

const HardwareSpecialPopup: FC = () => {
  const { hardwarePopup } = useAppSelector((s) => s.hardware) || {};

  const { uiRequest } = hardwarePopup;
  const { dispatch } = backgroundApiProxy;

  if (
    uiRequest === UI_REQUEST.LOCATION_PERMISSION ||
    uiRequest === UI_REQUEST.BLUETOOTH_PERMISSION
  ) {
    (async () => {
      const check = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (check || platformEnv.isNativeIOS) {
        DialogManager.show({
          render: (
            <PermissionDialog
              type="bluetooth"
              onClose={() => {
                navigationRef.current?.goBack?.();
                dispatch(closeHardwarePopup());
              }}
            />
          ),
        });
        return;
      }

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      );

      if (
        result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN ||
        result === PermissionsAndroid.RESULTS.DENIED
      ) {
        DialogManager.show({
          render: (
            <PermissionDialog
              type="location"
              onClose={() => {
                navigationRef.current?.goBack?.();
                dispatch(closeHardwarePopup());
              }}
            />
          ),
        });
      } else {
        dispatch(closeHardwarePopup());
      }
    })();
  }
  return null;
};

export default HardwareSpecialPopup;
