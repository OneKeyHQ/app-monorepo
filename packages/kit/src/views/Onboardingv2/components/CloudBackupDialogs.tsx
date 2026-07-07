import { createRef, forwardRef, useImperativeHandle, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Input,
  SizableText,
  Stack,
  Toast,
} from '@onekeyhq/components';
import type { IDialogShowProps } from '@onekeyhq/components/src/composite/Dialog/type';
import { onboardingCloudBackupListRefreshAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

import type { IAppNavigation } from '../../../hooks/useAppNavigation';
import type { IntlShape } from 'react-intl';

type ICloudBackupPasswordDialogContentRef = {
  getPassword: () => string;
  validate: () => boolean;
};

const CLOUD_BACKUP_PASSWORD_DIALOG_ESTIMATED_CONTENT_HEIGHT = 96;
const CLOUD_BACKUP_PASSWORD_CONFIRM_DIALOG_ESTIMATED_CONTENT_HEIGHT = 178;

function getRequiredPasswordMessage(intl: IntlShape) {
  return intl.formatMessage({
    id: ETranslations.address_book_add_address_name_required,
  });
}

function getPasswordErrorMessage(intl: IntlShape, value: string) {
  if (!value.trim()) {
    return getRequiredPasswordMessage(intl);
  }
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
  return undefined;
}

function getConfirmPasswordErrorMessage(
  intl: IntlShape,
  password: string,
  confirmPassword: string,
) {
  if (!confirmPassword.trim()) {
    return getRequiredPasswordMessage(intl);
  }
  if (confirmPassword !== password) {
    return intl.formatMessage({
      id: ETranslations.auth_error_password_not_match,
    });
  }
  return undefined;
}

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
        <SizableText size="$bodyMd" pt="$1.5" color="$textCritical">
          {description}
        </SizableText>
      ) : null}
    </>
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

const CloudBackupPasswordDialogContent = forwardRef<
  ICloudBackupPasswordDialogContentRef,
  {
    showConfirmPasswordField: boolean | undefined;
    showForgotPasswordButton: boolean | undefined;
    onPressForgotPassword?: () => void;
  }
>(function CloudBackupPasswordDialogContent(
  { showConfirmPasswordField, showForgotPasswordButton, onPressForgotPassword },
  ref,
) {
  const intl = useIntl();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [confirmPasswordError, setConfirmPasswordError] = useState<
    string | undefined
  >();

  useImperativeHandle(
    ref,
    () => ({
      getPassword: () => password,
      validate: () => {
        const nextPasswordError = getPasswordErrorMessage(intl, password);
        const nextConfirmPasswordError = showConfirmPasswordField
          ? getConfirmPasswordErrorMessage(intl, password, confirmPassword)
          : undefined;

        setPasswordError(nextPasswordError);
        setConfirmPasswordError(nextConfirmPasswordError);

        return !nextPasswordError && !nextConfirmPasswordError;
      },
    }),
    [confirmPassword, intl, password, showConfirmPasswordField],
  );

  return (
    <>
      <SizableText size="$bodyMdMedium" mb="$1.5">
        {intl.formatMessage({
          id: ETranslations.prime_password,
        })}
      </SizableText>
      <DialogInput
        value={password}
        onChange={(value) => {
          setPassword(value);
          setPasswordError(undefined);
          if (confirmPasswordError) {
            setConfirmPasswordError(undefined);
          }
        }}
        description={passwordError}
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
      {showConfirmPasswordField ? (
        <>
          <SizableText size="$bodyMdMedium" mt="$3" mb="$1.5">
            {intl.formatMessage({
              id: ETranslations.prime_confirm_password,
            })}
          </SizableText>
          <DialogInput
            value={confirmPassword}
            onChange={(value) => {
              setConfirmPassword(value);
              setConfirmPasswordError(undefined);
            }}
            description={confirmPasswordError}
            placeholder={intl.formatMessage({
              id: ETranslations.auth_confirm_password_form_placeholder,
            })}
            autoFocus={false}
          />
        </>
      ) : null}
      {showForgotPasswordButton ? (
        <ForgotPasswordButton onPressForgotPassword={onPressForgotPassword} />
      ) : null}
    </>
  );
});

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
  const contentRef = createRef<ICloudBackupPasswordDialogContentRef>();
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
        ref={contentRef}
        showConfirmPasswordField={showConfirmPasswordField}
        showForgotPasswordButton={showForgotPasswordButton}
        onPressForgotPassword={onPressForgotPassword}
      />
    ),
    onConfirm: async ({ close, preventClose }) => {
      if (!contentRef.current?.validate()) {
        preventClose();
        return;
      }

      await onSubmit(contentRef.current.getPassword());
      // fix toast dropped frames
      await close();
    },
    ...dialogProps,
    estimatedContentHeight:
      dialogProps.estimatedContentHeight ??
      (showConfirmPasswordField
        ? CLOUD_BACKUP_PASSWORD_CONFIRM_DIALOG_ESTIMATED_CONTENT_HEIGHT
        : CLOUD_BACKUP_PASSWORD_DIALOG_ESTIMATED_CONTENT_HEIGHT),
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
