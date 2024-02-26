import type {
  ComponentProps,
  ComponentType,
  PropsWithChildren,
  ReactElement,
} from 'react';
import { isValidElement } from 'react';

import { AnimatePresence, Unspaced, withStaticProperties } from 'tamagui';

import {
  Divider,
  Icon,
  IconButton,
  Image,
  SizableText,
  Stack,
} from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components/src/actions';
import type {
  IIconProps,
  IImageFallbackProps,
  IImageProps,
  ISizableTextProps,
  IStackProps,
} from '@onekeyhq/components/src/primitives';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';

import { AccountAvatar } from '../AccountAvatar';

import type { IAccountAvatarProps } from '../AccountAvatar';

interface IListItemAvatarCornerIconProps extends IIconProps {
  containerProps?: IStackProps;
}

/* Image Corner Icon */
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

type IListItemAvatarCornerImageProps = IImageProps & {
  fallbackProps?: IImageFallbackProps;
  fallback?: ReactElement;
};

const ListItemAvatarCornerImage = ({
  src,
  fallback,
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
    <Image size="$4" circular {...(rest as any)}>
      <Image.Source src={src} />
      <Image.Fallback {...fallbackProps} />
    </Image>
  </Stack>
);

/* Avatar */
export type IListItemAvatarProps = PropsWithChildren<
  {
    account?: IDBIndexedAccount | IDBAccount;
    avatar?: ReactElement;
    fallback?: ReactElement;
    fallbackProps?: IImageFallbackProps;
    cornerIconProps?: IListItemAvatarCornerIconProps;
    cornerImageProps?: IListItemAvatarCornerImageProps;
  } & Omit<IAccountAvatarProps, 'children'>
>;

const ListItemAvatar = (props: IListItemAvatarProps) => {
  const { children, cornerIconProps, cornerImageProps, avatar, ...restProps } =
    props;

  return (
    <Stack>
      {avatar || <AccountAvatar {...restProps} />}
      {cornerIconProps && <ListItemAvatarCornerIcon {...cornerIconProps} />}
      {cornerImageProps && <ListItemAvatarCornerImage {...cornerImageProps} />}
      {children}
    </Stack>
  );
};

/* Text */
interface IListItemTextProps extends IStackProps {
  primary?: string | React.ReactNode;
  secondary?: string | React.ReactNode;
  align?: 'left' | 'center' | 'right';
  primaryTextProps?: ISizableTextProps;
  secondaryTextProps?: ISizableTextProps;
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
      <>
        {primary &&
          (isValidElement(primary) ? (
            primary
          ) : (
            <SizableText
              textAlign={align}
              size="$bodyLgMedium"
              {...primaryTextProps}
            >
              {primary}
            </SizableText>
          ))}
        {secondary &&
          (isValidElement(secondary) ? (
            secondary
          ) : (
            <SizableText
              size="$bodyMd"
              color="$textSubdued"
              textAlign={align}
              {...secondaryTextProps}
            >
              {secondary}
            </SizableText>
          ))}
      </>
    </Stack>
  );
};

/* IconButton */
const ListItemIconButton = (props: IIconButtonProps) => (
  <IconButton variant="tertiary" size="medium" {...props} />
);

// CheckMark
const ListItemCheckMark = (props: IStackProps) => (
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

// DrillIn
const ListItemDrillIn = (props: IIconProps) => (
  <Icon
    name="ChevronRightSmallOutline"
    color="$iconSubdued"
    mx="$-1.5"
    flexShrink={0}
    {...props}
  />
);

// Separator
const ListItemSeparator = () => <Divider mx="$5" />;

/* ListItem */
export type IListItemProps = PropsWithChildren<{
  title?: string;
  titleProps?: IListItemTextProps['primaryTextProps'];
  subtitle?: string;
  subtitleProps?: IListItemTextProps['secondaryTextProps'];
  avatarProps?: IListItemAvatarProps;
  renderAvatar?: ComponentType | ReactElement;
  renderIcon?: ComponentType | ReactElement;
  renderItemText?: ComponentType | ReactElement;
  icon?: IIconProps['name'];
  iconProps?: Exclude<ComponentProps<typeof Icon>, 'name'>;
  drillIn?: boolean;
  checkMark?: boolean;
  onPress?: () => void;
}>;

const renderWithFallback = (
  Component: ComponentType,
  props?: any,
  render?: ComponentType | ReactElement,
) => {
  if (render) {
    if (typeof render === 'function') {
      const Render = render;
      return <Render {...props} />;
    }
    return render;
  }

  if (!props) {
    return null;
  }
  return <Component {...props} />;
};

const ListItemComponent = Stack.styleable<IListItemProps>((props, ref) => {
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
    renderAvatar,
    renderIcon,
    renderItemText,
    ...rest
  } = props;

  return (
    <Stack
      ref={ref}
      flexDirection="row"
      alignItems="center"
      minHeight="$11"
      space="$3"
      py="$2"
      px="$3"
      mx="$2"
      borderRadius="$3"
      style={{
        borderCurve: 'continuous',
      }}
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
      {renderWithFallback(
        ListItemAvatar,
        avatarProps && {
          ...(!avatarProps.circular && { borderRadius: '$2' }),
          ...avatarProps,
        },
        renderAvatar,
      )}
      {renderWithFallback(
        Icon,
        icon && {
          name: icon,
          color: '$iconSubdued',
          flexShrink: 0,
          ...iconProps,
        },
        renderIcon,
      )}

      {renderWithFallback(
        ListItemText,
        (title || subtitle) && {
          flex: 1,
          primary: title,
          primaryTextProps: {
            ...(props.onPress && { userSelect: 'none' }),
            ...titleProps,
            testID: `list-item-title-${rest.testID || ''}`,
          },
          secondary: subtitle,
          secondaryTextProps: {
            ...(props.onPress && { userSelect: 'none' }),
            ...subtitleProps,
            testID: `list-item-subtitle-${rest.testID || ''}`,
          },
        },
        renderItemText,
      )}
      {children}
      {drillIn && <ListItemDrillIn />}
      <Unspaced>
        <AnimatePresence>
          {checkMark && <ListItemCheckMark key="checkmark" />}
        </AnimatePresence>
      </Unspaced>
    </Stack>
  );
});

export const ListItem = withStaticProperties(ListItemComponent, {
  Text: ListItemText,
  Avatar: withStaticProperties(ListItemAvatar, {
    CornerIcon: ListItemAvatarCornerIcon,
    CornerImage: ListItemAvatarCornerImage,
  }),
  IconButton: ListItemIconButton,
  CheckMark: ListItemCheckMark,
  Separator: ListItemSeparator,
  DrillIn: ListItemDrillIn,
});
