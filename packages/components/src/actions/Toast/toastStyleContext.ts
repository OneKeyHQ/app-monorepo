import type { IOverlayToastFontWeight } from '@onekeyfe/react-native-native-overlay';
import type { IntlShape } from 'react-intl';

/** The theme colors a toast card can paint with, resolved to CSS colors. */
export type IToastColorKey =
  | 'text'
  | 'textSubdued'
  | 'textInverse'
  | 'textOnColor'
  | 'textInfo'
  | 'textCritical'
  | 'textSuccess'
  | 'textCaution'
  | 'bg'
  | 'bgStrong'
  | 'bgStrongHover'
  | 'bgStrongActive'
  | 'bgPrimary'
  | 'bgPrimaryHover'
  | 'bgPrimaryActive'
  | 'bgHover'
  | 'bgActive'
  | 'bgCriticalStrong'
  | 'bgCriticalStrongHover'
  | 'bgCriticalStrongActive'
  | 'bgAccent'
  | 'bgAccentHover'
  | 'bgAccentActive'
  | 'transparent'
  | 'focusRing'
  | 'focusRingCritical'
  | 'icon'
  | 'iconInverse'
  | 'iconSubdued'
  | 'iconOnColor'
  | 'iconSuccess'
  | 'iconCritical'
  | 'iconInfo'
  | 'iconCaution';

export const TOAST_COLOR_KEYS: readonly IToastColorKey[] = [
  'text',
  'textSubdued',
  'textInverse',
  'textOnColor',
  'textInfo',
  'textCritical',
  'textSuccess',
  'textCaution',
  'bg',
  'bgStrong',
  'bgStrongHover',
  'bgStrongActive',
  'bgPrimary',
  'bgPrimaryHover',
  'bgPrimaryActive',
  'bgHover',
  'bgActive',
  'bgCriticalStrong',
  'bgCriticalStrongHover',
  'bgCriticalStrongActive',
  'bgAccent',
  'bgAccentHover',
  'bgAccentActive',
  'transparent',
  'focusRing',
  'focusRingCritical',
  'icon',
  'iconInverse',
  'iconSubdued',
  'iconOnColor',
  'iconSuccess',
  'iconCritical',
  'iconInfo',
  'iconCaution',
];

export type IToastFontKey = 'headingSm' | 'bodyMd' | 'bodySm' | 'bodyMdMedium';

export const TOAST_FONT_KEYS: readonly IToastFontKey[] = [
  'headingSm',
  'bodyMd',
  'bodySm',
  'bodyMdMedium',
];

export interface IToastFont {
  fontSize: number;
  lineHeight: number;
  fontWeight: IOverlayToastFontWeight;
  letterSpacing: number;
}

/**
 * What a toast needs from the React tree to become plain data: the resolved
 * theme, type scale and layout class. `ToastHost` publishes it; `Toast.*`
 * reads the latest value when it builds a card.
 */
export interface IToastStyleContext {
  colors: Record<IToastColorKey, string>;
  fonts: Record<IToastFontKey, IToastFont>;
  fontFamily?: string;
  /** Native: the font name per weight of the brand typeface. */
  fontFaces?: Partial<Record<IOverlayToastFontWeight, string>>;
  /** The app's locale, for formatting toast text. */
  intl: IntlShape;
  /** `media.gtMd`: the wide layout uses the larger message type. */
  isWide: boolean;
  isRTL: boolean;
}

let current: IToastStyleContext | undefined;
const listeners = new Set<() => void>();

export function getToastStyleContext(): IToastStyleContext | undefined {
  return current;
}

export function setToastStyleContext(next: IToastStyleContext | undefined) {
  current = next;
  listeners.forEach((listener) => listener());
}

export function subscribeToastStyleContext(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
