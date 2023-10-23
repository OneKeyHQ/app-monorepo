import { createLazyKitProvider } from '@onekeyhq/kit/src/provider/createLazyKitProvider';
import '@onekeyhq/shared/src/web/index.css';

const KitProviderExt = createLazyKitProvider({
  displayName: 'KitProviderExt',
});
export default KitProviderExt;
