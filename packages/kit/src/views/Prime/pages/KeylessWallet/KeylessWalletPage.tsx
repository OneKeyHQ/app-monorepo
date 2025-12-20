import { Page } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { KeylessShareCardsView } from '../../../Onboardingv2/components/KeylessShareCardsView';

function KeylessWalletPage() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Keyless Wallet" />
      <Page.Body>
        <KeylessShareCardsView
          mode={EOnboardingV2KeylessWalletCreationMode.View}
        />
      </Page.Body>
    </Page>
  );
}

export default function KeylessWalletPageWithContext() {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <KeylessWalletPage />
    </AccountSelectorProviderMirror>
  );
}
