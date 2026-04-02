import { Page } from '@onekeyhq/components';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { WalletConnectModalContainer } from '../../../components/WalletConnect/WalletConnectModalContainer';

export function GlobalWalletConnectModalContainer() {
  return platformEnv.isNativeIOS ? (
    <Page.Every>
      <WalletConnectModalContainer />
    </Page.Every>
  ) : (
    <WalletConnectModalContainer />
  );
}
