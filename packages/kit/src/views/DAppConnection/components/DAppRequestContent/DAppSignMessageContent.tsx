import { TextArea, YStack } from '@onekeyhq/components';

function DAppSignMessageContent({ content }: { content: string }) {
  return (
    <YStack justifyContent="center" alignItems="center" flex={1}>
      <TextArea
        flex={1}
        w="100%"
        h="100%"
        value={content}
        disabled
        minHeight="$60"
      />
    </YStack>
  );
}

export { DAppSignMessageContent };
