import { useEffect, useState } from 'react';

export function LazyDisplayView({
  delay = 0,
  hideOnUnmount = false,
  children,
}: {
  delay?: number;
  hideOnUnmount?: boolean;
  children: JSX.Element | null;
}) {
  const [view, setView] = useState<JSX.Element | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setView(children), delay);
    return () => {
      clearTimeout(timer);
      if (hideOnUnmount) {
        setView(null);
      }
    };
  }, [children, delay, hideOnUnmount]);
  return view;
}
