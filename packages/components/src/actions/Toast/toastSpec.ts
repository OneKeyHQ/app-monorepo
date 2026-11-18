import { getRgba } from '@tamagui/web';
import { PixelRatio } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import { buildTosImageResizeUrl } from '@onekeyhq/shared/src/utils/tosImageResizeUtils';

import { resolveIconName } from '../../primitives/Icon/Icons';

import { getToastIconHref } from './toastIconHref';
import { formatToastText } from './toastRichText';

import type {
  IToastColorKey,
  IToastFontKey,
  IToastStyleContext,
} from './toastStyleContext';
import type { IKeyOfIcons } from '../../primitives';
import type {
  IOverlayMessageToast,
  IOverlayNotificationToast,
  IOverlayToastAction,
  IOverlayToastIcon,
  IOverlayToastPosition,
  IOverlayToastText,
} from '@onekeyfe/react-native-native-overlay';

export type IToastActionVariant =
  | 'secondary'
  | 'tertiary'
  | 'primary'
  | 'destructive'
  | 'accent'
  | 'link';

/** One button of a toast's action row: a small `Button`, as data. */
export interface IToastAction {
  label: string;
  /** Defaults to `secondary`, as `Button` does. */
  variant?: IToastActionVariant;
  /** Drawn before the label. */
  icon?: IKeyOfIcons;
  /** Overrides the variant's label color. */
  color?: IToastColorKey;
  disabled?: boolean;
  testID?: string;
  onPress?: () => void | Promise<void>;
}

export type IToastHaptic =
  | 'success'
  | 'warning'
  | 'info'
  | 'error'
  | 'loading'
  | 'none';

export interface IToastMessageSpecInput {
  id: string;
  title: string;
  message?: string;
  icon?: IKeyOfIcons;
  haptic?: IToastHaptic;
  duration: number;
  position?: IOverlayToastPosition;
  actions: IToastAction[];
  actionsAlign: 'left' | 'right';
}

export interface IToastNotificationSpecInput {
  id: string;
  title: string;
  message?: string;
  icon?: IKeyOfIcons;
  iconImageUri?: string;
  imageUri?: string;
  duration: number;
  position?: IOverlayToastPosition;
  actions: IToastAction[];
  actionsAlign: 'left' | 'right';
  pressable: boolean;
}

// The small `Button`: its colors by variant and its frame metrics.
const ACTION_VARIANTS: Record<
  IToastActionVariant,
  {
    color: IToastColorKey;
    iconColor: IToastColorKey;
    bg: IToastColorKey;
    hoverBg: IToastColorKey;
    activeBg: IToastColorKey;
    focusRing: IToastColorKey;
  }
> = {
  primary: {
    color: 'textInverse',
    iconColor: 'iconInverse',
    bg: 'bgPrimary',
    hoverBg: 'bgPrimaryHover',
    activeBg: 'bgPrimaryActive',
    focusRing: 'focusRing',
  },
  tertiary: {
    color: 'textSubdued',
    iconColor: 'iconSubdued',
    bg: 'transparent',
    hoverBg: 'bgHover',
    activeBg: 'bgActive',
    focusRing: 'focusRing',
  },
  destructive: {
    color: 'textOnColor',
    iconColor: 'iconOnColor',
    bg: 'bgCriticalStrong',
    hoverBg: 'bgCriticalStrongHover',
    activeBg: 'bgCriticalStrongActive',
    focusRing: 'focusRingCritical',
  },
  secondary: {
    color: 'text',
    iconColor: 'icon',
    bg: 'bgStrong',
    hoverBg: 'bgStrongHover',
    activeBg: 'bgStrongActive',
    focusRing: 'focusRing',
  },
  accent: {
    color: 'textInverse',
    iconColor: 'iconInverse',
    bg: 'bgAccent',
    hoverBg: 'bgAccentHover',
    activeBg: 'bgAccentActive',
    focusRing: 'focusRing',
  },
  link: {
    color: 'textInfo',
    iconColor: 'iconInfo',
    bg: 'transparent',
    hoverBg: 'transparent',
    activeBg: 'transparent',
    focusRing: 'focusRing',
  },
};
const ACTION_PADDING_VERTICAL = 4;
const ACTION_PADDING_HORIZONTAL = 10;
const ACTION_TERTIARY_PADDING_HORIZONTAL = 8;
const ACTION_TERTIARY_MARGIN_VERTICAL = -5;
const ACTION_TERTIARY_MARGIN_HORIZONTAL = -9;
const ACTION_BORDER_WIDTH = 1;
const ACTION_RADIUS = 9999;
const ACTION_DISABLED_OPACITY = 0.4;
const ACTION_ICON_SIZE = 18;
const ACTION_ICON_GAP = 8;

const STATUS_ICON_SIZE = 20;
const STATUS_ICONS: Record<
  'success' | 'error' | 'info' | 'warning',
  { name: IKeyOfIcons; color: IToastColorKey }
> = {
  success: { name: 'CheckRadioSolid', color: 'iconSuccess' },
  error: { name: 'ErrorSolid', color: 'iconCritical' },
  info: { name: 'InfoCircleSolid', color: 'iconInfo' },
  warning: { name: 'ErrorSolid', color: 'iconCaution' },
};

const NOTIFICATION_BADGE_SIZE = 28;
const NOTIFICATION_ICON_IMAGE_SIZE = 18;
// The badge icon asked for 18pt with a number, which is not a size token, so
// it has always drawn at the icon's 24pt default on every platform.
const NOTIFICATION_ICON_SIZE = 24;
const NOTIFICATION_IMAGE_SIZE = 48;
const NOTIFICATION_IMAGE_RADIUS = 4;
const NOTIFICATION_DEFAULT_ICON: IKeyOfIcons = 'SpeakerPromoteOutline';

// The native icon registry takes the compact `rgba(r,g,b,a)` form the
// `Icon` primitive hands it.
function nativeIconColor(color: string): string {
  if (!platformEnv.isNative) {
    return color;
  }
  const rgba = getRgba(color);
  return rgba ? `rgba(${rgba.r},${rgba.g},${rgba.b},${rgba.a})` : color;
}

function namedIcon(
  context: IToastStyleContext,
  name: IKeyOfIcons,
  color: string,
  size: number,
): IOverlayToastIcon {
  const resolved = resolveIconName(name, context.isRTL);
  return {
    kind: 'icon',
    name: resolved,
    href: getToastIconHref(resolved),
    color: nativeIconColor(color),
    size,
  };
}

function textStyle(
  context: IToastStyleContext,
  font: IToastFontKey,
  color: string,
): Omit<IOverlayToastText, 'paragraphs'> {
  return {
    ...context.fonts[font],
    fontFamily: context.fontFamily,
    fontFaces: context.fontFaces,
    color,
    tabularNumbers: true,
  };
}

function richText(
  context: IToastStyleContext,
  value: string,
  font: IToastFontKey,
  color: string,
): IOverlayToastText {
  const { colors } = context;
  return {
    ...textStyle(context, font, color),
    paragraphs: formatToastText(value, {
      intl: context.intl,
      fontSize: context.fonts[font].fontSize,
      colors: {
        underline: colors.textSubdued,
        red: colors.textCritical,
        green: colors.textSuccess,
        yellow: colors.textCaution,
        blue: colors.textInfo,
        grey: colors.textSubdued,
      },
    }),
    linkHoverColor: colors.bgHover,
    linkPressedColor: colors.bgActive,
  };
}

function plainText(
  context: IToastStyleContext,
  value: string | undefined,
  font: IToastFontKey,
  color: string,
  numberOfLines: number,
): IOverlayToastText {
  return {
    ...textStyle(context, font, color),
    paragraphs: [value ? [{ text: value }] : []],
    numberOfLines,
    selectable: true,
  };
}

/** The id an action reports through `onAction`: its place in the row. */
export function toastActionId(index: number) {
  return String(index);
}

function buildActions(
  context: IToastStyleContext,
  actions: IToastAction[],
): IOverlayToastAction[] {
  const { colors, fonts } = context;
  return actions.map((action, index) => {
    const variant = action.variant ?? 'secondary';
    const tokens = ACTION_VARIANTS[variant];
    const isTertiary = variant === 'tertiary';
    return {
      id: toastActionId(index),
      label: action.label,
      disabled: action.disabled,
      testID: action.testID,
      icon: action.icon
        ? namedIcon(
            context,
            action.icon,
            colors[tokens.iconColor],
            ACTION_ICON_SIZE,
          )
        : undefined,
      iconGap: action.icon ? ACTION_ICON_GAP : undefined,
      color: colors[action.color ?? tokens.color],
      backgroundColor: colors[tokens.bg],
      // A disabled button keeps its resting surface.
      hoverBackgroundColor: action.disabled
        ? undefined
        : colors[tokens.hoverBg],
      pressedBackgroundColor: action.disabled
        ? undefined
        : colors[tokens.activeBg],
      focusRingColor: action.disabled ? undefined : colors[tokens.focusRing],
      ...fonts.bodyMdMedium,
      fontFamily: context.fontFamily,
      fontFaces: context.fontFaces,
      paddingVertical: ACTION_PADDING_VERTICAL,
      paddingHorizontal: isTertiary
        ? ACTION_TERTIARY_PADDING_HORIZONTAL
        : ACTION_PADDING_HORIZONTAL,
      marginVertical: isTertiary ? ACTION_TERTIARY_MARGIN_VERTICAL : undefined,
      marginHorizontal: isTertiary
        ? ACTION_TERTIARY_MARGIN_HORIZONTAL
        : undefined,
      borderWidth: ACTION_BORDER_WIDTH,
      borderRadius: ACTION_RADIUS,
      disabledOpacity: ACTION_DISABLED_OPACITY,
    };
  });
}

function statusIcon(
  context: IToastStyleContext,
  input: IToastMessageSpecInput,
): IOverlayToastIcon | undefined {
  const { colors } = context;
  const { haptic, icon } = input;
  if (icon) {
    // A custom glyph takes the status color, critical when there is none.
    const status =
      haptic && haptic !== 'loading' && haptic !== 'none'
        ? STATUS_ICONS[haptic]
        : undefined;
    return namedIcon(
      context,
      icon,
      colors[status?.color ?? 'iconCritical'],
      STATUS_ICON_SIZE,
    );
  }
  if (haptic === 'loading') {
    return { kind: 'spinner', color: colors.icon, size: STATUS_ICON_SIZE };
  }
  if (!haptic || haptic === 'none') {
    return undefined;
  }
  const status = STATUS_ICONS[haptic];
  return namedIcon(
    context,
    status.name,
    colors[status.color],
    STATUS_ICON_SIZE,
  );
}

export function buildMessageToastSpec(
  context: IToastStyleContext,
  input: IToastMessageSpecInput,
): IOverlayMessageToast {
  const { colors } = context;
  return {
    id: input.id,
    layout: 'message',
    duration: input.duration,
    position: input.position,
    icon: statusIcon(context, input),
    title: input.title
      ? richText(context, input.title, 'headingSm', colors.text)
      : undefined,
    message: input.message
      ? richText(
          context,
          input.message,
          context.isWide ? 'bodyMd' : 'bodySm',
          colors.textSubdued,
        )
      : undefined,
    actions: buildActions(context, input.actions),
    actionsAlign: input.actionsAlign,
  };
}

function notificationImageUri(uri: string, size: number): string {
  const pixelRatio =
    (PixelRatio as { get?: () => number } | undefined)?.get?.() ?? 1;
  const resized = buildTosImageResizeUrl({
    uri,
    displayWidth: size,
    displayHeight: size,
    pixelRatio,
  });
  return resized.optimized && resized.uri ? resized.uri : uri;
}

export function buildNotificationToastSpec(
  context: IToastStyleContext,
  input: IToastNotificationSpecInput,
): IOverlayNotificationToast {
  const { colors } = context;
  return {
    id: input.id,
    layout: 'notification',
    duration: input.duration,
    position: input.position,
    icon: input.iconImageUri
      ? {
          kind: 'image',
          uri: notificationImageUri(
            input.iconImageUri,
            NOTIFICATION_ICON_IMAGE_SIZE,
          ),
          size: NOTIFICATION_ICON_IMAGE_SIZE,
        }
      : namedIcon(
          context,
          input.icon || NOTIFICATION_DEFAULT_ICON,
          colors.icon,
          NOTIFICATION_ICON_SIZE,
        ),
    badgeColor: colors.bgStrong,
    badgeSize: NOTIFICATION_BADGE_SIZE,
    title: plainText(context, input.title, 'headingSm', colors.text, 2),
    message: plainText(context, input.message, 'bodyMd', colors.textSubdued, 3),
    image: input.imageUri
      ? {
          uri: notificationImageUri(input.imageUri, NOTIFICATION_IMAGE_SIZE),
          size: NOTIFICATION_IMAGE_SIZE,
          borderRadius: NOTIFICATION_IMAGE_RADIUS,
        }
      : undefined,
    actions: buildActions(context, input.actions),
    actionsAlign: input.actionsAlign,
    pressable: input.pressable,
  };
}
