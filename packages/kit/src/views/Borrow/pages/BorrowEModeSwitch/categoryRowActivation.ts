import platformEnv from '@onekeyhq/shared/src/platformEnv';

// The Select these rows replaced was a real listbox: focusable trigger, arrow
// keys, Enter to pick, Escape to leave. An XStack with an onPress carries none
// of it, so the trigger and the rows it opens have to put the keyboard path
// back or the whole category flow is pointer-only on web, desktop and the
// extension.
//
// role and tabIndex are DOM-only and React warns about them on native, so they
// ride in the browser branch next to the key handler that needs them.
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
}): Record<string, unknown> {
  if (disabled) {
    return {
      accessibilityRole: 'button',
      accessibilityState: { disabled: true },
      ...(platformEnv.isRuntimeBrowser
        ? { role: 'button', 'aria-disabled': true }
        : {}),
    };
  }

  return {
    accessibilityRole: 'button',
    accessibilityState: { selected: !!selected },
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
    ...(platformEnv.isRuntimeBrowser
      ? {
          role: 'button',
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
