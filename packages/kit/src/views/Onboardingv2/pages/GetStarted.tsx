import { Button, Page, YStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EOnboardingPagesV2 } from '@onekeyhq/shared/src/routes';

export default function GetStarted() {
  const navigation = useAppNavigation();
  const handleCreateNewWallet = () => {
    console.log('Create new Wallet');
  };

  const handleAddExistingWallet = () => {
    console.log('Add existing wallet');
    navigation.push(EOnboardingPagesV2.AddExistingWallet);
  };

  const handleConnectExternalWallet = () => {
    console.log('Connect external wallet');
  };

  return (
    <Page>
      <Page.Header title="Get Started" />
      <Page.Body>
        <YStack>
          <Button onPress={handleCreateNewWallet}>Create new Wallet</Button>
          <Button onPress={handleAddExistingWallet}>Add existing wallet</Button>
          <Button onPress={handleConnectExternalWallet}>
            Connect external wallet
          </Button>
        </YStack>
      </Page.Body>
    </Page>
  );
}
