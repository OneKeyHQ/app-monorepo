import { useCallback, useEffect, useRef, useState } from 'react';

import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import {
  type IMarketHomePreferences,
  useMarketHomePreferencesAtom,
  useMarketSelectedTabAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

type IMarketHomeSelectionKey = keyof IMarketHomePreferences;

type ILocalSelection<Key extends IMarketHomeSelectionKey> = {
  value: NonNullable<IMarketHomePreferences[Key]>;
  requestId: number;
} & (
  | { status: 'pending'; revision?: number }
  | { status: 'failed'; persistedValue: IMarketHomePreferences[Key] }
);

export function useMarketHomeSelection<Key extends IMarketHomeSelectionKey>(
  key: Key,
  defaultValue: NonNullable<IMarketHomePreferences[Key]>,
) {
  const [preferences, setPreferences] = useMarketHomePreferencesAtom();
  const [marketSelectedTab] = useMarketSelectedTabAtom();
  // Preserve filters saved in the tab payload before they had their own atom.
  const persistedValue = preferences[key] ?? marketSelectedTab[key];
  const persistedValueRef = useRef(persistedValue);
  persistedValueRef.current = persistedValue;
  const persistedRevision = preferences.revision ?? 0;
  const requestIdRef = useRef(0);
  const [localSelection, setLocalSelection] = useState<ILocalSelection<Key>>();

  useEffect(() => {
    if (
      localSelection &&
      ((localSelection.status === 'pending' &&
        localSelection.revision !== undefined &&
        persistedRevision >= localSelection.revision) ||
        (localSelection.status === 'failed' &&
          persistedValue !== localSelection.persistedValue))
    ) {
      setLocalSelection((prev) =>
        prev?.requestId === localSelection.requestId ? undefined : prev,
      );
    }
  }, [localSelection, persistedRevision, persistedValue]);

  useEffect(
    () => () => {
      requestIdRef.current += 1;
    },
    [],
  );

  const handleChange = useCallback(
    (nextValue: NonNullable<IMarketHomePreferences[Key]>) => {
      requestIdRef.current += 1;
      const requestId = requestIdRef.current;
      setLocalSelection({ value: nextValue, requestId, status: 'pending' });

      const persistSelection = async () => {
        try {
          if (
            platformEnv.isExtensionUi ||
            (platformEnv.isNativeMainThread &&
              platformEnv.enableNativeBackgroundThread)
          ) {
            // Merge in bg and wait for its revision, even if another UI's write
            // coalesces our value out of the broadcast before React observes it.
            const update: IMarketHomePreferences = {};
            update[key] = nextValue;
            const revision =
              await backgroundApiProxy.serviceMarketV2.updateMarketHomePreferences(
                update,
              );
            if (requestIdRef.current === requestId) {
              setLocalSelection({
                value: nextValue,
                requestId,
                status: 'pending',
                revision,
              });
            }
          } else {
            setPreferences((prev) => ({
              ...prev,
              [key]: nextValue,
              revision: (prev.revision ?? 0) + 1,
            }));
            if (requestIdRef.current === requestId) {
              setLocalSelection(undefined);
            }
          }
        } catch (error) {
          if (requestIdRef.current !== requestId) {
            return;
          }
          // A rejected write (including Travel Mode) remains a session-only
          // choice until an authoritative update arrives for this field.
          setLocalSelection({
            value: nextValue,
            requestId,
            status: 'failed',
            persistedValue: persistedValueRef.current,
          });
          defaultLogger.app.error.log(
            `Market home preference update failed (${key}): ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      };
      void persistSelection();
    },
    [key, setPreferences],
  );

  const shouldUseLocalSelection =
    localSelection &&
    (localSelection.status === 'pending'
      ? localSelection.revision === undefined ||
        persistedRevision < localSelection.revision
      : persistedValue === localSelection.persistedValue);
  const selectedValue = shouldUseLocalSelection
    ? localSelection.value
    : (persistedValue ?? defaultValue);

  return [selectedValue, handleChange] as const;
}
