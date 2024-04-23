import { useCallback, useRef } from 'react';

import { Button, Dialog, Page, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';

const SignMessageButton = () => {
  const ref = useRef<number>(0);
  const onPress = useCallback(async () => {
    Dialog.show({
      title: 'Sign Message',
      description: 'Function used to simulate sign Message',
      confirmButtonProps: {
        variant: 'destructive',
      },
      onConfirm: () => {
        ref.current += 1;
        void backgroundApiProxy.serviceSignature.addSignedMessage({
          networkId: 'evm--1',
          address: '0xec766119A2021956773F16Cf77A3B248FF79b1c7',
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
      title: 'Sign Message',
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
            type: 'send',
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
          title: 'Uniswap',
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

const DevHomeStack2 = () => (
  <Page>
    <YStack px="$4" space="$4">
      <SignMessageButton />
      <SignTransactionButton />
      <ConnectSiteButton />
    </YStack>
  </Page>
);

export default DevHomeStack2;
