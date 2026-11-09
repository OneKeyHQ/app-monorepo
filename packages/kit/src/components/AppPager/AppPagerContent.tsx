import { useCallback, useEffect, useState } from 'react';
import type { ComponentProps, PropsWithChildren } from 'react';

import { YStack } from '@onekeyhq/components';
import { useScrollContentRegistration } from '@onekeyhq/components/src/composite/ScrollContentRegistration';

import { useAppPagerPage } from './useAppPagerPage';

export function AppPagerContent({
  children,
  style,
}: PropsWithChildren<{ style?: ComponentProps<typeof YStack>['style'] }>) {
  const { width, isFocused } = useAppPagerPage();
  const registerContent = useScrollContentRegistration();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const contentRef = useCallback(
    (node: unknown) =>
      setElement(
        typeof HTMLElement !== 'undefined' && node instanceof HTMLElement
          ? node
          : null,
      ),
    [],
  );
  useEffect(() => {
    if (!isFocused || !element) return undefined;
    return registerContent?.(element);
  }, [element, isFocused, registerContent]);
  // The web pager reports `width` 0 until its page owner has been measured
  // (OK-66299). Pinning the page to 0 for that first paint collapses any
  // shrinkable text to one character per line, so let an unmeasured page
  // stretch to its owner instead and only pin the width once it is known.
  return (
    <YStack
      flex={1}
      style={style}
      ref={contentRef}
      width={width > 0 ? width : undefined}
    >
      {children}
    </YStack>
  );
}
