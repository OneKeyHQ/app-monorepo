import { Button, Page, YStack } from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { HomeTokenListProviderMirror } from '../../Home/components/HomeTokenListProvider/HomeTokenListProviderMirror';
import { WalletActionBuy } from '../../Home/components/WalletActions/WalletActionBuy';
import { WalletActionReceive } from '../../Home/components/WalletActions/WalletActionReceive';

function ReceiveSelectorContent() {
  return (
    <Page>
      <Page.Header title="Receive Selector" />
      <Page.Body>
        <YStack>
          <WalletActionReceive
            source="receiveSelector"
            renderTrigger={({ onPress, disabled }) => (
              <Button onPress={onPress} disabled={disabled}>
                receive from exchange
              </Button>
            )}
          />
          <WalletActionBuy
            onClose={() => {}}
            source="receiveSelector"
            renderTrigger={({ onPress, disabled }) => (
              <Button onPress={onPress} disabled={disabled}>
                buy with credit card
              </Button>
            )}
          />
          <WalletActionReceive
            source="receiveSelector"
            renderTrigger={({ onPress, disabled }) => (
              <Button onPress={onPress} disabled={disabled}>
                receive from another wallet
              </Button>
            )}
          />
        </YStack>
      </Page.Body>
    </Page>
  );
}

function ReceiveSelector() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <HomeTokenListProviderMirror>
        <ReceiveSelectorContent />
      </HomeTokenListProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default ReceiveSelector;
