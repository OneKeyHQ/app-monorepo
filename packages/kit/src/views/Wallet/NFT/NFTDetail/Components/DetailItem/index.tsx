import type { ICON_NAMES } from '@onekeyhq/components';
import { HStack, Icon, Pressable, Typography } from '@onekeyhq/components';

type Props = {
  title: string;
  value: string | number;
  icon?: ICON_NAMES;
  onPress?: () => void;
};

export function DetailItem({ title, value, onPress, icon }: Props) {
  return (
    <HStack space="12px">
      <Typography.Body2Strong color="text-subdued" flex={1}>
        {title}
      </Typography.Body2Strong>
      <Pressable flexDirection="row" onPress={onPress}>
        <Typography.Body2Strong mr="8px" isTruncated maxW="160px">
          {value}
        </Typography.Body2Strong>
        {icon ? <Icon name={icon} size={20} /> : null}
      </Pressable>
    </HStack>
  );
}
