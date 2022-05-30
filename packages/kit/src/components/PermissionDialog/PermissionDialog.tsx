import React, { FC } from 'react';

import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { useIntl } from 'react-intl';

import { Dialog, Icon } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { PrefType } from '@onekeyhq/desktop/src-electron/preload';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../hooks';

const { isDesktop, isNative, isNativeIOS, isNativeAndroid } = platformEnv;

const canInvokeSystemSettings = isDesktop || isNative;

type PrefContent = Record<PrefType, LocaleIds>;
const titleIds: PrefContent = {
  camera: 'modal__camera_access_not_granted',
  bluetooth: 'modal__bluetooth_access_not_granted',
};

const contentIds: PrefContent = {
  camera: 'modal__camera_access_not_granted_desc',
  bluetooth: 'modal__bluetooth_access_not_granted_desc',
};

const PermissionDialog: FC<{
  type: PrefType;
  onClose?: () => void;
}> = ({ type, onClose }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  return (
    <Dialog
      visible
      onClose={() => {
        if (onClose) {
          return onClose();
        }
        return navigation.getParent()?.goBack();
      }}
      contentProps={{
        icon: <Icon name="ExclamationOutline" size={48} />,
        title: intl.formatMessage({ id: titleIds[type] }),
        content: intl.formatMessage({ id: contentIds[type] }),
      }}
      footerButtonProps={
        canInvokeSystemSettings
          ? {
              primaryActionProps: {
                children: intl.formatMessage({ id: 'action__go_to_setting' }),
              },
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onPrimaryActionPress: ({ onClose }) => {
                onClose?.();
                if (isNativeIOS) {
                  Linking.openURL('app-settings:');
                } else if (isNativeAndroid) {
                  IntentLauncher.startActivityAsync(
                    IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    { data: `package:${Application.applicationId!}` },
                  );
                } else if (isDesktop) {
                  window.desktopApi.openPrefs(type);
                }
              },
            }
          : { hidePrimaryAction: true }
      }
    />
  );
};
PermissionDialog.displayName = 'PermissionDialog';

export default PermissionDialog;
