import type {
  ComponentProps,
  ComponentType,
  PropsWithChildren,
  ReactElement,
  ReactNode,
} from 'react';
import { isValidElement, useCallback, useState } from 'react';

import { Pressable } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import {
  Divider,
  Icon,
  IconButton,
  Image,
  MatchSizeableText,
  SizableText,
  Spinner,
  Stack,
  Unspaced,
  withStaticProperties,
} from '@onekeyhq/components';
import type { IIconButtonProps } from '@onekeyhq/components/src/actions';
import type {
  IIconProps,
  IImageFallbackProps,
  IImageLoadingProps,
  IImageProps,
  ISizableTextProps,
  IStackProps,
} from '@onekeyhq/components/src/primitives';
import type {
  IDBAccount,
  IDBIndexedAccount,
} from '@onekeyhq/kit-bg/src/dbs/local/types';
import type { IFuseResultMatch } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { listItemPressStyle } from '@onekeyhq/shared/src/style';

import { useStatefulAction } from '../../hooks/useStatefulAction';
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
    <Image
      src={src}
      size="$4"
      borderRadius="$full"
      fallback={<Image.Fallback {...fallbackProps} />}
      {...(rest as any)}
    />
  </Stack>
);

/* Avatar */
export type IListItemAvatarProps = PropsWithChildren<
  {
    circular?: boolean;
    account?: IDBIndexedAccount | IDBAccount;
    avatar?: ReactElement;
    loading?: ReactElement;
    loadingProps?: IImageLoadingProps;
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
      {cornerIconProps ? (
        <ListItemAvatarCornerIcon {...cornerIconProps} />
      ) : null}
      {cornerImageProps ? (
        <ListItemAvatarCornerImage {...cornerImageProps} />
      ) : null}
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
  primaryMatch?: IFuseResultMatch;
  secondaryMatch?: IFuseResultMatch;
}

const ListItemText = (props: IListItemTextProps) => {
  const {
    primary,
    secondary,
    align = 'left',
    primaryTextProps,
    secondaryTextProps,
    primaryMatch,
    secondaryMatch,
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

  const renderPrimary = useCallback(() => {
    if (isValidElement(primary)) {
      return primary;
    }
    if (primaryMatch) {
      return (
        <MatchSizeableText
          textAlign={align}
          size="$bodyLgMedium"
          match={primaryMatch}
          {...primaryTextProps}
        >
          {primary as string}
        </MatchSizeableText>
      );
    }
    return (
      <SizableText textAlign={align} size="$bodyLgMedium" {...primaryTextProps}>
        {primary}
      </SizableText>
    );
  }, [align, primary, primaryMatch, primaryTextProps]);

  const renderSecondary = useCallback(() => {
    if (isValidElement(secondary)) {
      return secondary;
    }
    if (secondaryMatch) {
      return (
        <MatchSizeableText
          size="$bodyMd"
          color="$textSubdued"
          textAlign={align}
          match={secondaryMatch}
          {...secondaryTextProps}
        >
          {secondary as string}
        </MatchSizeableText>
      );
    }
    return (
      <SizableText
        size="$bodyMd"
        color="$textSubdued"
        textAlign={align}
        {...secondaryTextProps}
      >
        {secondary}
      </SizableText>
    );
  }, [align, secondary, secondaryMatch, secondaryTextProps]);

  return (
    <Stack {...rest} justifyContent={getJustifyContent()}>
      <>
        {primary ? renderPrimary() : null}
        {secondary ? renderSecondary() : null}
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
  <Stack key="checkMarkIndicator" {...props}>
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
export type IListItemProps = PropsWithChildren<
  {
    title?: string;
    titleMatch?: IFuseResultMatch;
    titleProps?: IListItemTextProps['primaryTextProps'];
    subtitle?: string | ReactNode;
    subTitleMatch?: IFuseResultMatch;
    subtitleProps?: IListItemTextProps['secondaryTextProps'];
    avatarProps?: IListItemAvatarProps;
    renderAvatar?: ComponentType | ReactNode;
    renderIcon?: ComponentType | ReactNode;
    renderItemText?:
      | ComponentType<IListItemTextProps>
      | ReactNode
      | ((props: IListItemTextProps) => ReactNode);
    icon?: IIconProps['name'];
    iconProps?: Exclude<ComponentProps<typeof Icon>, 'name'>;
    drillIn?: boolean;
    isLoading?: boolean;
    checkMark?: boolean;
    onPress?: () => void | Promise<void>;
    childrenBefore?: ComponentType | ReactNode;
    disabled?: boolean;
    testID?: string;
    /** Style for the native Pressable wrapper. Only effective on native platforms. */
    nativePressableStyle?: StyleProp<ViewStyle>;
  } & IStackProps
>;

const renderWithFallback = (
  Component: ComponentType,
  props?: any,
  render?: ComponentType | ReactNode,
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

const ListItemComponent = Stack.styleable<IListItemProps, any, any>(
  (props: IListItemProps, ref: any) => {
    const {
      avatarProps,
      icon,
      title,
      titleProps,
      subtitle,
      subtitleProps,
      drillIn,
      isLoading,
      iconProps,
      checkMark,
      onPress,
      childrenBefore,
      children,
      renderAvatar,
      renderIcon,
      renderItemText,
      titleMatch,
      subTitleMatch,
      nativePressableStyle,
      ...rest
    } = props;

    const handleItemPress = useCallback(async () => {
      if (props.disabled) return;
      await onPress?.();
    }, [onPress, props.disabled]);

    const hasPressHandler = !!onPress && !props.disabled;

    // On native, use Pressable to wrap the item for better scroll-vs-tap
    // disambiguation. Pressable cooperates with ScrollView's gesture system,
    // automatically cancelling the press when a scroll gesture takes over.
    // This prevents accidental onPress triggers while scrolling in nested
    // PagerView + ScrollView layouts.
    const useNativePressable = platformEnv.isNative && hasPressHandler;
    const useWebPress = !platformEnv.isNative && hasPressHandler;

    // Track native press state for visual feedback. Pressable's onPressIn/
    // onPressOut drive this state, which applies bg='$bgActive' on the Stack.
    // This replaces Tamagui's pressStyle which requires onPress on the Stack
    // (but we removed Stack's onPress so Pressable handles scroll cancellation).
    const [nativePressed, setNativePressed] = useState(false);
    const handlePressIn = useCallback(() => setNativePressed(true), []);
    const handlePressOut = useCallback(() => setNativePressed(false), []);

    // On native with Pressable wrapper, strip pressStyle/hoverStyle from rest
    // to prevent the inner Stack from claiming the touch responder. Without this,
    // Tamagui attaches onStartShouldSetResponder to the inner Stack (because
    // pressStyle triggers attachPress), which steals the responder from the
    // outer Pressable and prevents onPress from firing.
    let contentRest: typeof rest = rest;
    let nativePressStyle: IStackProps['pressStyle'];
    if (useNativePressable) {
      const { pressStyle, hoverStyle, ...filtered } = rest;
      contentRest = filtered;
      nativePressStyle = pressStyle;
    }

    const content = (
      <Stack
        ref={ref}
        flexDirection="row"
        alignItems="center"
        minHeight="$11"
        gap="$3"
        py="$2"
        px="$3"
        mx="$2"
        borderRadius="$3"
        borderCurve="continuous"
        onPress={useWebPress ? handleItemPress : undefined}
        {...(props.disabled && {
          opacity: 0.5,
        })}
        {...(useWebPress ? listItemPressStyle : undefined)}
        {...contentRest}
        {...(nativePressed
          ? (nativePressStyle ?? { bg: '$bgActive' })
          : undefined)}
      >
        {childrenBefore}
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
            primaryMatch: titleMatch,
            primaryTextProps: {
              ...(props.onPress && { userSelect: 'none' }),
              ...titleProps,
              testID: `select-item-${rest.testID || ''}`,
            },
            secondary: subtitle,
            secondaryMatch: subTitleMatch,
            secondaryTextProps: {
              ...(props.onPress && { userSelect: 'none' }),
              ...subtitleProps,
              testID: `select-item-subtitle-${rest.testID || ''}`,
            },
          },
          renderItemText,
        )}
        {children}
        {drillIn && !isLoading ? <ListItemDrillIn /> : null}
        {isLoading ? <Spinner /> : null}
        <Unspaced>
          {checkMark ? <ListItemCheckMark key="checkmark" /> : null}
        </Unspaced>
      </Stack>
    );

    if (useNativePressable) {
      // unstable_pressDelay delays onPressIn so the bg highlight doesn't
      // briefly flash when the user starts a scroll gesture on a list item.
      return (
        <Pressable
          onPress={handleItemPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          unstable_pressDelay={50}
          style={nativePressableStyle ?? { flex: 1 }}
        >
          {content}
        </Pressable>
      );
    }

    return content;
  },
);

type IStatefulItemProps<T> = Omit<
  ComponentProps<typeof ListItem>,
  'children' | 'onPress'
> & {
  value: T;
  onAction: (value: T) => Promise<void>;
  children: (props: {
    value: T;
    loading: boolean;
    disabled: boolean;
    onChange: (value: T, e?: any) => void;
  }) => ReactNode;
  disableRowPress?: boolean;
};

function StatefulListItem<T>({
  value,
  onAction,
  children,
  disableRowPress,
  ...props
}: IStatefulItemProps<T>) {
  const {
    value: innerValue,
    loading: isLoading,
    disabled,
    onChange,
    onToggle,
    withClickLock,
  } = useStatefulAction<T>({
    value,
    onAction,
  });

  const handleControlChange = useCallback(
    (newValue: T, e?: { stopPropagation?: () => void }) => {
      // prevent the row press
      e?.stopPropagation?.();
      // clickLock + rollback is handled in the hook
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return withClickLock(() => onChange(newValue))();
    },
    [withClickLock, onChange],
  );

  const handleRowPress = useCallback(() => {
    if (typeof innerValue === 'boolean') {
      withClickLock(() => onToggle())();
    }
    // do nothing for non-boolean row press, let the children handle it
  }, [innerValue, onToggle, withClickLock]);

  return (
    <ListItemComponent
      {...props}
      onPress={disableRowPress ? undefined : handleRowPress}
    >
      {children({
        value: innerValue,
        loading: isLoading,
        disabled: disabled || !!props.disabled,
        onChange: handleControlChange,
      })}
    </ListItemComponent>
  );
}

export const ListItem = withStaticProperties(
  ListItemComponent as ComponentType<IListItemProps>,
  {
    Text: ListItemText,
    Avatar: withStaticProperties(ListItemAvatar, {
      CornerIcon: ListItemAvatarCornerIcon,
      CornerImage: ListItemAvatarCornerImage,
    }),
    IconButton: ListItemIconButton,
    CheckMark: ListItemCheckMark,
    Separator: ListItemSeparator,
    DrillIn: ListItemDrillIn,
    StatefulItem: StatefulListItem,
  },
);
