import { useEffect, useRef, useState } from 'react';

import '../background/instance/backgroundApiProxy';

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
        // KitProviderMock index
        import('./index').then((module) => {
          const KitProvider = module.default;
          setCmp(<KitProvider {...propsRef.current} />);
        });
      }, 0);
    }, []);
    if (cmp) {
      global.$$onekeyPerfTrace?.log({
        name: 'LazyKitProvider render **children**',
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      return cmp;
    }
    global.$$onekeyPerfTrace?.log({ name: 'LazyKitProvider render [null]' });
    return null;
  };
  LazyKitProvider.displayName = displayName;
  return LazyKitProvider;
}
