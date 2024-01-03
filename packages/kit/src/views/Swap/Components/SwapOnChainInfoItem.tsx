import { IconButton, Text, XStack } from '@onekeyhq/components';

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
  <XStack justifyContent="space-between">
    <Text>{title}</Text>
    <XStack>
      <Text>{value}</Text>
      <IconButton icon="Copy1Outline" onPress={onCopy} />
    </XStack>
  </XStack>
);

export default SwapOnChainInfoItem;
