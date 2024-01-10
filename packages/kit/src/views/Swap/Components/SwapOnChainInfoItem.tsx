import { IconButton, SizableText, XStack } from '@onekeyhq/components';

interface ISwapOnChainInfoItemProps {
  title: string;
  value: string;
  onCopy: () => void;
}
const SwapOnChainInfoItem = ({
  title,
  value,
  onCopy,
}: ISwapOnChainInfoItemProps) => (
  <XStack flex={1} space="$4" justifyContent="space-between">
    <SizableText>{title}</SizableText>
    <XStack flex={1} justifyContent="flex-end">
      <SizableText textAlign="right" w="90%" wordWrap="break-word">
        {value}
      </SizableText>
      <IconButton
        h="$6"
        w="$6"
        size="small"
        icon="Copy2Outline"
        onPress={onCopy}
      />
    </XStack>
  </XStack>
);

export default SwapOnChainInfoItem;
