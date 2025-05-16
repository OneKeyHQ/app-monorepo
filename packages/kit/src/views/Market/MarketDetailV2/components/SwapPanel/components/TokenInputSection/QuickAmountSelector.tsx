import { Button, XStack } from '@onekeyhq/components';

export interface IQuickAmountSelectorProps {
  onSelect: (value: string) => void;
  tradeType: 'buy' | 'sell';
}

export function QuickAmountSelector({
  onSelect,
  tradeType,
}: IQuickAmountSelectorProps) {
  if (tradeType === 'buy') {
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

  // Sell type
  return (
    <XStack gap="$2.5" background="$bgStrong">
      <Button flex={1} size="medium" onPress={() => onSelect('0.25')}>
        25%
      </Button>
      <Button flex={1} size="medium" onPress={() => onSelect('0.5')}>
        50%
      </Button>
      <Button flex={1} size="medium" onPress={() => onSelect('0.75')}>
        75%
      </Button>
      <Button flex={1} size="medium" onPress={() => onSelect('1')}>
        100%
      </Button>
    </XStack>
  );
}
