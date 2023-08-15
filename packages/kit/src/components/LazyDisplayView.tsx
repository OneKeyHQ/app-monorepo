import { useEffect, useState } from 'react';

export function LazyDisplayView({
  delay = 0,
  hideOnUnmount = false,
  children,
  isLazyDisabled = false,
  defaultView = null,
}: {
  delay?: number;
  hideOnUnmount?: boolean;
  children: JSX.Element | null;
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
