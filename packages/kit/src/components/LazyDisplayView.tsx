import { Center, Spinner } from '@onekeyhq/components';
import { useEffect, useState } from 'react';

export function LazyDisplayView({
  delay = 0,
  hideOnUnmount = false,
  children,
  isLazyDisabled = false,
  loadingView = null,
}: {
  delay?: number;
  hideOnUnmount?: boolean;
  children: JSX.Element | null;
  isLazyDisabled?: boolean;
  loadingView?: JSX.Element | null;
}) {
  const [view, setView] = useState<JSX.Element | null>(loadingView);
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

export function LazyLoadingDisplayView({ children, delay = 50 }: { delay?: number; children: JSX.Element }) {
  return (
    <LazyDisplayView
      delay={delay}
      loadingView={
        <Center>
          <Spinner mt={18} size="lg" />
        </Center>}
    >
      {children}
    </LazyDisplayView>
  )
}