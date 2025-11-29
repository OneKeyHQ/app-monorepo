import { useCallback } from 'react';

import { Input, SizableText, YStack } from '@onekeyhq/components';
import { useSwapProTokenValueAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';

const SwapProValueInput = () => {
  const [swapProToTokenValue, setSwapProToTokenValue] =
    useSwapProTokenValueAtom();

  const handleTokenValueChange = useCallback(
    (text: string) => {
      setSwapProToTokenValue(text);
    },
    [setSwapProToTokenValue],
  );
  return (
    <YStack
      borderRadius="$2"
      bg="$bgStrong"
      p="$2"
      alignItems="center"
      gap="$1"
    >
      <SizableText size="$bodySm" color="$textDisabled">
        total value
      </SizableText>
      <Input
        value={swapProToTokenValue}
        onChangeText={handleTokenValueChange}
        readonly
        placeholder="Value"
        textAlign="center"
        keyboardType="decimal-pad"
        size="medium"
        containerProps={{
          flex: 1,
        }}
      />
    </YStack>
  );
};

export default SwapProValueInput;
