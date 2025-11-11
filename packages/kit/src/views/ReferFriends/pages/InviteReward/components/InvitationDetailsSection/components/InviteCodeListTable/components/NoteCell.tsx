import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Icon,
  SizableText,
  XStack,
} from '@onekeyhq/components';
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

  const handleOpenDialog = useCallback(() => {
    const dialogTitle = note
      ? `${intl.formatMessage({
          id: ETranslations.global_edit,
        })} ${intl.formatMessage({ id: ETranslations.global_Note })}`
      : `${intl.formatMessage({
          id: ETranslations.global_add,
        })} ${intl.formatMessage({ id: ETranslations.global_Note })}`;

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
      <XStack
        gap="$2"
        ai="center"
        cursor="pointer"
        onPress={handleOpenDialog}
        p="$1"
        borderRadius="$2"
        hoverStyle={{
          backgroundColor: '$bgHover',
        }}
      >
        <Icon name="PencilOutline" size="$3.5" color="$iconSubdued" />
        <SizableText
          size="$bodyMdMedium"
          color="$text"
          numberOfLines={1}
          maxWidth={160}
        >
          {note}
        </SizableText>
      </XStack>
    );
  }

  return (
    <Button
      variant="tertiary"
      size="small"
      icon="PlusSmallOutline"
      onPress={handleOpenDialog}
    >
      {`${intl.formatMessage({ id: ETranslations.global_add })} ${intl
        .formatMessage({ id: ETranslations.global_Note })
        .toLowerCase()}`}
    </Button>
  );
}
