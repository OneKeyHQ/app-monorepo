import { useState } from 'react';

import emojiRegex from 'emoji-regex';
import { useIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components';
import { Dialog, Keyboard, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { RenameInputWithNameSelector } from '@onekeyhq/kit/src/components/RenameDialog';
import { MAX_LENGTH_HW_LABEL_NAME } from '@onekeyhq/kit/src/components/RenameDialog/renameConsts';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';

function DeviceLabelDialogContent(props: {
  wallet: IDBWallet | undefined;
  deviceLabel: string;
  onSubmit: (name: string) => Promise<void>;
}) {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
  const { wallet, deviceLabel, onSubmit } = props;

  const maxLength = MAX_LENGTH_HW_LABEL_NAME;
  return (
    <>
      <Dialog.Form formProps={{ values: { name: deviceLabel || '' } }}>
        <Dialog.FormField
          name="name"
          label={intl.formatMessage({
            id: ETranslations.global_hardware_label_title,
          })}
          rules={{
            maxLength: {
              value: maxLength,
              message: 'Label is too long',
              // message: intl.formatMessage({
              //   id: 'Label is too long',
              // }),
            },
            validate: (value: string) => {
              if (!value.length) return true;

              if (Buffer.from(value, 'utf-8').length > maxLength) {
                return intl.formatMessage({
                  id: ETranslations.global_hardware_name_input_max,
                });
              }

              const regexRule = emojiRegex();
              if (regexRule.test(value)) {
                return intl.formatMessage({
                  id: ETranslations.global_hardware_label_input_error,
                });
              }
            },
            required: {
              value: true,
              message: appLocale.intl.formatMessage({
                id: ETranslations.form_rename_error_empty,
              }),
            },
          }}
        >
          <RenameInputWithNameSelector
            disabledMaxLengthLabel
            maxLength={maxLength}
            description={intl.formatMessage({
              id: ETranslations.global_hardware_label_desc,
            })}
            nameHistoryInfo={{
              entityId: wallet?.id || '',
              entityType: EChangeHistoryEntityType.Wallet,
              contentType: EChangeHistoryContentType.Name,
            }}
          />
        </Dialog.FormField>
      </Dialog.Form>
      <Dialog.Footer
        confirmButtonProps={{
          loading: isLoading,
        }}
        onCancel={Keyboard.dismiss}
        onConfirm={async ({ getForm, close }) => {
          await Keyboard.dismissWithDelay(350);
          try {
            setIsLoading(true);
            const form = getForm();
            if (!form) {
              return;
            }
            await onSubmit(form?.getValues().name);
            // fix toast dropped frames
            await close();
            Toast.success({
              title: appLocale.intl.formatMessage({
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
  }: {
    wallet: IDBWallet | undefined;
  },
  {
    onSubmit,
    ...dialogProps
  }: IDialogShowProps & {
    maxLength?: number;
    onSubmit: (name: string) => Promise<void>;
    disabledMaxLengthLabel?: boolean;
  },
) => {
  try {
    const deviceLabel = await backgroundApiProxy.serviceHardware.getDeviceLabel(
      {
        walletId: wallet?.id || '',
      },
    );

    const dialog = Dialog.show({
      title: appLocale.intl.formatMessage({ id: ETranslations.global_rename }),
      renderContent: (
        <DeviceLabelDialogContent
          wallet={wallet}
          deviceLabel={deviceLabel}
          onSubmit={onSubmit}
        />
      ),
      showFooter: false,
      ...dialogProps,
    });

    return dialog;
  } catch (error) {
    Toast.error({
      title: appLocale.intl.formatMessage({
        id: ETranslations.global_connet_error_try_again,
      }),
    });
    throw error;
  }
};
