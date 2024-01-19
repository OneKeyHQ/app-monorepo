import {
  Icon,
  Image,
  SizableText,
  Skeleton,
  XStack,
} from '@onekeyhq/components';

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
    <XStack justifyContent="space-between" onPress={onPress}>
      <SizableText>Provider</SizableText>
      <XStack space="$2">
        {showBest && <SizableText>Best</SizableText>}
        <Image source={{ uri: providerIcon }} w="$5" h="$5" />
        <SizableText>{providerName}</SizableText>
        {showLock && <Icon name="LockOutline" />}
        {onPress && <Icon name="ChevronRightSmallOutline" />}
      </XStack>
    </XStack>
  );
export default SwapProviderInfoItem;
