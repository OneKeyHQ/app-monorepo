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

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { EModalRoutes } from '../../../routes/Modal/type';
import { EModalSendRoutes } from '../../Send/router';
import { ETokenPages } from '../../Token/router/type';
import { WalletActions } from '../components/WalletActions';

import type { IModalSendParamList } from '../../Send/router';

function WalletActionsContainer() {
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSendParamList>>();

  const form = useForm();

  const handleOnSend = useCallback(async () => {
    // TODO: Check if it is a single token network by settings
    const isSingleTokenNetwork = false;
    const nativeToken = await backgroundApiProxy.serviceToken.getNativeToken(
      'evm--1',
    );
    if (isSingleTokenNetwork && nativeToken) {
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendDataInput,
        params: {
          networkId: 'evm--1',
          accountId: "hd-1--m/44'/60'/0'/0/0",
          isNFT: false,
          token: nativeToken,
        },
      });
    } else {
      navigation.pushModal(EModalRoutes.SendModal, {
        screen: EModalSendRoutes.SendAssetInput,
        params: {
          networkId: 'evm--1',
          accountId: "hd-1--m/44'/60'/0'/0/0",
        },
      });
    }
  }, [navigation]);

  const handleOnReceive = useCallback(() => {
    Dialog.confirm({
      title: 'Lighting Invoice',
      renderContent: (
        <Stack>
          <Form form={form}>
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
        navigation.pushModal(EModalRoutes.TokenModal, {
          screen: ETokenPages.Receive,
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
