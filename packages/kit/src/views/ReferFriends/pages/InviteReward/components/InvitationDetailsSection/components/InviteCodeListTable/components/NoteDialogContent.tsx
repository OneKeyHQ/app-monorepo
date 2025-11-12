import { useCallback, useContext, useState } from 'react';

import { useIntl } from 'react-intl';

import { Button, Input, Stack, XStack } from '@onekeyhq/components';
import { DialogContext } from '@onekeyhq/components/src/composite/Dialog/context';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ETranslations } from '@onekeyhq/shared/src/locale';

interface INoteDialogContentProps {
  code: string;
  initialNote: string;
  onNoteUpdated?: () => void;
}

export function NoteDialogContent({
  code,
  initialNote,
  onNoteUpdated,
}: INoteDialogContentProps) {
  const intl = useIntl();
  const [noteValue, setNoteValue] = useState(initialNote || '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { dialogInstance } = useContext(DialogContext) ?? {};

  const handleSave = useCallback(async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);
      await backgroundApiProxy.serviceReferralCode.updateInviteCodeNote({
        code,
        note: noteValue,
      });
      onNoteUpdated?.();
      void dialogInstance?.close();
    } catch (error) {
      console.error('Failed to update note:', error);
    } finally {
      setIsSubmitting(false);
    }
  }, [code, noteValue, isSubmitting, onNoteUpdated, dialogInstance]);

  const handleCancel = useCallback(() => {
    void dialogInstance?.close();
  }, [dialogInstance]);

  return (
    <Stack gap="$5" py="$2">
      <Input
        placeholder={intl.formatMessage({
          id: ETranslations.referral_code_created_placeholder,
        })}
        value={noteValue}
        onChangeText={setNoteValue}
        maxLength={100}
        autoFocus
      />
      <XStack gap="$3" justifyContent="flex-end">
        <Button size="medium" onPress={handleCancel} disabled={isSubmitting}>
          {intl.formatMessage({ id: ETranslations.global_cancel })}
        </Button>
        <Button
          size="medium"
          variant="primary"
          onPress={handleSave}
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          {intl.formatMessage({ id: ETranslations.global_confirm })}
        </Button>
      </XStack>
    </Stack>
  );
}
