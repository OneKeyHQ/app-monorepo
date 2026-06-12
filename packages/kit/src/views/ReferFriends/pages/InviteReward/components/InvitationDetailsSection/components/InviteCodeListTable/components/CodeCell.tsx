import { useCallback, useMemo } from 'react';

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
import { ReferFriendsTestIDs } from '@onekeyhq/kit/src/views/ReferFriends/testIDs';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  INVITE_CODE_COLUMN_CODE_CHAR_WIDTH,
  INVITE_CODE_COLUMN_NOTE_WIDTH,
} from '../const';

import { EditCodeDialogContent } from './EditCodeDialogContent';
import { MarqueeText } from './MarqueeText';

interface ICodeCellProps {
  code: string;
  displayCode?: string;
  codeViewportWidth: number;
  note: string;
  isPrimary: boolean;
  isCustomCode: boolean;
  onUpdated?: (shouldRefreshSummary?: boolean) => Promise<void> | void;
}

export function CodeCell({
  code,
  displayCode,
  codeViewportWidth,
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

  const codeText = displayCode ?? code;
  const needsMarquee =
    codeText.length * INVITE_CODE_COLUMN_CODE_CHAR_WIDTH > codeViewportWidth;

  const codeElement = useMemo(() => {
    if (needsMarquee) {
      return (
        <MarqueeText
          containerWidth={codeViewportWidth}
          textProps={{ size: '$bodyMdMedium', color: '$text' }}
        >
          {codeText}
        </MarqueeText>
      );
    }
    return (
      <SizableText size="$bodyMdMedium" color="$text" numberOfLines={1}>
        {codeText}
      </SizableText>
    );
  }, [needsMarquee, codeText, codeViewportWidth]);

  return (
    <YStack gap="$1">
      <XStack gap="$2" ai="center">
        {codeElement}
        <IconButton
          testID={ReferFriendsTestIDs.codeCellCopyBtn}
          variant="tertiary"
          size="small"
          icon="Copy3Outline"
          onPress={handleCopy}
        />
        <IconButton
          testID={ReferFriendsTestIDs.codeCellEditBtn}
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
