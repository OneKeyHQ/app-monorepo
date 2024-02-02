import { SizableText, TextArea, YStack } from '@onekeyhq/components';

function DAppSignMessageContent({ content }: { content: string }) {
  return (
    <YStack justifyContent="center">
      <SizableText color="$text" size="$headingMd" mb="$2">
        Message
      </SizableText>
      <TextArea value={content} editable={false} numberOfLines={14} />
    </YStack>
  );
}

export { DAppSignMessageContent };
