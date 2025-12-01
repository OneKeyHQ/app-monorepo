import { Checkbox, SizableText, XStack } from '@onekeyhq/components';
import { useSwapProEnableCurrentSymbolAtom } from '@onekeyhq/kit/src/states/jotai/contexts/swap';

const SwapProCurrentSymbolEnable = () => {
  const [swapProEnableCurrentSymbol, setSwapProEnableCurrentSymbol] =
    useSwapProEnableCurrentSymbolAtom();
  return (
    <XStack gap="$2" alignItems="center" mt="$2">
      <Checkbox
        value={swapProEnableCurrentSymbol}
        onChange={(value) => {
          setSwapProEnableCurrentSymbol(!!value);
        }}
      />
      <SizableText>Current symbol</SizableText>
    </XStack>
  );
};
export default SwapProCurrentSymbolEnable;
