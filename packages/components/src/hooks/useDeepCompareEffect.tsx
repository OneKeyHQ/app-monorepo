import { useEffect, useRef } from 'react';

import { isEqual } from 'lodash';

/**
 * A hook that works like useEffect but performs deep comparison on dependencies
 * instead of shallow comparison. This is useful when you need to compare complex
 * objects or arrays as dependencies.
 *
 * @param callback - The effect callback function
 * @param dependencies - Array of dependencies to deep compare
 */
export function useDeepCompareEffect(
  callback: () => void | (() => void),
  dependencies: React.DependencyList,
): void {
  const currentDependenciesRef = useRef<React.DependencyList>([]);

  // Only update the ref if dependencies have actually changed (deep comparison)
  if (!isEqual(currentDependenciesRef.current, dependencies)) {
    currentDependenciesRef.current = dependencies;
  }

  // Use the stable reference for useEffect dependencies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(callback, currentDependenciesRef.current);
}
