import type { PropsWithChildren } from 'react';
import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Alert,
  Dialog,
  Empty,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

const ContentSpinner = () => (
  <Stack h="100%" justifyContent="center" alignItems="center">
    <Spinner size="large" />
  </Stack>
);
const ContentQuestionList = () => {
  const intl = useIntl();

  const contentItems = [
    {
      index: 1,
      titleId: ETranslations.address_book_data_anomaly_why_risk,
      descriptionId:
        ETranslations.address_book_data_anomaly_why_risk_description,
    },
    {
      index: 2,
      titleId: ETranslations.address_book_data_anomaly_what_do,
      descriptionId:
        ETranslations.address_book_data_anomaly_why_reset_description,
    },
    {
      index: 3,
      titleId: ETranslations.address_book_data_anomaly_will_lost,
      descriptionId:
        ETranslations.address_book_data_anomaly_will_lost_description,
    },
  ];

  return (
    <Stack px="$4" gap="$4">
      {contentItems.map(({ index, titleId, descriptionId }) => (
        <XStack key={index} gap="$2">
          <Stack
            m="$0.5"
            w="$4"
            h="$4"
            userSelect="none"
            borderRadius="$full"
            borderColor="$icon"
            borderWidth={1.2}
            alignItems="center"
            justifyContent="center"
          >
            <SizableText color="$text" size="$bodySm">
              {index}
            </SizableText>
          </Stack>
          <Stack gap="$2" flex={1}>
            <SizableText size="$headingSm" flex={1} color="$text">
              {intl.formatMessage({ id: titleId })}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({ id: descriptionId })}
            </SizableText>
          </Stack>
        </XStack>
      ))}
    </Stack>
  );
};

const UnsafeAlert = () => {
  const intl = useIntl();
  const { copyText } = useClipboard();
  const onConfirm = useCallback(() => {
    Dialog.show({
      title: intl.formatMessage({ id: ETranslations.global_reset }),
      icon: 'ShieldKeyholeOutline',
      description: intl.formatMessage({
        id: ETranslations.address_book_confirm_message,
      }),
      // tone: 'destructive',
      showConfirmButton: true,
      showCancelButton: true,
      onConfirm: async (inst) => {
        const text =
          await backgroundApiProxy.serviceAddressBook.stringifyUnSafeItems();
        await backgroundApiProxy.serviceAddressBook.resetItems();
        copyText(
          text,
          ETranslations.address_book_add_address_toast_reset_success,
        );
        await inst.close();
      },
      onConfirmText: intl.formatMessage({
        id: ETranslations.address_book_button_reset,
      }),
      confirmButtonProps: {
        variant: 'destructive',
      },
      onCancelText: intl.formatMessage({
        id: ETranslations.address_book_button_copy,
      }),
      cancelButtonProps: {
        icon: 'Copy2Outline',
      },
      onCancel: async (close) => {
        const text =
          await backgroundApiProxy.serviceAddressBook.stringifyUnSafeItems();
        copyText(text);
      },
    });
  }, [copyText, intl]);
  return (
    <Stack gap="$5">
      <Alert
        type="critical"
        title={intl.formatMessage({
          id: ETranslations.address_book_data_anomaly,
        })}
        fullBleed
        icon="ErrorOutline"
        description={intl.formatMessage({
          id: ETranslations.address_book_data_anomaly_content,
        })}
      />
      <ContentQuestionList />
      <Page.Footer
        onConfirmText={intl.formatMessage({
          id: ETranslations.address_book_button_reset,
        })}
        onConfirm={onConfirm}
        onCancel={async (close) => {
          const text =
            await backgroundApiProxy.serviceAddressBook.stringifyUnSafeItems();
          copyText(text);
        }}
        onCancelText={intl.formatMessage({
          id: ETranslations.address_book_button_copy,
        })}
      />
    </Stack>
  );
};

const ErrOccurred = () => {
  const intl = useIntl();
  return (
    <Empty
      icon="ErrorOutline"
      title={intl.formatMessage({ id: ETranslations.global_an_error_occurred })}
      description={intl.formatMessage({
        id: ETranslations.global_an_error_occurred,
      })}
    />
  );
};

type IContentContainerProps = {
  loading?: boolean;
  error?: boolean;
  unsafe?: boolean;
  onRefresh?: () => void;
};

export const ContentContainer = ({
  children,
  loading,
  error,
  unsafe,
}: PropsWithChildren<IContentContainerProps>) => {
  if (loading) {
    return <ContentSpinner />;
  }
  if (error) {
    return <ErrOccurred />;
  }
  if (unsafe) {
    return <UnsafeAlert />;
  }
  return <>{children}</>;
};
