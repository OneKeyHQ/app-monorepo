import { isValidElement } from 'react';

import { Avatar } from '../Avatar';
import { type IIconProps, Icon } from '../Icon';
import { IconButton } from '../IconButton';
import { Stack } from '../Stack';
import { Text } from '../Text';

import type { IIconButtonProps } from '../IconButton';
import type {
  AvatarFallbackProps,
  AvatarImageProps,
  AvatarProps,
  GetProps,
  StackProps,
} from 'tamagui';

type IListItemAvatarCornerIconProps = IIconProps;

/* Avatar Corner Icon */
const ListItemAvatarCornerIcon = (props: IListItemAvatarCornerIconProps) => {
  const { name, ...rest } = props;

  return (
    <Stack
      position="absolute"
      right="$-1"
      bottom="$-1"
      bg="$bgApp"
      p="$px"
      borderRadius="$full"
      zIndex="$1"
    >
      <Icon size="$4.5" name={name} {...rest} />
    </Stack>
  );
};

type IListItemAvatarCornerImageProps = Omit<
  IListItemAvatarProps,
  'children' | 'cornerIconProps'
>;

const ListItemAvatarCornerImage = ({
  src,
  fallbackProps,
  ...rest
}: IListItemAvatarCornerImageProps) => (
  <Stack
    position="absolute"
    right="$-1"
    bottom="$-1"
    bg="$bgApp"
    p="$0.5"
    borderRadius="$full"
    zIndex="$1"
  >
    <Avatar size="$4" circular {...rest}>
      <Avatar.Image src={src} />
      <Avatar.Fallback {...fallbackProps} />
    </Avatar>
  </Stack>
);

/* Avatar */
type IListItemAvatarProps = {
  src: AvatarImageProps['src'];
  fallbackProps?: AvatarFallbackProps;
  cornerIconProps?: IListItemAvatarCornerIconProps;
  cornerImageProps?: IListItemAvatarCornerImageProps;
  children?: React.ReactNode;
} & AvatarProps;

const ListItemAvatar = (props: IListItemAvatarProps) => {
  const {
    src,
    fallbackProps,
    children,
    circular,
    cornerIconProps,
    cornerImageProps,
    ...rest
  } = props;

  return (
    <Stack>
      <Avatar
        size="$10"
        {...(circular ? { circular: true } : { borderRadius: '$2' })}
        {...rest}
      >
        <Avatar.Image src={src} />
        <Avatar.Fallback {...fallbackProps} />
      </Avatar>
      {cornerIconProps && <ListItemAvatarCornerIcon {...cornerIconProps} />}
      {cornerImageProps && <ListItemAvatarCornerImage {...cornerImageProps} />}
      {children}
    </Stack>
  );
};

/* Text */
interface IListItemTextProps extends StackProps {
  primary?: string | React.ReactNode;
  secondary?: string | React.ReactNode;
  align?: 'left' | 'center' | 'right';
  primaryTextProps?: GetProps<typeof Text>;
  secondaryTextProps?: GetProps<typeof Text>;
}

const ListItemText = (props: IListItemTextProps) => {
  const {
    primary,
    secondary,
    align = 'left',
    primaryTextProps,
    secondaryTextProps,
    ...rest
  } = props;

  const getJustifyContent = () => {
    if (align === 'left') {
      return 'flex-start';
    }
    if (align === 'center') {
      return 'center';
    }
    return 'flex-end';
  };

  return (
    <Stack {...rest} justifyContent={getJustifyContent()}>
      {primary &&
        (isValidElement(primary) ? (
          primary
        ) : (
          <Text
            textAlign={align}
            variant="$bodyLgMedium"
            userSelect="none"
            {...primaryTextProps}
          >
            {primary}
          </Text>
        ))}
      {secondary &&
        (isValidElement(secondary) ? (
          secondary
        ) : (
          <Text
            variant="$bodyMd"
            tone="subdued"
            textAlign={align}
            userSelect="none"
            {...secondaryTextProps}
          >
            {secondary}
          </Text>
        ))}
    </Stack>
  );
};

/* IconButton */
const ListItemIconButton = (props: IIconButtonProps) => (
  <IconButton variant="tertiary" size="medium" {...props} />
);

/* ListItem */
interface IListItemProps extends StackProps {
  title?: string;
  titleProps?: IListItemTextProps['primaryTextProps'];
  subtitle?: string;
  subtitleProps?: IListItemTextProps['secondaryTextProps'];
  avatarProps?: IListItemAvatarProps;
  icon?: IIconProps['name'];
  drillIn?: boolean;
  checkMark?: boolean;
}

function ListItem(props: IListItemProps) {
  const {
    avatarProps,
    icon,
    title,
    titleProps,
    subtitle,
    subtitleProps,
    drillIn,
    checkMark,
    onPress,
    children,
    ...rest
  } = props;

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      minHeight="$11"
      space="$3"
      p="$2"
      mx="$3"
      borderRadius="$3"
      onPress={onPress}
      {...(onPress && {
        hoverStyle: { bg: '$bgHover' },
        pressStyle: { bg: '$bgActive' },
        focusable: true,
        focusStyle: {
          outlineWidth: 2,
          outlineStyle: 'solid',
          outlineColor: '$focusRing',
        },
      })}
      {...rest}
    >
      {avatarProps && (
        <ListItemAvatar
          {...(!avatarProps.circular && { borderRadius: '$2' })}
          {...avatarProps}
        />
      )}
      {icon && <Icon name={icon} color="$iconSubdued" />}
      {(title || subtitle) && (
        <ListItemText
          flex={1}
          primary={title}
          primaryTextProps={titleProps}
          secondary={subtitle}
          secondaryTextProps={subtitleProps}
        />
      )}
      {children}
      {drillIn && (
        <Icon name="ChevronRightSmallOutline" color="$iconSubdued" mx="$-1.5" />
      )}
      {checkMark && <Icon name="CheckRadioSolid" color="$iconActive" />}
    </Stack>
  );
}

ListItem.Text = ListItemText;
ListItem.Avatar = {
  Component: ListItemAvatar,
  CornerIcon: ListItemAvatarCornerIcon,
  CornerImage: ListItemAvatarCornerImage,
};
ListItem.IconButton = ListItemIconButton;

export { ListItem };
