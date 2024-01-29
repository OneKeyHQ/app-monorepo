import { useEffect } from 'react';

export function useDebugComponentRemountLog({ name }: { name: string }) {
  useEffect(() => {
    console.log(`ComponentRemountLog mounted:  ${name}`);
    return () => {
      console.log(`ComponentRemountLog unmounted:  ${name}`);
    };
  }, [name]);
}
