import { Button } from '../Button';
import { Icon } from '../Icon';
import { YStack } from '../Stack';
import { Text } from '../Text';

import type { ButtonProps } from '../Button';
import type { ICON_NAMES } from '../Icon';
import type { YStackProps } from 'tamagui';

interface EmptyProps extends YStackProps {
  icon?: ICON_NAMES;
  title?: string;
  description?: string;
  buttonProps?: ButtonProps;
}

export function Empty(props: EmptyProps) {
  const { icon, title, description, buttonProps, ...rest } = props;

  return (
    <YStack p="$5" alignItems="center" justifyContent="center" {...rest}>
      {icon && <Icon name={icon} size="$16" color="$iconSubdued" mb="$6" />}
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
