import { Button, Heading, XStack } from '@onekeyhq/components';

export function DappSearchModalSectionHeader({
  title,
  onMorePress,
}: {
  title: string;
  onMorePress: () => void;
}) {
  return (
    <XStack px="$5" pb="$2" alignItems="center" justifyContent="space-between">
      <Heading size="$headingMd">{title}</Heading>
      <Button variant="tertiary" size="medium" onPress={onMorePress}>
        See All
      </Button>
    </XStack>
  );
}
