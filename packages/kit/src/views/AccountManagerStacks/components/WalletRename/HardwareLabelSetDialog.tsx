import { useState } from 'react';

import emojiRegex from 'emoji-regex';
import { useIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components';
import {
  Dialog,
  Form,
  Input,
  Spinner,
  Stack,
  Toast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

function RenameInputWithNameSelector({
  value,
  onChange,
  maxLength,
}: {
  maxLength?: number;
  value?: string;
  onChange?: (val: string) => void;
}) {
  const intl = useIntl();

  return (
    <>
      <Stack>
        <Input
          size="large"
          $gtMd={{ size: 'medium' }}
          maxLength={maxLength}
          autoFocus
          value={value}
          onChangeText={onChange}
        />
      </Stack>
      {/* {disabledMaxLengthLabel ? null : (
        <Form.FieldDescription textAlign="right">{`${
          value?.length || 0
        }/${maxLength}`}</Form.FieldDescription>
      )} */}
      <Form.FieldDescription>
        {intl.formatMessage({
          id: ETranslations.global_hardware_label_desc,
        })}
      </Form.FieldDescription>
    </>
  );
}

function DeviceLabelDialogContent(props: {
  wallet: IDBWallet | undefined;
  onFail: (error: Error) => void;
  onSubmit: (name: string) => Promise<void>;
}) {
  const intl = useIntl();
  const [isLoading, setIsLoading] = useState(false);
  const { onFail, wallet, onSubmit } = props;
  const { result } = usePromiseResult(
    async () => {
      try {
        return await backgroundApiProxy.serviceHardware.getDeviceLabel({
          walletId: wallet?.id || '',
        });
      } catch (error) {
        onFail?.(error as Error);
        throw error;
      }
    },
    [onFail, wallet?.id],
    {
      debounced: 600,
    },
  );

  if (!result) {
    return (
      <Stack borderRadius="$3" p="$5" bg="$bgSubdued" borderCurve="continuous">
        <Spinner size="large" />
      </Stack>
    );
  }

  const maxLength = 32;

  return (
    <>
      <Dialog.Form formProps={{ values: { name: result || '' } }}>
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
          <RenameInputWithNameSelector maxLength={maxLength} />
        </Dialog.FormField>
      </Dialog.Form>
      <Dialog.Footer
        confirmButtonProps={{
          loading: isLoading,
        }}
        onConfirm={async ({ getForm, close }) => {
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

export const showLabelSetDialog = (
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
  const dialog = Dialog.show({
    title: appLocale.intl.formatMessage({ id: ETranslations.global_rename }),
    renderContent: (
      <DeviceLabelDialogContent
        wallet={wallet}
        onFail={() => {
          void dialog.close();
        }}
        onSubmit={onSubmit}
      />
    ),
    showFooter: false,
    ...dialogProps,
  });
};
