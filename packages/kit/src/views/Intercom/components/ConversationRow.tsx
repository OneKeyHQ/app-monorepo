import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IIntercomConversation } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import { formatRelativeTimeAbbr } from '@onekeyhq/shared/src/utils/dateUtils';

import { SupportAvatar } from './SupportAvatar';

export function ConversationRow({
  conversation,
  divider,
  onPress,
}: {
  conversation: IIntercomConversation;
  divider: boolean;
  onPress: () => void;
}) {
  const intl = useIntl();
  const last = conversation.parts.at(-1);
  const admin = conversation.parts.findLast((part) => part.isAdmin);
  const summary = last?.blocks
    .map((block) => block.text || block.title)
    .filter(Boolean)
    .join(' ');
  return (
    <XStack
      testID={`support-conversation-${conversation.id}`}
      role="button"
      onPress={onPress}
      px="$4"
      py="$4"
      gap="$3"
      alignItems="center"
      borderBottomWidth={divider ? 1 : 0}
      borderBottomColor="$borderSubdued"
      hoverStyle={{ bg: '$bgHover' }}
      pressStyle={{ bg: '$bgActive' }}
    >
      <SupportAvatar avatar={conversation.header.avatars[0] ?? admin?.avatar} />
      <YStack flex={1} minWidth={0} gap="$1">
        <XStack gap="$2" alignItems="center">
          <SizableText
            flex={1}
            size={conversation.read ? '$bodyMd' : '$bodyMdMedium'}
            numberOfLines={1}
          >
            {conversation.title ||
              intl.formatMessage({ id: ETranslations.global_support })}
          </SizableText>
          {conversation.updatedAt ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {formatRelativeTimeAbbr(conversation.updatedAt)}
            </SizableText>
          ) : null}
        </XStack>
        {admin?.author && admin.author !== conversation.title ? (
          <SizableText size="$bodySm" color="$textSubdued" numberOfLines={1}>
            {admin.author}
          </SizableText>
        ) : null}
        <XStack alignItems="center" gap="$2">
          <SizableText
            flex={1}
            size="$bodyMd"
            color="$textSubdued"
            numberOfLines={1}
          >
            {summary ||
              intl.formatMessage({ id: ETranslations.global_support })}
          </SizableText>
          {!conversation.read ? (
            <YStack
              testID={`support-unread-${conversation.id}`}
              width={8}
              height={8}
              borderRadius={4}
              bg="$bgInverse"
            />
          ) : null}
        </XStack>
      </YStack>
    </XStack>
  );
}
