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
import type { IDBExternalConnectionInfo } from '@onekeyhq/kit-bg/src/dbs/local/types';
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
import { usePromiseResult } from '../../../hooks/usePromiseResult';
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

function WalletItemViewSection({
  title,
  children,
}: {
  title: string | undefined;
  children: React.ReactNode;
}) {
  return (
    <Stack p="$5">
      {title ? (
        <Heading pb="$2.5" color="$textSubdued" size="$headingSm">
          {title}
        </Heading>
      ) : null}
      <XStack flexWrap="wrap" mx="$-1">
        {children}
      </XStack>
    </Stack>
  );
}

function WalletItemView({
  onPress,
  logo,
  name,
  loading,
}: {
  onPress: () => void;
  logo: any;
  name: string;
  loading: boolean;
}) {
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
        onPress={onPress}
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

function WalletItem({
  logo,
  name,
  connection,
}: {
  name?: string;
  logo: any;
  connection: IDBExternalConnectionInfo;
}) {
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
    const { evmEIP6963, evmInjected, walletConnect } = connection;
    try {
      console.log('WalletItem onPress');
      if (loading) {
        return;
      }

      setLoading(true);
      const connectResult =
        await backgroundApiProxy.serviceDappSide.connectExternalWallet({
          connection,
        });

      const r = await backgroundApiProxy.serviceAccount.addExternalAccount({
        connectResult,
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
    <WalletItemView
      onPress={connectToWallet}
      loading={loading}
      logo={logo}
      name={name || 'unknown'}
    />
  );
}

export function ConnectWallet() {
  const { result: evmWalletsEIP6963 = { wallets: [] } } = usePromiseResult(
    () => backgroundApiProxy.serviceDappSide.listAllEvmWallets(),
    [],
  );
  return (
    <Page scrollEnabled>
      <Page.Header title="Connect 3rd-party Wallet" />
      <Page.Body>
        <WalletItemViewSection title="EVM-EIP6963 (injected)">
          <WalletItem
            name="EVM-Injected"
            logo={require('@onekeyhq/kit/assets/onboarding/logo_metamask.png')}
            connection={{
              evmInjected: {
                global: 'ethereum',
                // TODO use a general injected wallet icon like https://pancakeswap.finance/
                icon: require('@onekeyhq/kit/assets/onboarding/logo_metamask.png'),
              },
            }}
          />
          {/* EVM EIP6963 auto discovery wallets */}
          {evmWalletsEIP6963?.wallets?.map((item, index) => {
            const { name, icon, rdns } = item.info;
            return (
              <WalletItem
                key={rdns}
                logo={icon}
                name={name || 'unknown'}
                connection={{
                  evmEIP6963: {
                    info: item.info,
                  },
                }}
              />
            );
          })}
        </WalletItemViewSection>

        {/* WalletConnect Wallets */}
        {wallets.map(({ title, data }, index) => (
          <WalletItemViewSection key={index} title={title}>
            {data.map(({ name, logo }, i) => (
              <WalletItem
                name={name}
                logo={logo}
                key={i}
                connection={{
                  walletConnect: true as any, // use boolean to indicate walletConnect connection
                }}
              />
            ))}
          </WalletItemViewSection>
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
