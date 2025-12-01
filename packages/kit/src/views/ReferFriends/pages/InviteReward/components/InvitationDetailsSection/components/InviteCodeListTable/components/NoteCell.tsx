import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Button, Dialog, SizableText, useMedia } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { NoteDialogContent } from './NoteDialogContent';

interface INoteCellProps {
  code: string;
  note: string;
  onNoteUpdated?: () => void;
}

// Note cell with add/edit note functionality
export function NoteCell({ code, note, onNoteUpdated }: INoteCellProps) {
  const intl = useIntl();
  const { md } = useMedia();

  const handleOpenDialog = useCallback(() => {
    const dialogTitle = intl.formatMessage({
      id: note
        ? ETranslations.referral_code_list_edit_note
        : ETranslations.referral_code_list_add_note,
    });

    Dialog.show({
      title: dialogTitle,
      renderContent: (
        <NoteDialogContent
          code={code}
          initialNote={note}
          onNoteUpdated={onNoteUpdated}
        />
      ),
      showFooter: false,
    });
  }, [code, note, onNoteUpdated, intl]);

  if (note) {
    return (
      <Button
        childrenAsText={false}
        variant="tertiary"
        size="small"
        icon="PencilOutline"
        onPress={handleOpenDialog}
      >
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          numberOfLines={1}
          maxWidth={md ? 90 : 120}
          ellipsizeMode="tail"
          display="block"
          overflow="hidden"
        >
          {note}
        </SizableText>
      </Button>
    );
  }

  return (
    <Button
      variant="tertiary"
      size="small"
      icon="PlusSmallOutline"
      onPress={handleOpenDialog}
    >
      {intl.formatMessage({ id: ETranslations.referral_code_list_add_note })}
    </Button>
  );
}
