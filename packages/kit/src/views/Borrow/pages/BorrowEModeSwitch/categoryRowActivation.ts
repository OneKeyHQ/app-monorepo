import platformEnv from '@onekeyhq/shared/src/platformEnv';

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

// Native reads accessibilityState; react-native-web needs explicit aria-*.
// Keep DOM roles and keyboard handlers browser-only.
export function buildCategoryRowActivationProps({
  disabled,
  onActivate,
  selected,
  outlineOffset,
}: {
  disabled?: boolean;
  onActivate: () => void;
  // Omitted for the button trigger; category rows announce as radios.
  selected?: boolean;
  // Place the ring inside a full-width row or outside a bordered trigger.
  outlineOffset: number;
}): ICategoryRowActivationProps {
  const isBrowser = platformEnv.isRuntimeBrowser;
  const accessibilityProps: ICategoryRowActivationProps = {
    accessibilityRole: selected === undefined ? 'button' : 'radio',
    accessibilityState: {},
  };

  if (isBrowser) {
    accessibilityProps.role = accessibilityProps.accessibilityRole;
  }
  if (selected !== undefined) {
    accessibilityProps.accessibilityState.checked = selected;
    if (isBrowser) {
      accessibilityProps['aria-checked'] = selected;
    }
  }

  if (disabled) {
    accessibilityProps.accessibilityState.disabled = true;
    if (isBrowser) {
      accessibilityProps['aria-disabled'] = true;
    }
    return accessibilityProps;
  }

  return {
    ...accessibilityProps,
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
    ...(isBrowser
      ? {
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
