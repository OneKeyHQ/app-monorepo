import { Icon, Skeleton, Text, XStack } from '@onekeyhq/components';

interface ISwapCommonInfoItemProps {
  title: string;
  value: string;
  onPress?: () => void;
  isLoading?: boolean;
}

const SwapCommonInfoItem = ({
  title,
  value,
  onPress,
  isLoading,
}: ISwapCommonInfoItemProps) =>
  isLoading ? (
    <Skeleton w="$20" />
  ) : (
    <XStack onPress={onPress} justifyContent="space-between" h="$20">
      <Text>{title}</Text>
      <XStack space="$2">
        <Text>{value}</Text>
        {onPress && <Icon size="$3" name="ChevronRightSmallOutline" />}
      </XStack>
    </XStack>
  );

export default SwapCommonInfoItem;
