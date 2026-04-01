import { memo } from 'react';
import type { ComponentType } from 'react';

import { Stack } from '@onekeyhq/components';
import LazyLoad from '@onekeyhq/shared/src/lazyLoad';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ErrorBoundarySimple } from '../ErrorBoundary';

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
  const LazyLoadComponent = LazyLoad<IExtractComponentProps<T>>(
    factory as () => Promise<{
      default: ComponentType<IExtractComponentProps<T>>;
    }>,
    delayMs,
    fallback,
  );
  function LazyLoadPageContainer(props: IExtractComponentProps<T>) {
    const content = unStyle ? (
      <LazyLoadComponent {...props} />
    ) : (
      <Stack
        flex={1}
        className="LazyLoadPageContainer"
        bg={
          platformEnv.isNative ||
          platformEnv.isExtensionUiPopup ||
          platformEnv.isExtensionUiSidePanel ||
          platformEnv.isExtensionBackground
            ? '$bgApp'
            : '$bgSubdued'
        }
      >
        <LazyLoadComponent {...props} />
      </Stack>
    );

    // ErrorBoundary catches React.lazy failures (segment load errors)
    // so the app doesn't white-screen crash (§7.7 non-critical lazy segment).
    return <ErrorBoundarySimple>{content}</ErrorBoundarySimple>;
  }
  return memo(LazyLoadPageContainer) as ComponentType<
    IExtractComponentProps<T>
  >;
}

// prevent useEffect triggers when tab loaded on Native
export const LazyLoadRootTabPage = (factory: () => Promise<{ default: any }>) =>
  // prevent hooks run
  LazyLoadPage(factory, platformEnv.isNative ? 1 : undefined);
