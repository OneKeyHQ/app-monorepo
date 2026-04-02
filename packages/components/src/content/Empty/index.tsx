import type {
  SizableTextProps,
  YStackProps,
} from '@onekeyhq/components/src/shared/tamagui';

import { Button } from '../../primitives/Button';
import { Icon } from '../../primitives/Icon';
import { Illustration } from '../../primitives/Illustration';
import { SizableText } from '../../primitives/SizeableText';
import { YStack } from '../../primitives/Stack';

import type { IButtonProps, IIconProps, IKeyOfIcons } from '../../primitives';
import type { IIllustrationName } from '../../primitives/Illustration';

interface IEmptyProps extends YStackProps {
  icon?: IKeyOfIcons;
  iconProps?: IIconProps;
  illustration?: IIllustrationName;
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
    illustration,
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
      {illustration ? <Illustration name={illustration} mb="$2" /> : null}
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
