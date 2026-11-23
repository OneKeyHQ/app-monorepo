import { memo, useEffect, useLayoutEffect, useMemo } from 'react';

import {
  OverlayToastHost,
  overlayToastStore,
} from '@onekeyfe/react-native-native-overlay';
import { getConfig } from '@tamagui/web';
import { useIntl } from 'react-intl';
import { I18nManager, useWindowDimensions } from 'react-native';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { usePageWidth } from '../../hooks/usePage';
import { useMedia, useTheme, useThemeName } from '../../hooks/useStyle';
import { getFontToken } from '../../utils/getFontSize';

import {
  TOAST_COLOR_KEYS,
  TOAST_FONT_KEYS,
  setToastStyleContext,
} from './toastStyleContext';
import {
  TOAST_ROOM,
  TOAST_UNDER_OBSTRUCTION_GAP,
  useToastTopObstruction,
} from './topObstruction';

import type {
  IToastColorKey,
  IToastFont,
  IToastFontKey,
  IToastStyleContext,
} from './toastStyleContext';
import type { IOverlayToastFontWeight } from '@onekeyfe/react-native-native-overlay';
import type { FontSizeTokens } from 'tamagui';

// The widest a native card's content grows, and the margin it keeps.
const NATIVE_CONTENT_MAX_PAGE_WIDTH = 640;
const NATIVE_CONTENT_MARGIN = 64;
const NATIVE_CONTENT_HEIGHT_MARGIN = 200;
const WEB_CONTENT_HEIGHT_MARGIN = 100;

function resolveFont(key: IToastFontKey): IToastFont {
  const token = getFontToken(`$${key}` as FontSizeTokens);
  const font = typeof token === 'object' && token ? token : undefined;
  return {
    fontSize: font?.fontSize ?? 14,
    lineHeight: font?.lineHeight ?? 20,
    fontWeight: String(font?.fontWeight ?? '400') as IOverlayToastFontWeight,
    letterSpacing: font?.letterSpacing ?? 0,
  };
}

const FONT_WEIGHTS: IOverlayToastFontWeight[] = ['400', '500', '600', '700'];

// The native brand typeface ships one face per weight.
function resolveFontFaces():
  | Partial<Record<IOverlayToastFontWeight, string>>
  | undefined {
  if (!platformEnv.isNative) {
    return undefined;
  }
  const face = getConfig().fontsParsed.$body?.face as
    | Record<string, { normal?: unknown } | undefined>
    | undefined;
  if (!face) {
    return undefined;
  }
  const faces: Partial<Record<IOverlayToastFontWeight, string>> = {};
  FONT_WEIGHTS.forEach((weight) => {
    // A parsed font keeps each face as a variable or as its plain value.
    const normal = face[weight]?.normal as
      | { val?: unknown }
      | string
      | undefined;
    const name = typeof normal === 'object' ? normal?.val : normal;
    if (typeof name === 'string') {
      faces[weight] = name;
    }
  });
  return faces;
}

function resolveFontFamily(): string | undefined {
  const family = getConfig().fontsParsed.$body?.family as
    | { val?: unknown }
    | string
    | undefined;
  const value = typeof family === 'object' ? family?.val : family;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Connects the message toasts to the platform renderer. It publishes what a
 * toast needs from the React tree (theme, type scale, layout class) and
 * keeps the toaster's settings current; the cards themselves are drawn by
 * the platform, not by React.
 */
function BasicToastHost() {
  const intl = useIntl();
  const theme = useTheme();
  const themeName = useThemeName();
  const media = useMedia();
  const { height } = useWindowDimensions();
  const pageWidth = usePageWidth();
  // Native toasts always land at the top; a wide web window's toasts live in
  // the bottom corner and never meet what hangs from the top.
  const landsAtTop = platformEnv.isNative || media.md;
  const obstruction = useToastTopObstruction(landsAtTop);
  const isWide = media.gtMd;
  const isDark = themeName.startsWith('dark');

  const context = useMemo<IToastStyleContext>(() => {
    const colors = {} as Record<IToastColorKey, string>;
    TOAST_COLOR_KEYS.forEach((key) => {
      const value = theme[key]?.val as unknown;
      colors[key] = typeof value === 'string' ? value : 'transparent';
    });
    const fonts = {} as Record<IToastFontKey, IToastFont>;
    TOAST_FONT_KEYS.forEach((key) => {
      fonts[key] = resolveFont(key);
    });
    return {
      colors,
      fonts,
      fontFamily: resolveFontFamily(),
      fontFaces: resolveFontFaces(),
      intl,
      isWide,
      isRTL: I18nManager.isRTL,
    };
    // The theme object is stable; its values follow the theme name.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intl, theme, themeName, isWide]);

  useLayoutEffect(() => {
    setToastStyleContext(context);
  }, [context]);

  useEffect(() => {
    overlayToastStore.configure({
      position: landsAtTop ? 'top-center' : 'bottom-right',
      theme: isDark ? 'dark' : 'light',
      cardColor: context.colors.bg,
      contentWidth:
        Math.min(pageWidth, NATIVE_CONTENT_MAX_PAGE_WIDTH) -
        NATIVE_CONTENT_MARGIN,
      contentMaxHeight: height - NATIVE_CONTENT_HEIGHT_MARGIN,
      webContentMaxHeight: height - WEB_CONTENT_HEIGHT_MARGIN,
      topObstruction: obstruction,
      topObstructionGap: TOAST_UNDER_OBSTRUCTION_GAP,
      topObstructionRoom: TOAST_ROOM,
      testID: 'onekey-toast-messages',
    });
  }, [context.colors.bg, height, isDark, landsAtTop, obstruction, pageWidth]);

  return <OverlayToastHost />;
}

export const ToastHost = memo(BasicToastHost);
