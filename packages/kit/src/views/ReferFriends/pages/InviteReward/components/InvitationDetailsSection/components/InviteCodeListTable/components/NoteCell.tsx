import { Button, Icon, SizableText, XStack } from '@onekeyhq/components';

// Note cell with add note button
export function NoteCell({ note }: { note: string }) {
  if (note) {
    return (
      <XStack gap="$2" ai="center">
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
      onPress={() => {
        // TODO: Implement add note functionality
      }}
    >
      Add note
    </Button>
  );
}
