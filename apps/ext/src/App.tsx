import { createLazyKitProvider } from '@onekeyhq/kit/src/provider/createLazyKitProvider';
import { debugLandingLog } from '@onekeyhq/shared/src/performance/init';
import '@onekeyhq/shared/src/web/index.css';

const KitProviderExt = createLazyKitProvider({
  displayName: 'KitProviderExt',
});

export default function App(props: any) {
  if (process.env.NODE_ENV !== 'production') {
    debugLandingLog('App render');
  }
  return <KitProviderExt {...props} />;
}
