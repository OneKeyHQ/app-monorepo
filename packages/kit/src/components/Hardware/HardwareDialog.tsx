import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance, IDialogShowProps } from '@onekeyhq/components';
import { DialogContainer } from '@onekeyhq/components';
import {
  openBLEPermissionsSettings,
  openBLESettings,
} from '@onekeyhq/shared/src/hardware/blePermissions';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import type { IntlShape } from 'react-intl';

export const buildBleSettingsDialogProps = (
  intl: IntlShape,
): IDialogShowProps =>
  ({
    icon: 'BluetoothOutline',
    title: intl.formatMessage({
      id: ETranslations.onboarding_enable_bluetooth,
    }),
    description: intl.formatMessage({
      id: ETranslations.onboarding_enable_bluetooth_help_text,
    }),
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_go_to_settings,
    }),
    onConfirm: async ({ close }) => {
      await close?.();
      await openBLESettings();
    },
    showCancelButton: false,
  } as const);

function OpenBleSettingDialogContainer(
  props: any,
  ref: ForwardedRef<IDialogInstance>,
) {
  const intl = useIntl();

  return (
    <DialogContainer
      ref={ref}
      {...buildBleSettingsDialogProps(intl)}
      {...props} // pass down cloneElement props
    />
  );
}

export const OpenBleSettingsDialog = forwardRef(OpenBleSettingDialogContainer);

export const buildBleNotifyChangeError = (intl: IntlShape): IDialogShowProps =>
  ({
    icon: 'BluetoothOutline',
    title: intl.formatMessage({
      id: ETranslations.feedback_bluetooth_issue,
    }),
    description: intl.formatMessage({
      id: platformEnv.isNativeIOS
        ? ETranslations.feedback_try_toggling_bluetooth
        : ETranslations.feedback_try_repairing_device_in_settings,
    }),
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_go_to_settings,
    }),
    onConfirm: async ({ close }) => {
      await close?.();
      await openBLESettings();
    },
    showCancelButton: false,
  } as const);

function OpenBleNotifyChangeErrorDialogContainer(
  props: any,
  ref: ForwardedRef<IDialogInstance>,
) {
  const intl = useIntl();

  return (
    <DialogContainer
      ref={ref}
      {...buildBleNotifyChangeError(intl)}
      {...props} // pass down cloneElement props
    />
  );
}

export const OpenBleNotifyChangeErrorDialog = forwardRef(
  OpenBleNotifyChangeErrorDialogContainer,
);

function RequireBlePermissionDialogContainer(
  props: any,
  ref: ForwardedRef<IDialogInstance>,
) {
  const intl = useIntl();

  return (
    <DialogContainer
      ref={ref}
      icon="BluetoothOutline"
      title={intl.formatMessage({
        id: ETranslations.onboarding_bluetooth_permission_needed,
      })}
      description={intl.formatMessage({
        id: ETranslations.onboarding_bluetooth_permission_needed_help_text,
      })}
      onConfirmText={intl.formatMessage({
        id: ETranslations.global_go_to_settings,
      })}
      onConfirm={async ({ close }) => {
        await close?.();
        await openBLEPermissionsSettings();
      }}
      showCancelButton={false}
      {...props} // pass down cloneElement props
    />
  );
}

export const RequireBlePermissionDialog = forwardRef(
  RequireBlePermissionDialogContainer,
);
