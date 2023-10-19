import { useCallback, useEffect, useRef, useState } from 'react';

import { Appearance } from 'react-native';

import type { ColorSchemeName } from 'react-native';

export function useColorScheme(delay = 500): NonNullable<ColorSchemeName> {
  const [colorScheme, setColorScheme] = useState(Appearance.getColorScheme());

  const ref = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetCurrentTimeout = useCallback(() => {
    if (ref.current) {
      clearTimeout(ref.current);
    }
  }, [ref]);

  const onColorSchemeChange = useCallback(
    (preferences: Appearance.AppearancePreferences) => {
      resetCurrentTimeout();

      ref.current = setTimeout(() => {
        setColorScheme(preferences.colorScheme);
      }, delay);
    },
    [ref, resetCurrentTimeout, delay],
  );

  useEffect(() => {
    const subscribe = Appearance.addChangeListener(onColorSchemeChange);

    return () => {
      resetCurrentTimeout();
      subscribe.remove();
    };
  }, [onColorSchemeChange, resetCurrentTimeout]);

  return colorScheme as NonNullable<ColorSchemeName>;
}
