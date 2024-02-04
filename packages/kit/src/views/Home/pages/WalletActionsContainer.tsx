import { useCallback } from 'react';

import {
  Dialog,
  Form,
  type IPageNavigationProp,
  Input,
  Stack,
  TextArea,
  useForm,
} from '@onekeyhq/components';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IToken, ITokenData } from '@onekeyhq/shared/types/token';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { NetworkSelectorTriggerLegacy } from '../../../components/AccountSelector/NetworkSelectorTrigger';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';
import { EAssetSelectorRoutes } from '../../AssetSelector/router/types';
import { EModalReceiveRoutes } from '../../Receive/router/type';
import { EModalSendRoutes } from '../../Send/router';
import { WalletActions } from '../components/WalletActions';

import type { IModalSendParamList } from '../../Send/router';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

function WalletActionsContainer({ tokens }: { tokens?: ITokenData }) {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const form = useForm();

  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num: 0 });

  const handleOnSend = useCallback(async () => {
    if (!account || !network) return;
    navigation.pushModal(EModalRoutes.AssetSelectorModal, {
      screen: EAssetSelectorRoutes.TokenSelector,
      params: {
        networkId: network.id,
        accountId: account.id,
        networkName: network.name,
        tokens,
        onSelect: async (token: IToken) => {
          await timerUtils.wait(600);
          navigation.pushModal(EModalRoutes.SendModal, {
            screen: EModalSendRoutes.SendDataInput,
            params: {
              accountId: account.id,
              networkId: network.id,
              isNFT: false,
              token,
            },
          });
        },
      },
    });
  }, [account, tokens, navigation, network]);

  const handleOnReceive = useCallback(() => {
    Dialog.confirm({
      title: 'Lighting Invoice',
      renderContent: (
        <Stack>
          <Form form={form}>
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.discover,
                sceneUrl: 'https://www.bing.com',
              }}
              enabledNum={[1]}
            >
              <NetworkSelectorTriggerLegacy key={1} num={1} />
            </AccountSelectorProviderMirror>

            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.discover,
                sceneUrl: 'https://www.bing.com',
              }}
              enabledNum={[0]}
            >
              <NetworkSelectorTriggerLegacy key={0} num={0} />
            </AccountSelectorProviderMirror>

            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.home,
              }}
              enabledNum={[1]}
            />
            <Form.Field label="Amount" name="amount" description="$0.00">
              <Input
                placeholder="Enter amount"
                size="large"
                keyboardType="number-pad"
                addOns={[
                  {
                    label: 'sats',
                  },
                ]}
              />
            </Form.Field>
            <Form.Field
              label="Description"
              description="Enter a brief description for the payment. This helps the recipient identify and record the transaction."
              name="description"
              optional
            >
              <TextArea
                size="large"
                placeholder="e.g., Coffee purchase, Invoice #12345"
              />
            </Form.Field>
          </Form>
        </Stack>
      ),
      onConfirm: async ({ close }) => {
        await close();
        navigation.pushModal(EModalRoutes.ReceiveModal, {
          screen: EModalReceiveRoutes.LightingInvoice,
        });
      },
    });
  }, [form, navigation]);
  const handleOnSwap = useCallback(() => {}, []);

  return (
    <WalletActions
      onSend={handleOnSend}
      onReceive={handleOnReceive}
      onSwap={handleOnSwap}
    />
  );
}

export { WalletActionsContainer };
