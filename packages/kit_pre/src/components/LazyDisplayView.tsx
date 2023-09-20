import { useEffect, useState } from 'react';

import { Center, Spinner } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

export function LazyDisplayView({
  delay = 0,
  hideOnUnmount = false,
  children,
  isLazyDisabled = false,
  defaultView = null,
}: {
  delay?: number;
  hideOnUnmount?: boolean;
  children: React.ReactElement | null;
  isLazyDisabled?: boolean;
  defaultView?: JSX.Element | null;
}) {
  const [view, setView] = useState<JSX.Element | null>(defaultView);
  useEffect(() => {
    if (isLazyDisabled) {
      return;
    }
    const timer = setTimeout(() => setView(children), delay);
    return () => {
      clearTimeout(timer);
      if (hideOnUnmount) {
        setView(null);
      }
    };
  }, [children, delay, hideOnUnmount, isLazyDisabled]);

  return isLazyDisabled ? children : view;
}

// Resolve the issue of rendering lag in interactive animations during app page transitions.
export function LazyLoadingDisplayView({
  children = null,
  delay = 50,
}: {
  delay?: number;
  children: React.ReactElement | null;
}) {
  // Only works within the app.
  if (!platformEnv.isNative) {
    return children;
  }
  return (
    <LazyDisplayView
      delay={delay}
      defaultView={
        <Center>
          <Spinner mt={18} size="lg" />
        </Center>
      }
    >
      {children}
    </LazyDisplayView>
  );
}
