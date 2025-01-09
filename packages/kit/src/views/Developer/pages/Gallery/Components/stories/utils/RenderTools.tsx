import { useEffect, useState } from 'react';

import { SizableText } from '@onekeyhq/components';

export function useFreezeProbe(
  componentName: string,
  options?: {
    pause?: boolean;
  },
) {
  const [rerenderCount, setRerenderCount] = useState(0);
  useEffect(() => {
    const timeout = setInterval(() => {
      if (options?.pause) return;
      setRerenderCount((count) => count + 1);
    }, 5000);

    return () => {
      clearInterval(timeout);
    };
  }, [options?.pause]);

  useEffect(() => {
    console.log(
      `<== FreezeProbe: ${componentName} Rerender Count: ${rerenderCount}`,
    );
  }, [componentName, rerenderCount]);

  return rerenderCount;
}

export function FreezeProbe({ componentName }: { componentName: string }) {
  const count = useFreezeProbe(componentName);
  return (
    <SizableText>
      {componentName} Rerender Count: {count}
    </SizableText>
  );
}
