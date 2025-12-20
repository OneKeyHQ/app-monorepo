import type {
  SizableTextProps,
  YStackProps,
} from '@onekeyhq/components/src/shared/tamagui';

import { Button, Icon, SizableText, YStack } from '../../primitives';

import type { IButtonProps, IIconProps, IKeyOfIcons } from '../../primitives';

interface IEmptyProps extends YStackProps {
  icon?: IKeyOfIcons;
  iconProps?: IIconProps;
  title?: React.ReactNode;
  titleProps?: SizableTextProps;
  description?: React.ReactNode;
  descriptionProps?: SizableTextProps;
  buttonProps?: IButtonProps;
  button?: React.ReactNode;
}

export function EmptyButton(props: IButtonProps) {
  return <Button variant="primary" size="medium" mt="$6" {...props} />;
}
export function Empty(props: IEmptyProps) {
  const {
    icon,
    iconProps,
    title,
    titleProps,
    description,
    descriptionProps,
    buttonProps,
    button,
    ...rest
  } = props;
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
          {typeof title === 'string' ? (
            <SizableText
              size="$headingXl"
              textAlign="center"
              mb="$2"
              {...titleProps}
            >
              {title}
            </SizableText>
          ) : (
            title
          )}
          {typeof description === 'string' ? (
            <SizableText
              size="$bodyLg"
              textAlign="center"
              color="$textSubdued"
              {...descriptionProps}
            >
              {description}
            </SizableText>
          ) : (
            description
          )}
        </YStack>
      ) : null}
      {buttonProps ? <EmptyButton {...buttonProps} /> : null}
      {button || null}
    </YStack>
  );
}
Empty.Button = EmptyButton;
