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
        import('./index').then((module) => {
          const KitProvider = module.default;
          setCmp(<KitProvider {...propsRef.current} />);
        });
      }, 0);
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
