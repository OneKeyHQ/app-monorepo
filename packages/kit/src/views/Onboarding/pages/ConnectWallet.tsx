import { useCallback, useEffect, useState } from 'react';

import { StyleSheet } from 'react-native';

import {
  Heading,
  Image,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';

type IWalletItem = {
  name?: string;
  logo?: any;
};

type IWalletGroup = {
  title?: string;
  data: IWalletItem[];
};

const wallets: IWalletGroup[] = [
  {
    data: [
      {
        // https://explorer-api.walletconnect.com/v3/all?projectId=2f05ae7f1116030fde2d36508f472bfb&entries=40&page=1&search=metamask
        name: 'MetaMask',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_metamask.png'),
      },
      {
        name: 'Trust Wallet',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_trustwallet.png'),
      },
      {
        name: 'Rainbow',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_rainbow.png'),
      },
      {
        name: 'imToken',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_imtoken.png'),
      },
      {
        // https://explorer-api.walletconnect.com/v3/all?projectId=2f05ae7f1116030fde2d36508f472bfb&entries=40&page=1&search=okx
        name: 'OKX Wallet',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_okx.png'),
      },
      {
        name: 'TokenPocket',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_tokenpocket.png'),
      },
      {
        name: 'Zerion',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_zerion.png'),
      },
      {
        name: 'Walletconnect',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_walletconnect.png'),
      },
    ],
  },
  {
    title: 'Institutional Wallets',
    data: [
      {
        name: 'Fireblocks',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_fireblocks.png'),
      },
      {
        name: 'Amber',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_amber.png'),
      },
      {
        name: 'Cobo Wallet',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_cobo_wallet.png'),
      },
      {
        name: 'Jade Wallet',
        logo: require('@onekeyhq/kit/assets/onboarding/logo_jade.png'),
      },
    ],
  },
];

function WalletItem({ logo, name }: { name?: string; logo: any }) {
  const [loading, setLoading] = useState(false);
  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const { selectedAccount } = useSelectedAccount({ num: 0 });

  useEffect(() => {
    if (!loading) {
      return;
    }
    const fn = (state: { open: boolean }) => {
      if (state.open === false) {
        setLoading(false);
      }
    };
    appEventBus.on(EAppEventBusNames.WalletConnectModalState, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletConnectModalState, fn);
    };
  }, [loading]);

  const connectToWallet = useCallback(async () => {
    try {
      console.log('WalletItem onPress');
      if (loading) {
        return;
      }

      setLoading(true);

      const session =
        await backgroundApiProxy.serviceWalletConnect.connectToWallet();
      console.log('connected', session?.namespaces);
      if (!session) {
        setLoading(false);
        return;
      }
      const r = await backgroundApiProxy.serviceAccount.addExternalAccount({
        wcSession: session,
      });
      const account = r.accounts[0];
      const usedNetworkId = accountUtils.getAccountCompatibleNetwork({
        account,
        networkId: selectedAccount.networkId,
      });
      await actions.current.updateSelectedAccount({
        num: 0,
        builder: (v) => ({
          ...v,
          networkId: usedNetworkId,
          focusedWallet: '$$others',
          walletId: WALLET_TYPE_EXTERNAL,
          othersWalletAccountId: account.id,
          indexedAccountId: undefined,
        }),
      });
      navigation.popStack();
    } finally {
      setLoading(false);
    }
  }, [actions, loading, navigation, selectedAccount.networkId]);

  return (
    <Stack
      flexBasis="50%"
      $gtMd={{
        flexBasis: '25%',
      }}
      p="$1"
    >
      <Stack
        justifyContent="center"
        alignItems="center"
        bg="$bgSubdued"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        borderRadius="$3"
        borderCurve="continuous"
        p="$4"
        hoverStyle={{
          bg: '$bgHover',
        }}
        pressStyle={{
          bg: '$bgActive',
        }}
        onPress={connectToWallet}
        focusable
        focusStyle={{
          outlineColor: '$focusRing',
          outlineStyle: 'solid',
          outlineWidth: 2,
          outlineOffset: 2,
        }}
      >
        <Stack
          w="$8"
          h="$8"
          borderRadius="$2"
          borderWidth={StyleSheet.hairlineWidth}
          borderColor="$borderSubdued"
          borderCurve="continuous"
          overflow="hidden"
        >
          <Image w="100%" h="100%" source={logo} />
        </Stack>
        <XStack alignItems="center">
          {loading ? <Spinner size="small" /> : null}

          <SizableText userSelect="none" mt="$2" size="$bodyMdMedium">
            {name}
          </SizableText>
        </XStack>
      </Stack>
    </Stack>
  );
}

export function ConnectWallet() {
  return (
    <Page scrollEnabled>
      <Page.Header title="Connect 3rd-party Wallet" />
      <Page.Body>
        {wallets.map(({ title, data }, index) => (
          <Stack key={index} p="$5">
            {title ? (
              <Heading pb="$2.5" color="$textSubdued" size="$headingSm">
                {title}
              </Heading>
            ) : null}
            <XStack flexWrap="wrap" mx="$-1">
              {data.map(({ name, logo }, i) => (
                <WalletItem name={name} logo={logo} key={i} />
              ))}
            </XStack>
          </Stack>
        ))}
      </Page.Body>
    </Page>
  );
}

function ConnectWalletPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
      }}
      enabledNum={[0]}
    >
      <ConnectWallet />
    </AccountSelectorProviderMirror>
  );
}

export default ConnectWalletPage;
