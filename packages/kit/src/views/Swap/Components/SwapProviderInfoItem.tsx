import { Icon, Image, Skeleton, Text, XStack } from '@onekeyhq/components';

interface ISwapProviderInfoItemProps {
  providerName: string;
  providerIcon: string;
  showLock?: boolean;
  showBest?: boolean;
  onPress?: () => void;
  isLoading?: boolean;
}
const SwapProviderInfoItem = ({
  showBest,
  providerIcon,
  providerName,
  showLock,
  onPress,
  isLoading,
}: ISwapProviderInfoItemProps) =>
  isLoading ? (
    <Skeleton w="$20" />
  ) : (
    <XStack justifyContent="space-between">
      <Text>Provider</Text>
      <XStack space="$2">
        {showBest && <Text>Best</Text>}
        <Image source={{ uri: providerIcon }} w="$5" h="$5" />
        <Text>{providerName}</Text>
        {showLock && <Icon name="LockOutline" />}
        {onPress && <Icon name="ChevronRightSmallOutline" />}
      </XStack>
    </XStack>
  );
export default SwapProviderInfoItem;
