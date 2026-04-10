import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import {
  Dialog,
  IconButton,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { INVITE_CODE_COLUMN_NOTE_WIDTH } from '../const';

import { EditCodeDialogContent } from './EditCodeDialogContent';

interface ICodeCellProps {
  code: string;
  displayCode?: string;
  note: string;
  isPrimary: boolean;
  isCustomCode: boolean;
  onUpdated?: (shouldRefreshSummary?: boolean) => Promise<void> | void;
}

export function CodeCell({
  code,
  displayCode,
  note,
  isPrimary,
  isCustomCode,
  onUpdated,
}: ICodeCellProps) {
  const intl = useIntl();
  const { copyText } = useClipboard();

  const handleCopy = useCallback(() => {
    void copyText(code);
  }, [code, copyText]);

  const handleOpenEditDialog = useCallback(() => {
    Dialog.show({
      icon: 'GiftOutline',
      title: intl.formatMessage({
        id: ETranslations.referral_edit_referral_code_title,
      }),
      renderContent: (
        <EditCodeDialogContent
          code={code}
          note={note}
          isPrimary={isPrimary}
          isCustomCode={isCustomCode}
          onUpdated={onUpdated}
        />
      ),
      showFooter: false,
    });
  }, [code, note, isPrimary, isCustomCode, onUpdated, intl]);

  return (
    <YStack gap="$1">
      <XStack gap="$2" ai="center">
        <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
          {displayCode ?? code}
        </SizableText>
        <IconButton
          variant="tertiary"
          size="small"
          icon="Copy3Outline"
          onPress={handleCopy}
        />
        <IconButton
          variant="tertiary"
          size="small"
          icon="PencilOutline"
          onPress={handleOpenEditDialog}
        />
      </XStack>
      <Stack
        maxWidth="100%"
        alignSelf="flex-start"
        onPress={handleOpenEditDialog}
        cursor="pointer"
        hoverStyle={{ opacity: 0.6 }}
        pressStyle={{ opacity: 0.5 }}
      >
        <SizableText
          width={INVITE_CODE_COLUMN_NOTE_WIDTH}
          size="$bodyMdMedium"
          color={note ? '$textSubdued' : '$textPlaceholder'}
          numberOfLines={1}
        >
          {note ||
            intl.formatMessage({
              id: ETranslations.referral_code_list_add_note,
            })}
        </SizableText>
      </Stack>
    </YStack>
  );
}
