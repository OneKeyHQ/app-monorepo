import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IMarketHomePreferences,
  useMarketHomePreferencesAtom,
  useMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IMarketHomeSelectionKey = keyof IMarketHomePreferences;

export function useMarketHomeSelection<Key extends IMarketHomeSelectionKey>(
  key: Key,
  defaultValue: NonNullable<IMarketHomePreferences[Key]>,
) {
  const [preferences, setPreferences] = useMarketHomePreferencesAtom();
  const [marketSelectedTab] = useMarketSelectedTabAtom();
  // Preserve filters saved in the tab payload before they had their own atom.
  const persistedValue = preferences[key] ?? marketSelectedTab[key];
  const [value, setValue] = useState(persistedValue ?? defaultValue);
  const pendingValueRef = useRef<IMarketHomePreferences[Key]>(undefined);

  useEffect(() => {
    // UI atom writes on native and extension return through bg asynchronously.
    // Keep the local selection until the mirror catches up with its latest value.
    if (pendingValueRef.current === persistedValue) {
      pendingValueRef.current = undefined;
    }
  }, [persistedValue]);

  const handleChange = useCallback(
    (nextValue: NonNullable<IMarketHomePreferences[Key]>) => {
      pendingValueRef.current = nextValue;
      setValue(nextValue);
      if (
        platformEnv.isExtensionUi ||
        (platformEnv.isNativeMainThread &&
          platformEnv.enableNativeBackgroundThread)
      ) {
        // Merge only the changed field in bg; the UI mirror can still be stale.
        const update: IMarketHomePreferences = {};
        update[key] = nextValue;
        void backgroundApiProxy.serviceMarketV2.updateMarketHomePreferences(
          update,
        );
      } else {
        setPreferences((prev) => ({ ...prev, [key]: nextValue }));
      }
    },
    [key, setPreferences],
  );

  const selectedValue =
    pendingValueRef.current === undefined
      ? (persistedValue ?? defaultValue)
      : value;

  return [selectedValue, handleChange] as const;
}
