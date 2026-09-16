import { memo } from 'react';
import type { ComponentType, ReactNode } from 'react';

import { Stack, useIsDesktopModeUIInTabPages } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Helper type to extract component props from a lazy-loaded module
type IExtractComponentProps<T> = T extends () => Promise<{
  default: ComponentType<infer P>;
}>
  ? P
  : never;

export function LazyLoadPage<
  T extends () => Promise<{ default: ComponentType<any> }>,
>(
  factory: T,
  delayMs?: number,
  unStyle?: boolean,
  fallback?: React.ReactNode,
): ComponentType<IExtractComponentProps<T>> {
  // Deliberately no default fallback. A route suspends for as long as its
  // split-bundle segment takes to resolve, and on Android every navigation runs
  // with `animation: 'none'` (see GlobalScreenOptions.native.ts), so a default
  // spinner is never masked by a transition and flashes on every page open.
  // Rendering nothing leaves LazyLoadPageContainer's background on screen
  // instead; routes that want visible loading state pass `fallback` explicitly.
  const LazyLoadComponent = LazyLoad<IExtractComponentProps<T>>(
    factory as () => Promise<{
      default: ComponentType<IExtractComponentProps<T>>;
    }>,
    delayMs,
    fallback ?? null,
  );
  function LazyLoadPageContainer(props: IExtractComponentProps<T>) {
    const isDesktopModeUI = useIsDesktopModeUIInTabPages();

    if (unStyle) {
      return <LazyLoadComponent {...props} />;
    }

    return (
      <Stack
        flex={1}
        className="LazyLoadPageContainer"
        bg={isDesktopModeUI ? '$bgSubdued' : '$bgApp'}
      >
        <LazyLoadComponent {...props} />
      </Stack>
    );
  }
  return memo(LazyLoadPageContainer) as ComponentType<
    IExtractComponentProps<T>
  >;
}

// prevent useEffect triggers when tab loaded on Native
export const LazyLoadRootTabPage = (
  factory: () => Promise<{ default: any }>,
  fallback?: ReactNode,
) => {
  // prevent hooks run
  const Page = LazyLoadPage(
    factory,
    platformEnv.isNative ? 1 : undefined,
    undefined,
    fallback,
  );
  return memo(Page);
};
