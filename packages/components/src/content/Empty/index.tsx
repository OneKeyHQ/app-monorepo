import { Button, Icon, Text, YStack } from '../../primitives';

import type { IButtonProps, IIconProps, IKeyOfIcons } from '../../primitives';
import type { YStackProps } from 'tamagui';

interface IEmptyProps extends YStackProps {
  icon?: IKeyOfIcons;
  iconProps?: IIconProps;
  title?: string;
  description?: string;
  buttonProps?: IButtonProps;
}

export function Empty(props: IEmptyProps) {
  const { icon, iconProps, title, description, buttonProps, ...rest } = props;

  return (
    <YStack p="$5" alignItems="center" justifyContent="center" {...rest}>
      {icon && (
        <Icon
          name={icon}
          size="$16"
          color="$iconSubdued"
          mb="$6"
          {...iconProps}
        />
      )}
      {(title || description) && (
        <YStack alignItems="center" maxWidth="$64">
          {title && (
            <Text variant="$headingXl" textAlign="center" mb="$2">
              {title}
            </Text>
          )}
          {description && (
            <Text variant="$bodyLg" textAlign="center" color="$textSubdued">
              {description}
            </Text>
          )}
        </YStack>
      )}
      {buttonProps && (
        <Button variant="primary" size="medium" mt="$6" {...buttonProps} />
      )}
    </YStack>
  );
}
