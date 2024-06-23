import { useCallback, useRef, useState } from 'react';

import { Button, Dialog, Input, Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { EMessageTypesEth } from '@onekeyhq/shared/types/message';
import { ETransactionType } from '@onekeyhq/shared/types/signatureRecord';

import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';

const SignMessageButton = () => {
  const ref = useRef<number>(0);
  const onPress = useCallback(async () => {
    Dialog.show({
      title: 'Sign Message',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: () => {
        ref.current += 1;
        void backgroundApiProxy.serviceSignature.addSignedMessage({
          networkId: 'evm--1',
          address: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
          message: 'hello world',
          contentType: 'text',
          title: `Sign Message Test ${ref.current}`,
        });
      },
    });
  }, []);
  return <Button onPress={onPress}>Sign Message</Button>;
};

const SignTransactionButton = () => {
  const ref = useRef<number>(0);
  const onPress = useCallback(async () => {
    Dialog.show({
      title: 'Sign Transaction',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: () => {
        ref.current += 1;
        void backgroundApiProxy.serviceSignature.addSignedTransaction({
          networkId: 'evm--1',
          title: `OneKey Wallet ${ref.current}`,
          hash: '0x866c4749db18695e4359f4e3f121a835d7715638315427e5521bcd078724d0d1',
          address: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
          data: {
            type: ETransactionType.SEND,
            amount: '100000',
            token: {
              name: 'USD Coin',
              symbol: 'USDC',
              address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            },
          },
        });
      },
    });
  }, []);
  return <Button onPress={onPress}>Sign Transaction</Button>;
};

const ConnectSiteButton = () => {
  const onPress = useCallback(async () => {
    Dialog.show({
      title: 'Connect Site',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: () => {
        void backgroundApiProxy.serviceSignature.addConnectedSite({
          url: 'https://app.uniswap.org/swap',
          items: [
            {
              networkId: 'evm--1',
              address: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
            },
            {
              networkId: 'evm--56',
              address: '0x76f3f64cb3cD19debEE51436dF630a342B736C24',
            },
          ],
        });
      },
    });
  }, []);
  return <Button onPress={onPress}>Connected Site</Button>;
};

const CustomSignMessage = ({ num }: { num: number }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    activeAccount: { account, network },
  } = useActiveAccount({ num });
  const onPress = useCallback(async () => {
    if (account && network) {
      try {
        setLoading(true);
        await backgroundApiProxy.serviceDApp.openSignMessageModal({
          accountId: account.id,
          networkId: network.id,
          request: { origin: 'https://www.onekey.so', scope: 'ethereum' },
          unsignedMessage: {
            type: EMessageTypesEth.PERSONAL_SIGN,
            message,
          },
        });
      } finally {
        setLoading(false);
      }
    }
  }, [message, account, network]);
  return (
    <YStack space="$4">
      <Input value={message} onChangeText={setMessage} placeholder="message" />
      <Button onPress={onPress} loading={loading} disabled={!message.trim()}>
        Sign Message
      </Button>
    </YStack>
  );
};

const DevHomeStack2 = () => {
  const num = 1;
  return (
    <Page>
      <YStack px="$4" space="$4">
        <SignMessageButton />
        <SignTransactionButton />
        <ConnectSiteButton />
        <AccountSelectorProviderMirror
          config={{
            sceneName: EAccountSelectorSceneName.home,
            sceneUrl: '',
          }}
          enabledNum={[num]}
        >
          <CustomSignMessage num={num} />
        </AccountSelectorProviderMirror>
      </YStack>
    </Page>
  );
};

export default DevHomeStack2;
