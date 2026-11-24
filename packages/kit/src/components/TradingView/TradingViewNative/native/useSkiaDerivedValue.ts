// cspell:ignore Skia
import { useEffect, useState } from 'react';

import {
  makeMutable,
  startMapper,
  stopMapper,
  useSharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import type { SharedValue } from 'react-native-reanimated';

export function useSkiaDerivedValue<T>(
  render: () => T,
  inputs: unknown[],
  dependencies: unknown[],
  onSkiaError: (() => void) | undefined,
) {
  // Initialize under the React boundary. Keep the last valid output on the UI
  // runtime until React replaces the failed canvas.
  const [value] = useState(() => makeMutable(render()));
  const failed = useSharedValue(false);

  useEffect(() => {
    // Register the output so resource, font and picture mappers run in order.
    const mapper = startMapper(
      () => {
        'worklet';
        if (failed.value) return;
        try {
          value.value = render();
        } catch {
          failed.value = true;
          if (onSkiaError) scheduleOnRN(onSkiaError);
        }
      },
      inputs,
      [value as SharedValue<unknown>],
    );
    return () => stopMapper(mapper);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- The caller supplies the mapper's shared inputs and captured render dependencies.
  }, [...inputs, ...dependencies, failed, onSkiaError, value]);

  return value;
}
