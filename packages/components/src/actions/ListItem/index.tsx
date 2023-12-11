import { type ComponentProps, isValidElement } from 'react';

import {
  AnimatePresence,
  type AvatarFallbackProps,
  type AvatarImageProps,
  type AvatarProps,
  type GetProps,
  type StackProps,
  // eslint-disable-next-line spellcheck/spell-checker
  Unspaced,
} from 'tamagui';

import { Avatar, Divider } from '../../content';
import { Icon, Image, Stack, Text } from '../../primitives';
import { IconButton } from '../IconButton';

import type { IIconButtonProps } from '..';
import type { IIconProps, IImageProps } from '../../primitives';

interface IListItemAvatarCornerIconProps extends IIconProps {
  containerProps?: StackProps;
}

/* Avatar Corner Icon */
const ListItemAvatarCornerIcon = (props: IListItemAvatarCornerIconProps) => {
  const { name, containerProps, ...rest } = props;

  return (
    <Stack
      position="absolute"
      right="$-1"
      bottom="$-1"
      bg="$bgApp"
      p="$px"
      borderRadius="$full"
      zIndex="$1"
      {...containerProps}
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
  /** A string representing the remote URL of the image. */
  src?: AvatarImageProps['src'];
  /** A local file resource, such as `require('./test.jpg')` */
  source?: IImageProps['source'];
  fallbackProps?: AvatarFallbackProps;
  cornerIconProps?: IListItemAvatarCornerIconProps;
  cornerImageProps?: IListItemAvatarCornerImageProps;
  children?: React.ReactNode;
} & AvatarProps;

const ListItemAvatar = (props: IListItemAvatarProps) => {
  const {
    src,
    source,
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
        style={{
          borderCurve: 'continuous',
        }}
        {...(circular ? { circular: true } : { borderRadius: '$2' })}
        {...rest}
      >
        {source ? (
          <Image flex={1} width="100%" source={source} resizeMode="center" />
        ) : (
          <>
            <Avatar.Image src={src} />
            <Avatar.Fallback {...fallbackProps} />
          </>
        )}
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
          <Text textAlign={align} variant="$bodyLgMedium" {...primaryTextProps}>
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

// CheckMark
const ListItemCheckMark = (props: StackProps) => (
  <Stack
    key="checkMarkIndicator"
    animation="quick"
    enterStyle={{
      opacity: 0,
      scale: 0,
    }}
    exitStyle={{
      opacity: 0,
      scale: 0,
    }}
    {...props}
  >
    <Icon name="CheckRadioSolid" color="$iconActive" />
  </Stack>
);

// Separator
const ListItemSeparator = () => <Divider mx="$5" />;

/* ListItem */
export interface IListItemProps extends StackProps {
  title?: string;
  titleProps?: IListItemTextProps['primaryTextProps'];
  subtitle?: string;
  subtitleProps?: IListItemTextProps['secondaryTextProps'];
  avatarProps?: IListItemAvatarProps;
  icon?: IIconProps['name'];
  iconProps?: Exclude<ComponentProps<typeof Icon>, 'name'>;
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
    iconProps,
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
          outlineOffset: -2,
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
      {icon && <Icon name={icon} color="$iconSubdued" {...iconProps} />}
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
      <Unspaced>
        <AnimatePresence>{checkMark && <ListItemCheckMark />}</AnimatePresence>
      </Unspaced>
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
ListItem.CheckMark = ListItemCheckMark;
ListItem.Separator = ListItemSeparator;

export { ListItem };
