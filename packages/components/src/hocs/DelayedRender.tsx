import { useEffect, useState } from 'react';

interface IDelayedRenderProps {
  delay?: number;
  children: React.ReactNode;
}

export function DelayedRender({ delay = 0, children }: IDelayedRenderProps) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return shouldRender ? <>{children}</> : null;
}

export function withDelayedRender<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  delay: number,
) {
  return function WithDelayedRender(props: P) {
    return (
      <DelayedRender delay={delay}>
        <WrappedComponent {...props} />
      </DelayedRender>
    );
  };
}
