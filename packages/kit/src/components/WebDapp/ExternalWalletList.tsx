import { StyleSheet } from 'react-native';

import {
  Image,
  SizableText,
  Spinner,
  Stack,
  XStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import { openUrlExternal } from '@onekeyhq/shared/src/utils/openUrlUtils';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useWalletConnection } from '../../hooks/useWebDapp/useWalletConnection';

import { useFallbackWallets } from './hooks/useFallbackWallets';

const walletConnectInfo = externalWalletLogoUtils.getLogoInfo('walletconnect');

function WalletItemView({
  onPress,
  logo,
  name,
  loading,
  networkType,
}: {
  onPress: () => void;
  logo: any;
  name: string;
  loading?: boolean;
  networkType?: string;
}) {
  return (
    <Stack flexBasis="50%" p="$1.5">
      <Stack
        borderRadius="$3"
        borderWidth={StyleSheet.hairlineWidth}
        borderColor="$borderSubdued"
        py="$3"
        px="$5"
        cursor="pointer"
        hoverStyle={{
          bg: '$bgStrong',
        }}
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
        minHeight={70}
      >
        <XStack alignItems="center" gap="$3" flex={1}>
          <Stack
            w="$10"
            h="$10"
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
          <Stack flex={1} justifyContent="center">
            <SizableText userSelect="none" size="$bodyLgMedium">
              {name}
            </SizableText>
            {networkType ? (
              <SizableText size="$bodyMd" color="$textSubdued">
                {networkType}
              </SizableText>
            ) : null}
          </Stack>
        </XStack>
      </Stack>
    </Stack>
  );
}

function WalletItem({
  logo,
  name,
  connectionInfo,
  networkType,
}: {
  name?: string;
  logo: any;
  connectionInfo: IExternalConnectionInfo;
  networkType?: string;
}) {
  const { loading, connectToWalletWithDialogShow } = useWalletConnection({
    name,
    connectionInfo,
  });

  return (
    <WalletItemView
      onPress={connectToWalletWithDialogShow}
      logo={logo}
      name={name || 'unknown'}
      loading={loading}
      networkType={networkType}
    />
  );
}

// Reusable WalletConnect component
function WalletConnectItem({ impl }: { impl?: string }) {
  return (
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
  );
}

function ExternalWalletList({ impl }: { impl?: string }) {
  // detect available wallets
  const { result: allWallets = { wallets: {} } } = usePromiseResult(
    () =>
      backgroundApiProxy.serviceDappSide.listAllWallets({
        impls: impl ? [impl] : [],
      }),
    [impl],
  );

  const detectedWallets =
    allWallets?.wallets?.[impl || '--']?.filter?.((item) => {
      // filter out injected wallets
      if (item.connectionInfo?.evmInjected) {
        return false;
      }
      // filter out OneKey wallets (already shown in the first tab)
      if (item.name?.toLowerCase().includes('onekey')) {
        return false;
      }
      return true;
    }) ?? [];

  const networkLabel = impl === 'sol' ? 'SOL' : 'EVM';

  const detectedFallbackKeys = new Set<string>();
  const fallbackWallets = useFallbackWallets();

  const walletItems = detectedWallets.map((item, index) => {
    const { name, icon, connectionInfo } = item;
    const loweredName = name?.toLowerCase() || '';

    fallbackWallets.forEach(({ key, detectKeywords }) => {
      if (detectKeywords.some((keyword) => loweredName.includes(keyword))) {
        detectedFallbackKeys.add(key);
      }
    });

    return (
      <WalletItem
        key={`wallet-${index}`}
        logo={icon}
        name={name || 'unknown'}
        connectionInfo={connectionInfo}
        networkType={networkLabel}
      />
    );
  });

  const fallbackWalletItems = fallbackWallets
    .filter(({ key }) => !detectedFallbackKeys.has(key))
    .map(({ key, storeUrl, logo, name, networkType }) => (
      <WalletItemView
        key={`wallet-${key}-store`}
        onPress={() => {
          void openUrlExternal(storeUrl);
        }}
        logo={logo}
        name={name}
        networkType={networkType}
      />
    ));

  return (
    <Stack px="$5" py="$4">
      <XStack flexWrap="wrap" mx="$-1.5">
        {/* detected wallets - filter out injected wallets and OneKey wallets */}
        {walletItems}
        {fallbackWalletItems}

        {/* WalletConnect - put at the end */}
        <WalletConnectItem impl={impl} />
      </XStack>
    </Stack>
  );
}

// WalletConnect ListItem component for use in OneKeyWalletConnectionOptions
function WalletConnectListItemComponent({
  impl,
  ...listItemProps
}: {
  impl?: string;
} & React.ComponentProps<typeof ListItem>) {
  const connectionInfo: IExternalConnectionInfo = {
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
  };

  const { loading, connectToWalletWithDialogShow } = useWalletConnection({
    name: walletConnectInfo.name,
    connectionInfo,
  });

  return (
    <ListItem
      {...listItemProps}
      title={walletConnectInfo.name}
      renderAvatar={
        <Image
          w="$10"
          h="$10"
          source={walletConnectInfo.logo}
          borderRadius="$3"
        />
      }
      drillIn={!loading}
      onPress={connectToWalletWithDialogShow}
      isLoading={loading}
    />
  );
}

export {
  ExternalWalletList,
  WalletConnectItem,
  WalletConnectListItemComponent,
};
