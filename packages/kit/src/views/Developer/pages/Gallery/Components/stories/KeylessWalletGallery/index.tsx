import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { KeylessWalletGallery } from './KeylessWalletGallery';

export function KeylessWalletGalleryWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <KeylessWalletGallery />
    </AccountSelectorProviderMirror>
  );
}

export default KeylessWalletGalleryWithContext;
