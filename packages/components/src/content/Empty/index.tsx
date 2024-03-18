import { Button, Icon, SizableText, YStack } from '../../primitives';

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
      {icon ? (
        <Icon
          name={icon}
          size="$16"
          color="$iconSubdued"
          mb="$6"
          {...iconProps}
        />
      ) : null}
      {title || description ? (
        <YStack alignItems="center" maxWidth="$64">
          {title ? (
            <SizableText size="$headingXl" textAlign="center" mb="$2">
              {title}
            </SizableText>
          ) : null}
          {description ? (
            <SizableText size="$bodyLg" textAlign="center" color="$textSubdued">
              {description}
            </SizableText>
          ) : null}
        </YStack>
      ) : null}
      {buttonProps ? (
        <Button variant="primary" size="medium" mt="$6" {...buttonProps} />
      ) : null}
    </YStack>
  );
}
