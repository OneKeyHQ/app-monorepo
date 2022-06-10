/* eslint-disable no-nested-ternary */
import React, { FC } from 'react';

import * as Application from 'expo-application';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Linking from 'expo-linking';
import { isFunction, isNull, isString } from 'lodash';
import { useIntl } from 'react-intl';

import { Dialog, Icon } from '@onekeyhq/components';
import { LocaleIds } from '@onekeyhq/components/src/locale';
import { PrefType } from '@onekeyhq/desktop/src-electron/preload';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { useNavigation } from '../../hooks';

const { isDesktop, isNative, isNativeIOS, isNativeAndroid } = platformEnv;

const canInvokeSystemSettings = isDesktop || isNative;

type PrefContent = Record<PrefType, LocaleIds>;
/**
 * undefined will use default system link, null will disable jump
 */
type PrefLink = Record<
  PrefType,
  {
    iOS?: string | null | (() => void);
    android?: string | null | (() => void);
    desktop?: null | (() => void);
  }
>;
const titleIds: PrefContent = {
  camera: 'modal__camera_access_not_granted',
  bluetooth: 'modal__bluetooth_access_not_granted',
};

const contentIds: PrefContent = {
  camera: 'modal__camera_access_not_granted_desc',
  bluetooth: 'modal__bluetooth_access_not_granted_desc',
};

const linkMap: PrefLink = {
  camera: {},
  bluetooth: {
    iOS: 'App-Prefs:Bluetooth',
    android: IntentLauncher.ActivityAction.BLUETOOTH_SETTINGS,
    desktop: null,
  },
};

const getCurrentPlatformJumpLink = (
  jumpMethodMap: PrefLink,
  type: PrefType,
) => {
  const methods = jumpMethodMap[type];

  if (isNativeIOS) {
    const defaultIOSJumpMethod = () => Linking.openURL('app-settings:');
    const buildIOSJumpMethod = (link: string) => () => Linking.openURL(link);

    return isString(methods.iOS)
      ? buildIOSJumpMethod(methods.iOS)
      : isNull(methods.iOS)
      ? methods.iOS
      : defaultIOSJumpMethod;
  }

  if (isNativeAndroid) {
    const defaultAndroidJumpMethod = () =>
      IntentLauncher.startActivityAsync(
        IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        { data: `package:${Application.applicationId!}` },
      );
    const buildAndroidJumpMethod = (link: string) => () =>
      IntentLauncher.startActivityAsync(link);

    return isString(methods.android)
      ? buildAndroidJumpMethod(methods.android)
      : isNull(methods.android)
      ? methods.android
      : defaultAndroidJumpMethod;
  }
  if (isDesktop) {
    const defaultDesktopMethod = () => window.desktopApi.openPrefs(type);

    return isFunction(methods.desktop) ? methods.desktop : defaultDesktopMethod;
  }
};

const PermissionDialog: FC<{
  type: PrefType;
  onClose?: () => void;
}> = ({ type, onClose }) => {
  const intl = useIntl();
  const navigation = useNavigation();

  const jumpMethod = getCurrentPlatformJumpLink(linkMap, type);
  const hasJumpedMethodSupport = canInvokeSystemSettings && !!jumpMethod;

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
        hasJumpedMethodSupport
          ? {
              primaryActionProps: {
                children: intl.formatMessage({ id: 'action__go_to_setting' }),
              },
              // eslint-disable-next-line @typescript-eslint/no-shadow
              onPrimaryActionPress: ({ onClose }) => {
                onClose?.();
                jumpMethod?.();
              },
            }
          : { hidePrimaryAction: true }
      }
    />
  );
};
PermissionDialog.displayName = 'PermissionDialog';

export default PermissionDialog;
