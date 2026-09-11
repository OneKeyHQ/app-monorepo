import platformEnv from '@onekeyhq/shared/src/platformEnv';

// One shape for both branches, so a typo inside this file is a type error
// rather than a prop that silently never reaches the row.
export type ICategoryRowActivationProps = {
  accessibilityRole: 'button' | 'radio';
  accessibilityState: { disabled?: boolean; checked?: boolean };
  role?: 'button' | 'radio';
  'aria-disabled'?: boolean;
  'aria-checked'?: boolean;
  tabIndex?: number;
  onKeyDown?: (event: { key: string; preventDefault: () => void }) => void;
  onPress?: () => void;
  cursor?: 'pointer';
  hoverStyle?: { bg: string };
  pressStyle?: { bg: string };
  focusVisibleStyle?: {
    outlineColor: string;
    outlineWidth: number;
    outlineStyle: 'solid';
    outlineOffset: number;
  };
};

// The Select these rows replaced was an XStack with an onPress and nothing
// else: forms/Select carries no role, no aria-*, no tabIndex, and its Trigger
// carries no onKeyDown either, so the category flow was pointer-only on web,
// desktop and the extension. The trigger and the rows it opens put a keyboard
// path there for the first time.
//
// Every accessibility state ships twice on purpose. react-native-web 0.21
// dropped accessibilityState from its forwarded props, so on the web it
// reaches no DOM attribute at all and only the explicit aria-* survives;
// native reads accessibilityState and ignores aria-*. role, tabIndex and
// onKeyDown are DOM-only and React warns about them on a native View, so
// those stay browser-only.
export function buildCategoryRowActivationProps({
  disabled,
  onActivate,
  selected,
  outlineOffset,
}: {
  disabled?: boolean;
  onActivate: () => void;
  // Rows are one choice out of a set, so they announce as radios inside the
  // list's radiogroup, matching PerpLayoutSettings. The collapsed trigger has
  // no selection of its own and stays a plain button.
  selected?: boolean;
  // Negative pulls the ring inside a full-bleed row; positive sits it outside a
  // bordered trigger.
  outlineOffset: number;
}): ICategoryRowActivationProps {
  const web = platformEnv.isRuntimeBrowser;
  const role =
    selected === undefined ? ('button' as const) : ('radio' as const);
  const nativeChecked = selected === undefined ? {} : { checked: selected };
  const ariaChecked =
    selected === undefined || !web ? {} : { 'aria-checked': selected };

  if (disabled) {
    return {
      accessibilityRole: role,
      accessibilityState: { disabled: true, ...nativeChecked },
      ...(web ? { role, 'aria-disabled': true, ...ariaChecked } : {}),
    };
  }

  return {
    accessibilityRole: role,
    accessibilityState: nativeChecked,
    onPress: onActivate,
    cursor: 'pointer',
    hoverStyle: { bg: '$bgHover' },
    pressStyle: { bg: '$bgActive' },
    focusVisibleStyle: {
      outlineColor: '$focusRing',
      outlineWidth: 2,
      outlineStyle: 'solid',
      outlineOffset,
    },
    ...(web
      ? {
          role,
          ...ariaChecked,
          tabIndex: 0,
          onKeyDown: (event: { key: string; preventDefault: () => void }) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onActivate();
            }
          },
        }
      : {}),
  };
}
