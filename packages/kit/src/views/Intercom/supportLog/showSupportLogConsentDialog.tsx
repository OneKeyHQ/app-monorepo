import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  SizableText,
  XStack,
  YStack,
  useDialogInstance,
} from '@onekeyhq/components';
import { showDiagnosticLogsContentsDialog } from '@onekeyhq/kit/src/views/Setting/pages/Tab/exportLogs/showDiagnosticLogsContentsDialog';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

// `error` and `generic` open a new conversation; `conversation` adds logs to
// the open one.
export type ISupportLogConsentVariant = 'error' | 'generic' | 'conversation';
export type ISupportLogConsentChoice = 'upload' | 'skip';

const TITLE_IDS: Record<ISupportLogConsentVariant, ETranslations> = {
  error: ETranslations.support_log_consent_error__title,
  generic: ETranslations.support_log_consent__title,
  conversation: ETranslations.support_log_consent_send__title,
};

function SupportLogConsentContent({
  variant,
  onChoose,
}: {
  variant: ISupportLogConsentVariant;
  onChoose: (choice: ISupportLogConsentChoice) => void;
}) {
  const intl = useIntl();
  const dialog = useDialogInstance();
  const choose = (choice: ISupportLogConsentChoice) => {
    onChoose(choice);
    void dialog.close();
  };
  return (
    <YStack gap="$5">
      <YStack gap="$2">
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({ id: ETranslations.support_log_consent__desc })}
        </SizableText>
        <SizableText size="$bodyLg" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.support_log_consent_privacy__desc,
          })}
        </SizableText>
        <XStack gap="$1" flexWrap="wrap" pt="$1">
          <SizableText size="$bodyMd" color="$textSubdued">
            {`${intl.formatMessage({
              id: ETranslations.support_log_consent_once__desc,
            })} ·`}
          </SizableText>
          <SizableText
            size="$bodyMd"
            textDecorationLine="underline"
            cursor="pointer"
            onPress={() => {
              showDiagnosticLogsContentsDialog({ intl });
            }}
          >
            {intl.formatMessage({
              id: ETranslations.settings_diagnostic_logs_contents__title,
            })}
          </SizableText>
        </XStack>
      </YStack>
      {variant === 'conversation' ? (
        <XStack gap="$2.5">
          <Button
            flex={1}
            size="large"
            testID="support-log-consent-cancel"
            onPress={() => {
              void dialog.close();
            }}
          >
            {intl.formatMessage({ id: ETranslations.global_cancel })}
          </Button>
          <Button
            flex={1}
            size="large"
            variant="primary"
            testID="support-log-consent-upload"
            onPress={() => choose('upload')}
          >
            {intl.formatMessage({ id: ETranslations.global_upload })}
          </Button>
        </XStack>
      ) : (
        // Both choices continue to the conversation, so each label says so.
        <YStack gap="$2.5">
          <Button
            size="large"
            variant="primary"
            testID="support-log-consent-upload"
            onPress={() => choose('upload')}
          >
            {intl.formatMessage({
              id: ETranslations.support_log_upload_and_contact__action,
            })}
          </Button>
          <Button
            size="large"
            testID="support-log-consent-skip"
            onPress={() => choose('skip')}
          >
            {intl.formatMessage({
              id: ETranslations.support_contact_without_logs__action,
            })}
          </Button>
        </YStack>
      )}
    </YStack>
  );
}

// Resolves after the dialog has closed: the choice, or undefined when the
// user dismissed it (which abandons the request).
export function showSupportLogConsentDialog({
  variant,
  intl,
}: {
  variant: ISupportLogConsentVariant;
  intl: IntlShape;
}): Promise<ISupportLogConsentChoice | undefined> {
  return new Promise((resolve) => {
    let choice: ISupportLogConsentChoice | undefined;
    Dialog.show({
      icon: 'UploadOutline',
      title: intl.formatMessage({ id: TITLE_IDS[variant] }),
      showFooter: false,
      renderContent: (
        <SupportLogConsentContent
          variant={variant}
          onChoose={(value) => {
            choice = value;
          }}
        />
      ),
      onClose: () => resolve(choice),
    });
  });
}
