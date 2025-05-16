import { Button, XStack } from '@onekeyhq/components';

export interface IQuickAmountSelectorProps {
  onSelect: (value: string) => void;
}

export function QuickAmountSelector({ onSelect }: IQuickAmountSelectorProps) {
  return (
    <XStack gap="$2.5" background="$bgStrong">
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
