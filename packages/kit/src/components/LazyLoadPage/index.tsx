import { memo } from 'react';
import type { ComponentType, ReactNode } from 'react';

import {
  Spinner,
  Stack,
  useIsDesktopModeUIInTabPages,
} from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

// Helper type to extract component props from a lazy-loaded module
type IExtractComponentProps<T> = T extends () => Promise<{
  default: ComponentType<infer P>;
}>
  ? P
  : never;

// Desktop-mode tab pages render BasicPage as a rounded card. This backdrop
// fills the area around its rounded corners.
export function LazyLoadPageBackdrop({ children }: { children: ReactNode }) {
  const isDesktopModeUI = useIsDesktopModeUIInTabPages();

  return (
    <Stack
      flex={1}
      className="LazyLoadPageContainer"
      bg={isDesktopModeUI ? '$bgSubdued' : '$bgApp'}
    >
      {children}
    </Stack>
  );
}

export function LazyLoadPage<
  T extends () => Promise<{ default: ComponentType<any> }>,
>(
  factory: T,
  delayMs?: number,
  unStyle?: boolean,
  fallback?: React.ReactNode,
): ComponentType<IExtractComponentProps<T>> {
  const defaultFallback = (
    <Stack flex={1} alignItems="center" justifyContent="center">
      <Spinner size="large" />
    </Stack>
  );
  const LazyLoadComponent = LazyLoad<IExtractComponentProps<T>>(
    factory as () => Promise<{
      default: ComponentType<IExtractComponentProps<T>>;
    }>,
    delayMs,
    fallback ?? defaultFallback,
  );
  function LazyLoadPageContainer(props: IExtractComponentProps<T>) {
    if (unStyle) {
      return <LazyLoadComponent {...props} />;
    }

    return (
      <LazyLoadPageBackdrop>
        <LazyLoadComponent {...props} />
      </LazyLoadPageBackdrop>
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
