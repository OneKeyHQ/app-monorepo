import { useCallback, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Dialog, SizableText } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { generateUUID } from '@onekeyhq/shared/src/utils/miscUtils';

import { PasswordKeyboard } from '../components/PasswordKeyboard';

function PasswordKeyboardDescription({
  description,
  shouldConfirmPassword,
}: {
  description?: string;
  shouldConfirmPassword?: string;
}) {
  const intl = useIntl();
  const [password, setPassword] = useState('');
  const showError =
    shouldConfirmPassword &&
    password.length === shouldConfirmPassword.length &&
    shouldConfirmPassword !== password;
  return (
    <Dialog.Form
      formProps={{
        defaultValues: {},
      }}
    >
      <SizableText size="$bodyLg" color={showError ? '$textCritical' : '$text'}>
        {showError
          ? intl.formatMessage({ id: ETranslations.hardware_pins_do_not_match })
          : description}
      </SizableText>
      <Dialog.FormField name="password">
        <PasswordKeyboard
          onChange={(value) => {
            setPassword(value);
            return value;
          }}
        />
      </Dialog.FormField>
    </Dialog.Form>
  );
}

export default function usePIN() {
  const intl = useIntl();
  const showPINFormDialog = useCallback(
    (isSetNewPassword?: boolean, shouldConfirmPassword?: string) => {
      const config = {
        title: intl.formatMessage({
          id: ETranslations.hardware_enter_onekey_lite_pin,
        }),
        description: intl.formatMessage({
          id: ETranslations.hardware_enter_onekey_lite_pin_desc,
        }),
      };
      if (isSetNewPassword) {
        config.title = intl.formatMessage({
          id: ETranslations.hardware_set_onekey_lite_pin,
        });
        config.description = intl.formatMessage({
          id: ETranslations.hardware_set_onekey_lite_pin_desc,
        });
        if (shouldConfirmPassword) {
          config.title = intl.formatMessage({
            id: ETranslations.hardware_confirm_onekey_lite_pin,
          });
          config.description = intl.formatMessage({
            id: ETranslations.hardware_confirm_onekey_lite_pin_desc,
          });
        }
      }
      const operationId = generateUUID();
      const startedAt = Date.now();
      const logDialog = (
        phase:
          | 'dialog-show-request'
          | 'dialog-show-returned'
          | 'pin-confirm-resolve'
          | 'dialog-close-start'
          | 'dialog-close',
        closeReason?: 'confirm' | 'cancel' | 'other',
      ) => {
        defaultLogger.hardware.liteCard.diagnostic({
          operation: 'pin',
          operationId,
          phase,
          elapsedMs: Date.now() - startedAt,
          isSetNewPassword: Boolean(isSetNewPassword),
          isConfirm: Boolean(shouldConfirmPassword),
          closeReason,
        });
      };
      return new Promise<string>((resolve) => {
        logDialog('dialog-show-request');
        Dialog.confirm({
          icon: 'GiroCardOutline',
          title: config.title,
          renderContent: (
            <PasswordKeyboardDescription
              shouldConfirmPassword={shouldConfirmPassword}
              description={config.description}
            />
          ),
          confirmButtonProps: {
            disabledOn: (dialogInstance) => {
              const value = dialogInstance.getForm()?.getValues()
                .password as string;
              const disable = !(value?.length >= 6);
              if (!disable && shouldConfirmPassword) {
                return shouldConfirmPassword !== value;
              }
              return disable;
            },
          },
          onConfirm: (dialogInstance) => {
            const pin = dialogInstance.getForm()?.getValues().password;
            logDialog('pin-confirm-resolve');
            resolve(pin);
          },
          onCloseStart: () => logDialog('dialog-close-start'),
          onClose: (extra) =>
            logDialog(
              'dialog-close',
              extra?.flag === 'confirm' || extra?.flag === 'cancel'
                ? extra.flag
                : 'other',
            ),
        });
        logDialog('dialog-show-returned');
      });
    },
    [intl],
  );
  return useMemo(() => ({ showPINFormDialog }), [showPINFormDialog]);
}
