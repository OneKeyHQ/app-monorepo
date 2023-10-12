import { useEffect, useState } from 'react';

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
    console.log(`::> ${componentName} Rerender Count: ${rerenderCount}`);
  }, [componentName, rerenderCount]);
}

export function FreezeProbe({ componentName }: { componentName: string }) {
  useFreezeProbe(componentName);
  return null;
}
