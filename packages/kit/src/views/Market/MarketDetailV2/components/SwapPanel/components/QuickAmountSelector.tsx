import { Button, XStack } from '@onekeyhq/components';

export function QuickAmountSelector({
  onSelect,
}: {
  onSelect: (value: string) => void;
}) {
  return (
    <XStack space="$2.5">
      <Button flex={1} size="medium" onPress={() => onSelect('0.1')}>
        0.1
      </Button>
      <Button flex={1} size="medium" onPress={() => onSelect('0.5')}>
        0.5
      </Button>
      <Button flex={1} size="medium" onPress={() => onSelect('1')}>
        1
      </Button>
      <Button flex={1} size="medium" onPress={() => onSelect('10')}>
        10
      </Button>
    </XStack>
  );
}
