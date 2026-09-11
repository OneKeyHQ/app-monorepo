import platformEnv from '@onekeyhq/shared/src/platformEnv';

// One shape for both branches, so a typo inside this file is a type error
// rather than a prop that silently never reaches the row.
export type ICategoryRowActivationProps = {
  accessibilityRole: 'button';
  accessibilityState: { disabled?: boolean; selected?: boolean };
  role?: 'button';
  'aria-disabled'?: boolean;
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

// The Select these rows replaced was a real listbox: focusable trigger, arrow
// keys, Enter to pick, Escape to leave. An XStack with an onPress carries none
// of it, so the trigger and the rows it opens have to put the keyboard path
// back or the whole category flow is pointer-only on web, desktop and the
// extension.
//
// role, tabIndex and onKeyDown are DOM-only and React warns about them on a
// native View, so they only ship in the browser.
export function buildCategoryRowActivationProps({
  disabled,
  onActivate,
  selected,
  outlineOffset,
}: {
  disabled?: boolean;
  onActivate: () => void;
  selected?: boolean;
  // Negative pulls the ring inside a full-bleed row; positive sits it outside a
  // bordered trigger.
  outlineOffset: number;
}): ICategoryRowActivationProps {
  const web = platformEnv.isRuntimeBrowser;

  if (disabled) {
    return {
      accessibilityRole: 'button',
      accessibilityState: { disabled: true },
      ...(web ? { role: 'button' as const, 'aria-disabled': true } : {}),
    };
  }

  return {
    accessibilityRole: 'button',
    // Only rows carry a selection; the collapsed trigger has none, and
    // announcing "not selected" on it is noise.
    accessibilityState: selected === undefined ? {} : { selected },
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
          role: 'button' as const,
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
