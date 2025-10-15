import { Button, Page, YStack } from '@onekeyhq/components';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

import useAppNavigation from '../../../hooks/useAppNavigation';

export default function AddExistingWallet() {
  const navigation = useAppNavigation();
  const handleImportPhraseOrPrivateKey = () => {
    navigation.push(EOnboardingPagesV2.ImportPhraseOrPrivateKey);
  };

  const handleTransfer = () => {
    console.log('Transfer');
  };

  const handleOneKeyKeytag = () => {
    console.log('OneKey Keytag');
  };

  const handleOneKeyLite = () => {
    console.log('OneKey Lite');
  };

  return (
    <Page>
      <Page.Header title="Add Existing Wallet" />
      <Page.Body>
        <YStack>
          <Button onPress={handleImportPhraseOrPrivateKey}>
            Import Phrase or private key
          </Button>
          <Button onPress={handleTransfer}>transfer</Button>
          <Button onPress={handleOneKeyKeytag}>OneKey Keytag</Button>
          <Button onPress={handleOneKeyLite}>OneKey Lite</Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}
