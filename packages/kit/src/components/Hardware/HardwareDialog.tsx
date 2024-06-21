import type { ForwardedRef } from 'react';
import { forwardRef } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogInstance } from '@onekeyhq/components';
import { DialogContainer } from '@onekeyhq/components';
import {
  openBLEPermissionsSettings,
  openBLESettings,
} from '@onekeyhq/shared/src/hardware/blePermissions';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function OpenBleSettingDialogContainer(
  props: any,
  ref: ForwardedRef<IDialogInstance>,
) {
  const intl = useIntl();

  return (
    <DialogContainer
      ref={ref}
      icon="BluetoothOutline"
      title={intl.formatMessage({
        id: ETranslations.onboarding_enable_bluetooth,
      })}
      description={intl.formatMessage({
        id: ETranslations.onboarding_enable_bluetooth_help_text,
      })}
      onConfirmText={intl.formatMessage({
        id: ETranslations.global_go_to_settings,
      })}
      onConfirm={async ({ close }) => {
        await close?.();
        await openBLESettings();
      }}
      showCancelButton={false}
      {...props} // pass down cloneElement props
    />
  );
}

export const OpenBleSettingsDialog = forwardRef(OpenBleSettingDialogContainer);

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
