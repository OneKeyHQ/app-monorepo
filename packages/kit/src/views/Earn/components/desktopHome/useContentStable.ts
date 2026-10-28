import { useMemo, useRef } from 'react';

import { isEqualWith } from 'lodash';

// In the app's web build lodash's isEqual takes any two Maps for equal (an
// empty one and a full one), which held the home's wallet balances and
// network names at their first, empty Maps. Maps and Sets compare here
function compareCollections(a: unknown, b: unknown): boolean | undefined {
  if (a instanceof Map && b instanceof Map) {
    return (
      a.size === b.size &&
      Array.from(a).every(
        ([key, value]) => b.has(key) && isContentEqual(value, b.get(key)),
      )
    );
  }
  if (a instanceof Set && b instanceof Set) {
    return a.size === b.size && Array.from(a).every((value) => b.has(value));
  }
  return undefined;
}

/** Deep equality that also sees into Maps and Sets */
export function isContentEqual(a: unknown, b: unknown): boolean {
  return isEqualWith(a, b, compareCollections);
}

/**
 * The value from the last render while the new one is deep-equal to it.
 * Requests asked again and polls hand back equal data as new objects (the
 * page coming back into focus asks again for everything it shows), and
 * passed on as they are, each one re-renders a memoized section and every
 * row in it for nothing. Comparing costs far less than re-rendering rows.
 */
export function useContentStable<T>(value: T): T {
  const ref = useRef(value);
  if (ref.current !== value && !isContentEqual(ref.current, value)) {
    ref.current = value;
  }
  return ref.current;
}

/**
 * The list with every item that is deep-equal to the last render's item of
 * the same key kept as that object. A rebuilt list (a poll, a refetch, a
 * filter) then re-renders only the memoized rows whose item changed.
 */
export function useStableItems<T>(items: T[], getKey: (item: T) => string) {
  const cacheRef = useRef(new Map<string, T>());
  return useMemo(() => {
    const previous = cacheRef.current;
    const next = new Map<string, T>();
    const kept = items.map((item) => {
      const key = getKey(item);
      const old = previous.get(key);
      const stable =
        old !== undefined && isContentEqual(old, item) ? old : item;
      next.set(key, stable);
      return stable;
    });
    cacheRef.current = next;
    return kept;
    // getKey reads a field of the item; a new function each render changes
    // nothing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);
}
