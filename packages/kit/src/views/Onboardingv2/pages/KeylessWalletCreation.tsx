import type { IPageScreenProps } from '@onekeyhq/components';
import { Page } from '@onekeyhq/components';
import type {
  EOnboardingPagesV2,
  IOnboardingParamListV2,
} from '@onekeyhq/shared/src/routes/onboardingv2';
import { EOnboardingV2KeylessWalletCreationMode } from '@onekeyhq/shared/src/routes/onboardingv2';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { useKeylessWalletFeatureIsEnabled } from '../../../components/KeylessWallet/useKeylessWallet';
import { useAppRoute } from '../../../hooks/useAppRoute';
import { KeylessShareCardsView } from '../components/KeylessShareCardsView';
import { OnboardingLayout } from '../components/OnboardingLayout';

function KeylessWalletCreation() {
  const route = useAppRoute<
    IOnboardingParamListV2,
    EOnboardingPagesV2.KeylessWalletCreation
  >();
  const mode =
    route.params?.mode ?? EOnboardingV2KeylessWalletCreationMode.Create;
  const isKeylessWalletEnabled = useKeylessWalletFeatureIsEnabled();

  if (!isKeylessWalletEnabled) {
    return null;
  }

  return (
    <Page>
      <OnboardingLayout>
        <OnboardingLayout.Header title="Secure your wallet" />
        <OnboardingLayout.Body constrained={false}>
          <KeylessShareCardsView mode={mode} />
        </OnboardingLayout.Body>
        <OnboardingLayout.Footer />
      </OnboardingLayout>
    </Page>
  );
}

function KeylessWalletCreationWithContext({
  route: _route,
}: IPageScreenProps<
  IOnboardingParamListV2,
  EOnboardingPagesV2.KeylessWalletCreation
>) {
  return (
    <AccountSelectorProviderMirror
      enabledNum={[0]}
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
    >
      <KeylessWalletCreation />
    </AccountSelectorProviderMirror>
  );
}

export default KeylessWalletCreationWithContext;
