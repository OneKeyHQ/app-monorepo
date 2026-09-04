import { useState } from 'react';

import { useIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components';
import {
  Dialog,
  Keyboard,
  Toast,
  useDialogInstance,
} from '@onekeyhq/components';
import { useFormWatch } from '@onekeyhq/components/src/hooks/useForm';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { RenameInputWithNameSelector } from '@onekeyhq/kit/src/components/RenameDialog';
import { MAX_LENGTH_HW_LABEL_NAME } from '@onekeyhq/kit/src/components/RenameDialog/renameConsts';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';

import { AccountManagerTestIDs } from '../../testIDs';

import {
  getHardwareLabelValidationError,
  normalizeHardwareLabelValue,
} from './hardwareLabelValidation';

import type { IntlShape } from 'react-intl';

function DeviceLabelFormField(props: {
  wallet: IDBWallet | undefined;
  asciiOnly?: boolean;
  maxLength?: number;
  disabledMaxLengthLabel?: boolean;
  description?: string;
  trimOuterWhitespace?: boolean;
}) {
  const intl = useIntl();
  const {
    wallet,
    asciiOnly,
    maxLength = MAX_LENGTH_HW_LABEL_NAME,
    disabledMaxLengthLabel = true,
    description,
    trimOuterWhitespace,
  } = props;
  const labelValue = useFormWatch<{ name: string }>({ name: 'name' }) ?? '';
  const normalizedLabelValue = normalizeHardwareLabelValue(
    labelValue,
    trimOuterWhitespace,
  );
  const validationError = getHardwareLabelValidationError({
    value: labelValue,
    maxLength,
    asciiOnly,
    trimOuterWhitespace,
  });
  let validationErrorMessage: string | undefined;
  if (!normalizedLabelValue) {
    validationErrorMessage = intl.formatMessage({
      id: ETranslations.form_rename_error_empty,
    });
  } else if (validationError === 'tooLong') {
    validationErrorMessage = intl.formatMessage({
      id: ETranslations.global_hardware_name_input_max,
    });
  } else if (validationError === 'invalid') {
    validationErrorMessage = intl.formatMessage({
      id: ETranslations.global_hardware_label_input_error,
    });
  }

  return (
    <Dialog.FormField
      testID={AccountManagerTestIDs.walletRenameInput}
      name="name"
      renderErrorMessage={() => <></>}
      label={intl.formatMessage({
        id: ETranslations.global_hardware_label_title,
      })}
      rules={{
        ...(trimOuterWhitespace
          ? {}
          : {
              maxLength: {
                value: maxLength,
                message: 'Label is too long',
              },
            }),
        validate: (value: string) => {
          const normalizedValue = normalizeHardwareLabelValue(
            value,
            trimOuterWhitespace,
          );
          if (!normalizedValue) {
            return intl.formatMessage({
              id: ETranslations.form_rename_error_empty,
            });
          }
          const formValidationError = getHardwareLabelValidationError({
            value,
            maxLength,
            asciiOnly,
            trimOuterWhitespace,
          });
          if (formValidationError === 'tooLong') {
            return intl.formatMessage({
              id: ETranslations.global_hardware_name_input_max,
            });
          }
          if (formValidationError === 'invalid') {
            return intl.formatMessage({
              id: ETranslations.global_hardware_label_input_error,
            });
          }
          return true;
        },
        required: {
          value: true,
          message: intl.formatMessage({
            id: ETranslations.form_rename_error_empty,
          }),
        },
      }}
    >
      <RenameInputWithNameSelector
        inputTestID={AccountManagerTestIDs.walletRenameInput}
        forceHasError={Boolean(validationErrorMessage)}
        validationErrorMessage={validationErrorMessage}
        validationErrorTestID={AccountManagerTestIDs.walletRenameError}
        disabledMaxLengthLabel={disabledMaxLengthLabel}
        maxLength={maxLength}
        trimOuterWhitespace={trimOuterWhitespace}
        description={
          description ??
          intl.formatMessage({
            id: ETranslations.global_hardware_label_desc,
          })
        }
        nameHistoryInfo={{
          entityId: wallet?.id || '',
          entityType: EChangeHistoryEntityType.Wallet,
          contentType: EChangeHistoryContentType.Name,
        }}
      />
    </Dialog.FormField>
  );
}

function DeviceLabelDialogContent(props: {
  wallet: IDBWallet | undefined;
  deviceLabel: string;
  asciiOnly?: boolean;
  maxLength?: number;
  disabledMaxLengthLabel?: boolean;
  description?: string;
  trimOuterWhitespace?: boolean;
  onSubmit: (name: string) => Promise<void>;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const [isLoading, setIsLoading] = useState(false);
  const {
    wallet,
    deviceLabel,
    asciiOnly,
    maxLength,
    disabledMaxLengthLabel,
    description,
    trimOuterWhitespace,
    onSubmit,
  } = props;

  return (
    <>
      <Dialog.Form
        formProps={{
          values: { name: deviceLabel || '' },
          mode: 'onChange',
          reValidateMode: 'onChange',
        }}
      >
        <DeviceLabelFormField
          wallet={wallet}
          asciiOnly={asciiOnly}
          maxLength={maxLength}
          disabledMaxLengthLabel={disabledMaxLengthLabel}
          description={description}
          trimOuterWhitespace={trimOuterWhitespace}
        />
      </Dialog.Form>
      <Dialog.Footer
        confirmButtonProps={{
          loading: isLoading,
          testID: AccountManagerTestIDs.walletRenameConfirm,
        }}
        onCancel={async () => {
          Keyboard.dismiss();
          await dialog.close();
        }}
        onConfirm={async ({ getForm, close }) => {
          await Keyboard.dismissWithDelay(350);
          try {
            setIsLoading(true);
            const form = getForm();
            if (!form) {
              return;
            }
            await onSubmit(
              normalizeHardwareLabelValue(
                form?.getValues().name,
                trimOuterWhitespace,
              ),
            );
            // fix toast dropped frames
            await close();
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.feedback_change_saved,
              }),
            });
          } finally {
            setIsLoading(false);
          }
        }}
      />
    </>
  );
}

export const showLabelSetDialog = async (
  {
    wallet,
    intl,
    asciiOnly,
  }: {
    wallet: IDBWallet | undefined;
    intl: IntlShape;
    asciiOnly?: boolean;
  },
  {
    onSubmit,
    maxLength,
    disabledMaxLengthLabel,
    description,
    trimOuterWhitespace,
    ...dialogProps
  }: IDialogShowProps & {
    maxLength?: number;
    onSubmit: (name: string) => Promise<void>;
    disabledMaxLengthLabel?: boolean;
    description?: string;
    trimOuterWhitespace?: boolean;
  },
) => {
  try {
    const deviceLabel = await backgroundApiProxy.serviceHardware.getDeviceLabel(
      {
        walletId: wallet?.id || '',
      },
    );

    const dialog = Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_rename }),
      renderContent: (
        <DeviceLabelDialogContent
          wallet={wallet}
          deviceLabel={deviceLabel}
          asciiOnly={asciiOnly}
          maxLength={maxLength}
          disabledMaxLengthLabel={disabledMaxLengthLabel}
          description={description}
          trimOuterWhitespace={trimOuterWhitespace}
          onSubmit={onSubmit}
        />
      ),
      showFooter: false,
      ...dialogProps,
    });

    return dialog;
  } catch (error) {
    Toast.error({
      title: intl.formatMessage({
        id: ETranslations.global_connet_error_try_again,
      }),
    });
    throw error;
  }
};
