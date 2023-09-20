import type { DependencyList } from 'react';
import { useMemo } from 'react';

import { appSelector } from '../../store';
import { useAppSelector } from '../useAppSelector';

export type ISelectorBuilder<T, O = undefined> = (
  selector: typeof useAppSelector,
  helpers: {
    useMemo: typeof useMemo;
    options: O;
  },
) => T;

export type IBuildCrossHooksResultWithOptions<T, O> = {
  use: (options: O) => T;
  get: (options: O) => T;
};
export type IBuildCrossHooksResult<T> = {
  use: () => T;
  get: () => T;
};

function mockUseMemo<T>(
  factory: () => T,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  deps: DependencyList | undefined,
) {
  return factory();
}

function createHookUi<T, O = undefined>(builder: ISelectorBuilder<T, O>) {
  return (options: O): T => builder(useAppSelector, { useMemo, options });
}

function createHookBg<T, O = undefined>(builder: ISelectorBuilder<T, O>) {
  return (options: O): T =>
    builder(appSelector, {
      useMemo: mockUseMemo, // useMemo for background
      options,
    });
}

/*
NOT allowed for buildCrossHooks:
- reselect createSelector 
- other UI hooks
*/
export function buildCrossHooks<T>(
  builder: ISelectorBuilder<T>,
): IBuildCrossHooksResult<T> {
  return {
    // hooks for UI
    use: createHookUi(builder) as any,
    // getter for Background
    get: createHookBg(builder) as any,
  };
}

export function buildCrossHooksWithOptions<T, O>(
  builder: ISelectorBuilder<T, O>,
): IBuildCrossHooksResultWithOptions<T, O> {
  return {
    // hooks for UI
    use: createHookUi(builder),
    // getter for Background
    get: createHookBg(builder),
  };
}
