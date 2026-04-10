import { useCallback, useContext, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Input,
  SizableText,
  Stack,
  Toast,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { DialogContext } from '@onekeyhq/components/src/composite/Dialog/context';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IEditInviteCodeParams } from '@onekeyhq/shared/src/referralCode/type';

interface IEditCodeDialogContentProps {
  code: string;
  note: string;
  isPrimary: boolean;
  isCustomCode: boolean;
  onUpdated?: (shouldRefreshSummary?: boolean) => Promise<void> | void;
}

const CODE_REGEX = /^[a-zA-Z0-9]*$/;
const CODE_MIN_LENGTH = 3;
const CODE_MAX_LENGTH = 15;
const NOTE_MAX_LENGTH = 100;

export function EditCodeDialogContent({
  code,
  note,
  isPrimary,
  isCustomCode,
  onUpdated,
}: IEditCodeDialogContentProps) {
  const intl = useIntl();
  const { dialogInstance } = useContext(DialogContext) ?? {};

  const initialNote = note || '';

  const [codeValue, setCodeValue] = useState(code);
  const [noteValue, setNoteValue] = useState(initialNote);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeError, setCodeError] = useState('');

  const validateCode = useCallback(
    (value: string): string => {
      if (!value) {
        return intl.formatMessage({
          id: ETranslations.referral_referral_code_too_short,
        });
      }
      if (!CODE_REGEX.test(value)) {
        return intl.formatMessage({
          id: ETranslations.referral_invalid_characters,
        });
      }
      if (value.length < CODE_MIN_LENGTH) {
        return intl.formatMessage({
          id: ETranslations.referral_referral_code_too_short,
        });
      }
      if (value.length > CODE_MAX_LENGTH) {
        return intl.formatMessage({
          id: ETranslations.referral_referral_code_too_long,
        });
      }
      return '';
    },
    [intl],
  );

  const handleCodeChange = useCallback(
    (text: string) => {
      setCodeValue(text);
      if (codeError) {
        setCodeError(validateCode(text));
      }
    },
    [codeError, validateCode],
  );

  const codeChanged = !isCustomCode && codeValue !== code;
  const noteChanged = noteValue !== initialNote;
  const hasChanges = codeChanged || noteChanged;

  const handleSave = useCallback(async () => {
    if (isSubmitting || !hasChanges) return;

    if (codeChanged) {
      const error = validateCode(codeValue);
      if (error) {
        setCodeError(error);
        return;
      }
    }

    try {
      setIsSubmitting(true);
      const params: IEditInviteCodeParams = {
        originalCode: code,
      };
      if (codeChanged) {
        params.code = codeValue;
      }
      if (noteChanged) {
        params.note = noteValue;
      }
      await backgroundApiProxy.serviceReferralCode.editInviteCode(params);
      Toast.success({
        title: intl.formatMessage({
          id: ETranslations.referral_edit_success,
        }),
      });
      void dialogInstance?.close();
    } catch (_error) {
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.referral_edit_failure,
        }),
      });
      return;
    } finally {
      setIsSubmitting(false);
    }

    try {
      await onUpdated?.(isPrimary && codeChanged);
    } catch {
      // silently ignore refetch failures — edit already succeeded
    }
  }, [
    isSubmitting,
    hasChanges,
    codeChanged,
    noteChanged,
    codeValue,
    code,
    isPrimary,
    noteValue,
    validateCode,
    intl,
    onUpdated,
    dialogInstance,
  ]);

  const handleCancel = useCallback(() => {
    void dialogInstance?.close();
  }, [dialogInstance]);

  return (
    <Stack gap="$5" py="$2">
      <YStack gap="$1.5">
        <SizableText size="$bodyMdMedium" color="$text">
          {intl.formatMessage({
            id: ETranslations.referral_customize_referral_code_label,
          })}
        </SizableText>
        <Input
          placeholder={intl.formatMessage({
            id: ETranslations.referral_referral_code_placeholder,
          })}
          value={codeValue}
          onChangeText={handleCodeChange}
          disabled={isCustomCode}
          maxLength={CODE_MAX_LENGTH}
          error={Boolean(codeError)}
          autoFocus={!isCustomCode}
        />
        {codeError ? (
          <SizableText size="$bodyMd" color="$textCritical">
            {codeError}
          </SizableText>
        ) : (
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.referral_edit_once_note,
            })}
          </SizableText>
        )}
      </YStack>

      <YStack gap="$1.5">
        <SizableText size="$bodyMdMedium" color="$text">
          {intl.formatMessage({
            id: ETranslations.referral_code_list_note,
          })}
        </SizableText>
        <Input
          placeholder={intl.formatMessage({
            id: ETranslations.referral_code_created_placeholder,
          })}
          value={noteValue}
          onChangeText={setNoteValue}
          maxLength={NOTE_MAX_LENGTH}
          autoFocus={isCustomCode}
        />
      </YStack>

      <XStack gap="$2.5">
        <Button
          flex={1}
          size="medium"
          onPress={handleCancel}
          disabled={isSubmitting}
        >
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
        <Button
          flex={1}
          size="medium"
          variant="primary"
          onPress={handleSave}
          disabled={isSubmitting || !hasChanges}
          loading={isSubmitting}
        >
          {intl.formatMessage({ id: ETranslations.global_confirm })}
        </Button>
      </XStack>
    </Stack>
  );
}
