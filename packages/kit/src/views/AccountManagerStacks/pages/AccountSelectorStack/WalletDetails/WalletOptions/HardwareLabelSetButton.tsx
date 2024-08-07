import { useState } from 'react';

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

import { WalletOptionItem } from './WalletOptionItem';

function RenameInputWithNameSelector({
  value,
  onChange,
  maxLength = 80,
  disabledMaxLengthLabel = false,
}: {
  maxLength?: number;
  value?: string;
  onChange?: (val: string) => void;
  disabledMaxLengthLabel: boolean;
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

  return (
    <>
      <Dialog.Form formProps={{ values: { name: result || '' } }}>
        <Dialog.FormField
          name="name"
          label={intl.formatMessage({
            id: ETranslations.global_hardware_label_title,
          })}
          rules={{
            // TODO maxLength, valid characters
            required: {
              value: true,
              message: appLocale.intl.formatMessage({
                id: ETranslations.form_rename_error_empty,
              }),
            },
          }}
        >
          <RenameInputWithNameSelector
            maxLength={80}
            disabledMaxLengthLabel={false}
          />
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

const showLabelSetDialog = (
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
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_hardware_label,
    }),
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

export function HardwareLabelSetButton({
  wallet,
}: {
  wallet: IDBWallet | undefined;
}) {
  const intl = useIntl();

  return (
    <WalletOptionItem
      icon="TagOutline"
      label={intl.formatMessage({
        id: ETranslations.global_hardware_label,
      })}
      onPress={() => {
        void showLabelSetDialog(
          {
            wallet,
          },
          {
            onSubmit: async (name) => {
              await backgroundApiProxy.serviceHardware.setDeviceLabel({
                walletId: wallet?.id || '',
                label: name,
              });
            },
          },
        );
      }}
    />
  );
}
