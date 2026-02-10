import { createLazyKitProvider } from '@onekeyhq/kit/src/provider/createLazyKitProvider';
import '@onekeyhq/shared/src/web/index.css';

const KitProviderExt = createLazyKitProvider({
  displayName: 'KitProviderExt',
});

export default function App(props: any) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(
      `[LANDING_DEBUG] App render, +${(performance.now() - ((globalThis as any).$$debugT0 ?? 0)).toFixed(1)}ms`,
    );
  }
  return <KitProviderExt {...props} />;
}
