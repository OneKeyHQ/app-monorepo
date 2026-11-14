import { useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import {
  Button,
  Image,
  Input,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IIntercomPart } from '@onekeyhq/shared/src/modules3rdParty/intercom/messengerTypes';
import dateUtils from '@onekeyhq/shared/src/utils/dateUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';

import { SupportAvatar } from './SupportAvatar';

export function MessagePart({
  part,
  onQuickReply,
  onFormSubmit,
  disabled,
  firstInGroup = true,
  lastInGroup = true,
}: {
  part: IIntercomPart;
  onQuickReply?: (partId: string, replyId: string, text: string) => void;
  // True requires a successful conversation read started after the form write.
  onFormSubmit?: (
    partId: string,
    identifier: string,
    value: string,
  ) => Promise<boolean>;
  disabled?: boolean;
  firstInGroup?: boolean;
  lastInGroup?: boolean;
}) {
  const intl = useIntl();
  return (
    <XStack
      alignSelf={part.isAdmin ? 'flex-start' : 'flex-end'}
      maxWidth={part.isAdmin ? '96%' : '85%'}
      alignItems="flex-end"
      gap="$2"
      mb={lastInGroup ? '$4' : '$1'}
      testID={`support-message-${part.id}`}
    >
      {part.isAdmin ? (
        <YStack
          width={28}
          mb={lastInGroup ? '$6' : 0}
          opacity={lastInGroup ? 1 : 0}
        >
          <SupportAvatar avatar={part.avatar} size={28} />
        </YStack>
      ) : null}
      <YStack flexShrink={1} minWidth={0} gap="$1.5">
        <YStack
          borderRadius={20}
          borderTopLeftRadius={part.isAdmin && !firstInGroup ? 4 : 20}
          borderTopRightRadius={!part.isAdmin && !firstInGroup ? 4 : 20}
          borderBottomLeftRadius={part.isAdmin && !lastInGroup ? 4 : 20}
          borderBottomRightRadius={!part.isAdmin && !lastInGroup ? 4 : 20}
          bg={part.isAdmin ? '$bgApp' : '$bgInverse'}
          borderWidth={part.isAdmin ? 1 : 0}
          borderColor="$borderSubdued"
          px="$4"
          py="$3"
          gap="$2"
        >
          {part.blocks.map((block, index) => (
            <YStack key={`${part.id}-${index}`} gap="$2">
              {block.text ? (
                <SizableText
                  selectable
                  size={block.type === 'heading' ? '$headingMd' : '$bodyLg'}
                  color={part.isAdmin ? '$text' : '$textInverse'}
                >
                  {block.text}
                </SizableText>
              ) : null}
              {block.type === 'image' && block.url ? (
                <Image
                  source={{ uri: block.url }}
                  cachePolicy="none"
                  width={220}
                  maxWidth="100%"
                  height={Math.min(
                    280,
                    220 * ((block.height || 1) / (block.width || 1)),
                  )}
                  resizeMode="contain"
                />
              ) : null}
              {block.items?.map((item, itemIndex) => (
                <SizableText
                  key={`${itemIndex}-${item}`}
                  size="$bodyLg"
                  color={part.isAdmin ? '$text' : '$textInverse'}
                >{`${block.type === 'orderedList' ? `${itemIndex + 1}.` : '•'} ${item}`}</SizableText>
              ))}
              {block.url && block.type !== 'image' ? (
                <Button
                  testID={`support-link-${part.id}-${index}`}
                  variant="tertiary"
                  onPress={() => openUrlExternal(block.url || '')}
                >
                  {block.title ||
                    intl.formatMessage({ id: ETranslations.global_view })}
                </Button>
              ) : null}
              {block.attachments?.map((attachment) => (
                <Button
                  key={attachment.url}
                  testID={`support-attachment-${part.id}`}
                  icon="AttachmentOutline"
                  variant="tertiary"
                  onPress={() => openUrlExternal(attachment.url)}
                >
                  {attachment.name ||
                    intl.formatMessage({ id: ETranslations.global_view })}
                </Button>
              ))}
              {block.links?.map((link) => (
                <Button
                  key={link.url}
                  testID={`support-inline-link-${part.id}`}
                  variant="tertiary"
                  onPress={() => openUrlExternal(link.url)}
                >
                  {link.text ||
                    intl.formatMessage({ id: ETranslations.global_view })}
                </Button>
              ))}
            </YStack>
          ))}
          {part.form?.fields.map((field) => (
            <SupportFormField
              key={field.identifier}
              field={field}
              disabled={disabled}
              submit={async (value) => {
                return (
                  (await onFormSubmit?.(part.id, field.identifier, value)) ??
                  false
                );
              }}
            />
          ))}
          {part.hasUnsupportedContent && !part.form ? (
            <SizableText size="$bodySm" color="$textSubdued">
              {intl.formatMessage({ id: ETranslations.global_not_available })}
            </SizableText>
          ) : null}
        </YStack>
        {lastInGroup && part.createdAt ? (
          <SizableText
            size="$bodySm"
            color="$textSubdued"
            px="$1"
            textAlign={part.isAdmin ? 'left' : 'right'}
          >
            {part.isAdmin && part.author ? `${part.author} · ` : ''}
            {dateUtils.formatTime(new Date(part.createdAt * 1000), {
              hideSeconds: true,
            })}
          </SizableText>
        ) : null}
        {onQuickReply && part.replies.length ? (
          <XStack gap="$2" flexWrap="wrap">
            {part.replies.map((reply) => (
              <Button
                key={reply.id}
                testID={`support-quick-reply-${reply.id}`}
                disabled={disabled}
                borderRadius={18}
                variant="secondary"
                onPress={() => onQuickReply(part.id, reply.id, reply.text)}
              >
                {reply.text}
              </Button>
            ))}
          </XStack>
        ) : null}
      </YStack>
    </XStack>
  );
}

function SupportFormField({
  field,
  disabled,
  submit,
}: {
  field: NonNullable<IIntercomPart['form']>['fields'][number];
  disabled?: boolean;
  submit: (value: string) => Promise<boolean>;
}) {
  const intl = useIntl();
  const latestField = useRef(field);
  latestField.current = field;
  const [draft, setDraft] = useState<{
    value: string;
    awaitingSnapshot?: typeof field;
  }>();
  // Failed reads retain the field object; a new object is a server snapshot.
  const value =
    draft && (!draft.awaitingSnapshot || draft.awaitingSnapshot === field)
      ? draft.value
      : field.value;
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <YStack gap="$2">
      <SizableText size="$bodyMd">{field.label}</SizableText>
      <Input
        testID={`support-form-${field.identifier}`}
        value={value}
        onChangeText={(text) =>
          setDraft(text === field.value ? undefined : { value: text })
        }
        editable={!disabled && !field.disabled && !pending}
        keyboardType={field.type === 'email' ? 'email-address' : 'default'}
      />
      <Button
        testID={`support-form-submit-${field.identifier}`}
        loading={pending}
        disabled={disabled || field.disabled || !value.trim()}
        onPress={async () => {
          if (pending) return;
          setPending(true);
          setFailed(false);
          try {
            const refreshed = await submit(value);
            const snapshot = latestField.current;
            setDraft((current) => {
              if (current?.value !== value) return current;
              return refreshed
                ? undefined
                : { value, awaitingSnapshot: snapshot };
            });
          } catch {
            setFailed(true);
          } finally {
            setPending(false);
          }
        }}
      >
        {intl.formatMessage({
          id: failed
            ? ETranslations.global_retry
            : ETranslations.global_confirm,
        })}
      </Button>
    </YStack>
  );
}
