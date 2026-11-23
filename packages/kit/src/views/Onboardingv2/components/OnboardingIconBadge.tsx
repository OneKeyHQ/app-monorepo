import {
  type IKeyOfIcons,
  Icon,
} from '@onekeyhq/components/src/primitives/Icon';
import {
  type IYStackProps,
  YStack,
} from '@onekeyhq/components/src/primitives/Stack';

export interface IOnboardingIconBadgeProps extends Omit<
  IYStackProps,
  'children'
> {
  icon: IKeyOfIcons;
  iconColor?: React.ComponentProps<typeof Icon>['color'];
}

export function OnboardingIconBadge({
  icon,
  iconColor = '$bgApp',
  ...rest
}: IOnboardingIconBadgeProps) {
  return (
    <YStack
      bg="$brand10"
      p="$2"
      borderRadius="$full"
      alignSelf="flex-start"
      mb="$8"
      {...rest}
    >
      <Icon name={icon} color={iconColor} />
    </YStack>
  );
}
