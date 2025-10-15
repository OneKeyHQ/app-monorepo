import { Page, SizableText } from '@onekeyhq/components';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

export default function ImportPhraseOrPrivateKey() {
  const navigation = useAppNavigation();
  const handleConfirm = () => {
    navigation.push(EOnboardingPagesV2.FinalizeWalletSetup);
  };
  return (
    <Page>
      <Page.Header title="Import Phrase or private key" />
      <Page.Body>
        <SizableText>Import Phrase or private key</SizableText>
      </Page.Body>
      <Page.Footer onConfirm={handleConfirm} />
    </Page>
  );
}
