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

const { isDesktop, isIOS, isAndroid } = platformEnv;

const canInvokeSystemSettings = isDesktop || isIOS || isAndroid;

type PrefContent = Record<PrefType, LocaleIds>;
const titleIds: PrefContent = {
  camera: 'modal__camera_access_not_granted',
};

const contentIds: PrefContent = {
  camera: 'modal__camera_access_not_granted_desc',
};

const PermissionDialog: FC<{
  type: PrefType;
}> = ({ type }) => {
  const intl = useIntl();
  const navigation = useNavigation();
  return (
    <Dialog
      visible
      onClose={() => {
        navigation.getParent()?.goBack();
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
              onPrimaryActionPress: ({ onClose }) => {
                onClose?.();
                if (isIOS) {
                  Linking.openURL('app-settings:');
                } else if (isAndroid) {
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
