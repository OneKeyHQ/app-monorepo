import { useFormContext } from 'react-hook-form';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Form,
  Input,
  Stack,
  Toast,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { onboardingCloudBackupListRefreshAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { IAppNavigation } from '../../../hooks/useAppNavigation';
import type { IntlShape } from 'react-intl';

function DialogInput({
  value,
  onChange,
  description,
  placeholder,
  autoFocus,
}: {
  value?: string;
  onChange?: (val: string) => void;
  description?: string;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <Stack>
        <Input
          testID="onboardingv2-dialog-input-input"
          placeholder={placeholder}
          size="large"
          $gtMd={{ size: 'medium' }}
          autoFocus={autoFocus}
          secureTextEntry
          value={value}
          onChangeText={onChange}
          flex={1}
        />
      </Stack>
      {description ? (
        <Form.FieldDescription>{description}</Form.FieldDescription>
      ) : null}
    </>
  );
}

function PasswordField() {
  const intl = useIntl();

  return (
    <Dialog.FormField
      label={intl.formatMessage({
        id: ETranslations.prime_password,
      })}
      name="password"
      rules={{
        required: {
          value: true,
          message: intl.formatMessage({
            id: ETranslations.address_book_add_address_name_required,
          }),
        },
        validate: (value: string) => {
          if (!value?.trim()) {
            return intl.formatMessage({
              id: ETranslations.address_book_add_address_name_required,
            });
          }
          // Validate minimum 6 digits
          if (value.length < 6) {
            return intl.formatMessage(
              {
                id: ETranslations.prime_error_passcode_too_short,
              },
              {
                length: 6,
              },
            );
          }
          return true;
        },
      }}
    >
      <DialogInput
        placeholder={intl.formatMessage(
          {
            id: ETranslations.global_at_least_variable_characters,
          },
          {
            variable: 6,
          },
        )}
        autoFocus
      />
    </Dialog.FormField>
  );
}

function ConfirmPasswordField() {
  const { getValues } = useFormContext();
  const intl = useIntl();

  return (
    <Dialog.FormField
      name="confirm"
      label={intl.formatMessage({
        id: ETranslations.prime_confirm_password,
      })}
      rules={{
        required: {
          value: true,
          message: intl.formatMessage({
            id: ETranslations.address_book_add_address_name_required,
          }),
        },
        validate: (value: string) => {
          if (!value?.trim()) {
            return intl.formatMessage({
              id: ETranslations.address_book_add_address_name_required,
            });
          }
          if (value !== getValues().password) {
            return intl.formatMessage({
              id: ETranslations.auth_error_password_not_match,
            });
          }
          return true;
        },
      }}
    >
      <DialogInput
        placeholder={intl.formatMessage({
          id: ETranslations.auth_confirm_password_form_placeholder,
        })}
        autoFocus={false}
      />
    </Dialog.FormField>
  );
}

function ForgotPasswordButton({
  onPressForgotPassword,
}: {
  onPressForgotPassword?: () => void;
}) {
  const intl = useIntl();

  return (
    <Button
      testID="onboardingv2-intl-btn"
      alignSelf="flex-start"
      size="small"
      variant="tertiary"
      iconAfter="ChevronRightSmallOutline"
      onPress={onPressForgotPassword}
    >
      {intl.formatMessage({
        id: ETranslations.forgot_password_no_question_mark,
      })}
    </Button>
  );
}

function CloudBackupPasswordDialogContent({
  showConfirmPasswordField,
  showForgotPasswordButton,
  onPressForgotPassword,
}: {
  showConfirmPasswordField: boolean | undefined;
  showForgotPasswordButton: boolean | undefined;
  onPressForgotPassword?: () => void;
}) {
  return (
    <Dialog.Form formProps={{ values: { password: '', confirm: '' } }}>
      <PasswordField />
      {showConfirmPasswordField ? <ConfirmPasswordField /> : null}
      {showForgotPasswordButton ? (
        <ForgotPasswordButton onPressForgotPassword={onPressForgotPassword} />
      ) : null}
    </Dialog.Form>
  );
}

export const showCloudBackupPasswordDialog = ({
  onSubmit,
  isRestoreAction,
  isFirstTimeSetPassword,
  showConfirmPasswordField,
  showForgotPasswordButton,
  onPressForgotPassword,
  intl,
  ...dialogProps
}: IDialogShowProps & {
  isRestoreAction?: boolean;
  isFirstTimeSetPassword?: boolean;
  onSubmit: (input: string) => Promise<void>;
  showConfirmPasswordField?: boolean;
  showForgotPasswordButton?: boolean;
  onPressForgotPassword?: () => void;
  intl: IntlShape;
}) => {
  const title = showConfirmPasswordField
    ? intl.formatMessage({
        id: ETranslations.set_new_backup_password,
      })
    : intl.formatMessage({
        id: ETranslations.verify_backup_password,
      });

  let description = showConfirmPasswordField
    ? intl.formatMessage({
        id: ETranslations.set_new_backup_password_desc,
      })
    : intl.formatMessage({
        id: ETranslations.verify_backup_password_desc,
      });
  if (isRestoreAction) {
    description = intl.formatMessage({
      id: ETranslations.import_backup_password_desc,
    });
  }
  if (isFirstTimeSetPassword) {
    description = intl.formatMessage({
      id: ETranslations.set_new_backup_password_fist_time,
    });
  }

  return Dialog.show({
    title,
    description,
    renderContent: (
      <CloudBackupPasswordDialogContent
        showConfirmPasswordField={showConfirmPasswordField}
        showForgotPasswordButton={showForgotPasswordButton}
        onPressForgotPassword={onPressForgotPassword}
      />
    ),
    onConfirm: async ({ getForm, close }) => {
      const form = getForm();
      await onSubmit(form?.getValues().password);
      // fix toast dropped frames
      await close();
    },
    ...dialogProps,
  });
};

export const showCloudBackupDeleteDialog = ({
  recordID,
  navigation,
  intl,
  ...dialogProps
}: IDialogShowProps & {
  recordID: string;
  navigation: IAppNavigation;
  intl: IntlShape;
}) => {
  Dialog.show({
    icon: 'DeleteOutline',
    tone: 'destructive',
    title: intl.formatMessage({
      id: ETranslations.backup_delete_this_backup,
    }),
    description: intl.formatMessage({
      id: ETranslations.backup_file_permanently_deleted,
    }),
    onConfirmText: intl.formatMessage({
      id: ETranslations.global_delete,
    }),
    confirmButtonProps: {
      variant: 'destructive',
    },
    onCancelText: intl.formatMessage({
      id: ETranslations.global_cancel,
    }),
    onConfirm: async () => {
      await backgroundApiProxy.serviceCloudBackupV2.delete({
        recordId: recordID,
      });
      await onboardingCloudBackupListRefreshAtom.set((v) => v + 1);
      // Show success toast
      Toast.success({
        title: 'Backup deleted',
      });
      // Navigate back to iCloud backup list
      navigation.pop();
    },
    ...dialogProps,
  });
};
