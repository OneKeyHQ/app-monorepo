import { useEffect, useRef, useState } from 'react';

export function createLazyKitProvider({
  displayName,
}: {
  displayName: string;
}) {
  const LazyKitProvider = (props: any) => {
    const propsRef = useRef(props);
    const [cmp, setCmp] = useState<any>(null);
    useEffect(() => {
      setTimeout(() => {
        import('@onekeyhq/kit').then((module) => {
          const { Provider } = module;
          setCmp(<Provider {...propsRef.current} />);
        });
      }, 5000);
    }, []);
    if (cmp) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return cmp;
    }
    return null;
  };
  LazyKitProvider.displayName = displayName;
  return LazyKitProvider;
}
