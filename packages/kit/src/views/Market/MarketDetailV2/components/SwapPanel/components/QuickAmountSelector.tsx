import { Button, XStack } from '@onekeyhq/components';

export function QuickAmountSelector() {
  return (
    <XStack space="$2.5">
      <Button flex={1} size="medium">
        0.1
      </Button>
      <Button flex={1} size="medium">
        0.5
      </Button>
      <Button flex={1} size="medium">
        1
      </Button>
      <Button flex={1} size="medium">
        10
      </Button>
    </XStack>
  );
}
