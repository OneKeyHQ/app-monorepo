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
  return (
    <YStack flex={1} style={style} ref={contentRef} width={width}>
      {children}
    </YStack>
  );
}
