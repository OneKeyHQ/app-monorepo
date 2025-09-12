import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Heading,
  Image,
  Page,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EOnboardingPages,
  IOnboardingParamList,
} from '@onekeyhq/shared/src/routes';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '../../../components/AccountSelector';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { useWalletConnection } from '../../../hooks/useWebDapp/useWalletConnection';

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
        focusVisibleStyle={{
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

function WalletItem({
  logo,
  name,
  connectionInfo,
}: {
  name?: string;
  logo: any;
  connectionInfo: IExternalConnectionInfo;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { connectToWalletWithDialogShow, universalLoading, localLoading } =
    useWalletConnection({
      name,
      connectionInfo,
    });

  return (
    <WalletItemView
      onPress={connectToWalletWithDialogShow}
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
