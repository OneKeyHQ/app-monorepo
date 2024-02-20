import type { IIconProps, IKeyOfIcons } from '@onekeyhq/components';
import {
  Button,
  Icon,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';

export type IEmptyBaseProps = {
  icon?: IKeyOfIcons;
  iconProps?: IIconProps;
  title: string;
  description?: string;
  actions?: { text: string; OnPress: () => void }[];
};

function EmptyBase(props: IEmptyBaseProps) {
  const { icon, iconProps, title, description, actions } = props;
  return (
    <YStack space="$6" justifyContent="center" alignItems="center">
      {icon && (
        <Icon color="$iconSubdued" name={icon} size="$16" {...iconProps} />
      )}
      <YStack space="$2" alignItems="center">
        {title && <SizableText size="$headingXl">{title}</SizableText>}
        {description && (
          <SizableText size="$bodyLg" color="$textSubdued" textAlign="center">
            {description}
          </SizableText>
        )}
      </YStack>

      <XStack>
        {actions &&
          actions.map((action, index) => (
            <Button
              key={index}
              onPress={action.OnPress}
              size="medium"
              variant="primary"
            >
              {action.text}
            </Button>
          ))}
      </XStack>
    </YStack>
  );
}

export { EmptyBase };
