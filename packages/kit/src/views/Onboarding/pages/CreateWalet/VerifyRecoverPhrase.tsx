import { Page } from '@onekeyhq/components';

import useAppNavigation from '../../../../hooks/useAppNavigation';
import { EOnboardingPages } from '../../router/type';

export function VerifyRecoveryPhrase() {
  const navigation = useAppNavigation();

  const handleConfirmPress = () => {
    navigation.push(EOnboardingPages.FinalizeWalletSetup);
  };

  return (
    <Page>
      <Page.Header title="Verify your Recovery Phrase" />
      <Page.Body>123</Page.Body>
      <Page.Footer onConfirm={handleConfirmPress} />
    </Page>
  );
}
