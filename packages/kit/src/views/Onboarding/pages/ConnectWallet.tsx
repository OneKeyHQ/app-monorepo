import { useCallback, useEffect, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IButtonProps, IDialogInstance } from '@onekeyhq/components';
import {
  Button,
  Dialog,
  Heading,
  Icon,
  Image,
  Page,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { useOnboardingConnectWalletLoadingAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { WALLET_TYPE_EXTERNAL } from '@onekeyhq/shared/src/consts/dbConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  useAccountSelectorActions,
  useSelectedAccount,
} from '../../../states/jotai/contexts/accountSelector';

import type { RouteProp } from '@react-navigation/core';

type IWalletItem = {
  name?: string;
  logo?: any;
};

type IWalletGroup = {
  title?: string;
  data: IWalletItem[];
};

const walletConnectInfo = externalWalletLogoUtils.getLogoInfo('walletconnect');
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const wallets: IWalletGroup[] = [
  {
    title: 'WalletConnect Wallets',
    data: [
      externalWalletLogoUtils.getLogoInfo('metamask'),
      externalWalletLogoUtils.getLogoInfo('trustwallet'),
      externalWalletLogoUtils.getLogoInfo('rainbow'),
      externalWalletLogoUtils.getLogoInfo('imtoken'),
      externalWalletLogoUtils.getLogoInfo('okx'),
      externalWalletLogoUtils.getLogoInfo('tokenpocket'),
      externalWalletLogoUtils.getLogoInfo('zerion'),
      walletConnectInfo,
    ],
  },
  {
    title: 'Institutional Wallets',
    data: [
      externalWalletLogoUtils.getLogoInfo('fireblocks'),
      externalWalletLogoUtils.getLogoInfo('amber'),
      externalWalletLogoUtils.getLogoInfo('cobowallet'),
      externalWalletLogoUtils.getLogoInfo('jadewallet'),
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
  loading?: boolean;
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
        bg="$bgStrong"
        borderRadius="$3"
        borderCurve="continuous"
        p="$4"
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
          alignItems="center"
          justifyContent="center"
          borderRadius="$2"
          borderCurve="continuous"
          overflow="hidden"
        >
          {!loading ? (
            <Image w="100%" h="100%" source={logo} />
          ) : (
            <Spinner size="small" />
          )}
        </Stack>
        <XStack alignItems="center">
          <SizableText userSelect="none" mt="$2" size="$bodyMdMedium">
            {name}
          </SizableText>
        </XStack>
      </Stack>
    </Stack>
  );
}

function ConnectToWalletDialogContent({
  onRetryPress,
}: {
  onRetryPress: () => void;
}) {
  const [loading] = useOnboardingConnectWalletLoadingAtom();
  const intl = useIntl();

  return (
    <Stack>
      <Stack
        justifyContent="center"
        alignItems="center"
        p="$5"
        bg="$bgStrong"
        borderRadius="$3"
        borderCurve="continuous"
      >
        {loading ? (
          <Spinner size="large" />
        ) : (
          <Icon size="$9" name="BrokenLink2Outline" />
        )}

        <SizableText textAlign="center" pt="$4">
          {loading
            ? intl.formatMessage({
                id: ETranslations.global_connect_to_wallet_confirm_to_proceed,
              })
            : intl.formatMessage({
                id: ETranslations.global_connect_to_wallet_no_confirmation,
              })}
        </SizableText>
      </Stack>
      {loading ? null : (
        <Button
          mt="$5"
          variant="primary"
          size="large"
          $gtMd={
            {
              size: 'medium',
            } as IButtonProps
          }
          onPress={onRetryPress}
        >
          {intl.formatMessage({ id: ETranslations.global_retry })}
        </Button>
      )}
    </Stack>
  );
}

function WalletItem({
  logo,
  name,
  connectionInfo,
}: {
  name?: string;
  logo: any;
  connectionInfo: IExternalConnectionInfo;
}) {
  const [jotaiLoading, setJotaiLoading] =
    useOnboardingConnectWalletLoadingAtom();
  const [localLoading, setLocalLoading] = useState(false);
  const intl = useIntl();

  const loading = jotaiLoading || localLoading;
  const setLoading = useCallback(
    (v: boolean) => {
      setJotaiLoading(v);
      setLocalLoading(v);
    },
    [setJotaiLoading],
  );

  const navigation = useAppNavigation();
  const actions = useAccountSelectorActions();
  const { selectedAccount } = useSelectedAccount({ num: 0 });
  const dialogRef = useRef<IDialogInstance | null>(null);
  const setLoadingRef = useRef(setLoading);
  setLoadingRef.current = setLoading;
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  const hideLoadingTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const hideLoading = useCallback(() => {
    clearTimeout(hideLoadingTimer.current);
    // delay hide loading to avoid connectToWallet mistake checking if Dialog is closed
    hideLoadingTimer.current = setTimeout(() => {
      setLoading(false);
    }, 600);
  }, [setLoading]);

  const showLoading = useCallback(() => {
    clearTimeout(hideLoadingTimer.current);
    setLoading(true);
  }, [setLoading]);

  useEffect(() => {
    if (!loading) {
      return;
    }
    const fn = (state: { open: boolean }) => {
      if (state.open === false && loadingRef.current) {
        hideLoading();
      }
    };
    appEventBus.on(EAppEventBusNames.WalletConnectModalState, fn);
    return () => {
      appEventBus.off(EAppEventBusNames.WalletConnectModalState, fn);
    };
  }, [hideLoading, loading]);

  const connectToWallet = useCallback(async () => {
    try {
      showLoading();
      const connectResult =
        await backgroundApiProxy.serviceDappSide.connectExternalWallet({
          connectionInfo,
        });
      if (!loadingRef.current) {
        Toast.error({
          title: intl.formatMessage({
            id: ETranslations.feedback_connection_request_denied,
          }),
        });
        return;
      }
      const r = await backgroundApiProxy.serviceAccount.addExternalAccount({
        connectResult,
      });
      const account = r?.accounts?.[0];
      const usedNetworkId = accountUtils.getAccountCompatibleNetwork({
        account,
        networkId: account.createAtNetwork || selectedAccount.networkId,
      });
      await actions.current.updateSelectedAccountForSingletonAccount({
        num: 0,
        networkId: usedNetworkId,
        walletId: WALLET_TYPE_EXTERNAL,
        othersWalletAccountId: account.id,
      });
      navigation.popStack();
      await dialogRef.current?.close();
    } finally {
      hideLoading();
    }
  }, [
    actions,
    connectionInfo,
    hideLoading,
    intl,
    navigation,
    selectedAccount.networkId,
    showLoading,
  ]);

  const connectToWalletWithDialog = useCallback(async () => {
    console.log('WalletItem onPress');
    if (loading || loadingRef.current) {
      return;
    }
    await dialogRef.current?.close();
    dialogRef.current = Dialog.show({
      // title: `Connect to ${name || 'Wallet'}`,
      title: intl.formatMessage(
        { id: ETranslations.global_connect_to_wallet },
        {
          wallet: name || 'Wallet',
        },
      ),
      showFooter: false,
      dismissOnOverlayPress: false,
      onClose() {
        setLoadingRef.current?.(false);
      },
      renderContent: (
        <ConnectToWalletDialogContent onRetryPress={connectToWallet} />
      ),
    });
    await connectToWallet();
  }, [connectToWallet, intl, loading, name]);

  return (
    <WalletItemView
      onPress={connectToWalletWithDialog}
      logo={logo}
      name={name || 'unknown'}
      loading={localLoading}
    />
  );
}

export function useConnectWalletRoute() {
  const route =
    useRoute<RouteProp<IOnboardingParamList, EOnboardingPages.ConnectWallet>>();
  return { route };
}

export function ConnectWallet() {
  const { route } = useConnectWalletRoute();
  const { impl, title: pageTitle } = route.params || {};
  const { result: allWallets = { wallets: {} } } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceDappSide.listAllWallets({
        impls: impl ? [impl] : [],
      }),
    [impl],
  );
  const intl = useIntl();

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_select_wallet })}
      />
      <Page.Body>
        <WalletItemViewSection title={pageTitle}>
          <WalletItem
            name={walletConnectInfo.name}
            logo={walletConnectInfo.logo}
            connectionInfo={{
              walletConnect: {
                impl,
                isNewConnection: true,
                topic: '',
                peerMeta: {
                  name: '',
                  icons: [],
                  description: '',
                  url: '',
                },
              },
            }}
          />
          {allWallets?.wallets?.[impl || '--']?.map?.((item, index) => {
            const { name, icon, connectionInfo } = item;
            return (
              <WalletItem
                key={index}
                logo={icon}
                name={name || 'unknown'}
                connectionInfo={connectionInfo}
              />
            );
          })}
        </WalletItemViewSection>

        {/* All WalletConnect Wallets */}
        {/* {wallets.map(({ title, data }, index) => (
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
        ))} */}
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
