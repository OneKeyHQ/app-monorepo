import { useState } from 'react';

import emojiRegex from 'emoji-regex';
import { useIntl } from 'react-intl';

import type { IDialogShowProps } from '@onekeyhq/components';
import {
  Dialog,
  Form,
  Keyboard,
  SizableText,
  Stack,
  Toast,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { RenameInputWithNameSelector } from '@onekeyhq/kit/src/components/RenameDialog';
import { MAX_LENGTH_HW_LABEL_NAME } from '@onekeyhq/kit/src/components/RenameDialog/renameConsts';
import type { IDBWallet } from '@onekeyhq/kit-bg/src/dbs/local/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  EChangeHistoryContentType,
  EChangeHistoryEntityType,
} from '@onekeyhq/shared/src/types/changeHistory';

import type { IntlShape } from 'react-intl';

const HARDWARE_LABEL_DIALOG_ESTIMATED_CONTENT_HEIGHT = 148;

function getDeviceLabelErrorMessage({
  value,
  intl,
  asciiOnly,
  maxLength,
}: {
  value: string;
  intl: IntlShape;
  asciiOnly?: boolean;
  maxLength: number;
}) {
  if (!value.length) {
    return intl.formatMessage({
      id: ETranslations.form_rename_error_empty,
    });
  }

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

  if (asciiOnly && /[^\x20-\x7E]/.test(value)) {
    return intl.formatMessage({
      id: ETranslations.global_hardware_label_input_error,
    });
  }

  return undefined;
}

function DeviceLabelDialogContent(props: {
  wallet: IDBWallet | undefined;
  deviceLabel: string;
  asciiOnly?: boolean;
  onSubmit: (name: string) => Promise<void>;
}) {
  const intl = useIntl();
  const { wallet, deviceLabel, asciiOnly, onSubmit } = props;
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState(deviceLabel || '');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  const maxLength = MAX_LENGTH_HW_LABEL_NAME;
  return (
    <>
      <Stack>
        <SizableText size="$bodyMdMedium" mb="$1.5">
          {intl.formatMessage({
            id: ETranslations.global_hardware_label_title,
          })}
        </SizableText>
        <RenameInputWithNameSelector
          value={name}
          onChange={(nextValue) => {
            setName(nextValue);
            if (errorMessage) {
              setErrorMessage(undefined);
            }
          }}
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
          deferEnhancements
        />
        {errorMessage ? (
          <Form.FieldDescription color="$textCritical">
            {errorMessage}
          </Form.FieldDescription>
        ) : null}
      </Stack>
      <Dialog.Footer
        confirmButtonProps={{
          loading: isLoading,
        }}
        onCancel={Keyboard.dismiss}
        onConfirm={async ({ close, preventClose }) => {
          const nextErrorMessage = getDeviceLabelErrorMessage({
            value: name,
            intl,
            asciiOnly,
            maxLength,
          });
          if (nextErrorMessage) {
            preventClose();
            setErrorMessage(nextErrorMessage);
            return;
          }

          await Keyboard.dismissWithDelay(350);
          try {
            setIsLoading(true);
            await onSubmit(name);
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
      title: intl.formatMessage({ id: ETranslations.global_rename }),
      renderContent: (
        <DeviceLabelDialogContent
          wallet={wallet}
          deviceLabel={deviceLabel}
          asciiOnly={asciiOnly}
          onSubmit={onSubmit}
        />
      ),
      showFooter: false,
      ...dialogProps,
      estimatedContentHeight:
        dialogProps.estimatedContentHeight ??
        HARDWARE_LABEL_DIALOG_ESTIMATED_CONTENT_HEIGHT,
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
