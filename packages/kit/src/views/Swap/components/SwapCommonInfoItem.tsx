import { Icon, SizableText, Skeleton, XStack } from '@onekeyhq/components';

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
      <SizableText>{title}</SizableText>
      <XStack space="$2">
        <SizableText>{value}</SizableText>
        {onPress && <Icon size="$3" name="ChevronRightSmallOutline" />}
      </XStack>
    </XStack>
  );

export default SwapCommonInfoItem;
