import { useCallback, useRef, useState } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import type { IDialogInstance } from '@onekeyhq/components';
import {
  Dialog,
  Icon,
  Image,
  SizableText,
  Spinner,
  Stack,
  Toast,
  XStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import externalWalletLogoUtils from '@onekeyhq/shared/src/utils/externalWalletLogoUtils';
import type { IExternalConnectionInfo } from '@onekeyhq/shared/types/externalWallet.types';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useConnectExternalWallet } from '../../hooks/useWebDapp/useConnectExternalWallet';

const walletConnectInfo = externalWalletLogoUtils.getLogoInfo('walletconnect');

function ConnectToWalletDialogContent({ loading }: { loading: boolean }) {
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
    </Stack>
  );
}

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
  const intl = useIntl();
  const { connectToWalletWithDialog } = useConnectExternalWallet();
  const [localLoading, setLocalLoading] = useState(false);
  const dialogRef = useRef<IDialogInstance | null>(null);

  const connectToWallet = useCallback(async () => {
    try {
      setLocalLoading(true);
      await connectToWalletWithDialog(connectionInfo);
      await dialogRef.current?.close();
    } catch (error) {
      console.error('Connect wallet error:', error);
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_connection_failed,
        }),
      });
    } finally {
      setLocalLoading(false);
    }
  }, [connectToWalletWithDialog, connectionInfo, intl]);

  const connectToWalletWithDialogShow = useCallback(async () => {
    if (localLoading) {
      return;
    }
    await dialogRef.current?.close();
    dialogRef.current = Dialog.show({
      title: intl.formatMessage(
        { id: ETranslations.global_connect_to_wallet },
        {
          wallet: name || 'Wallet',
        },
      ),
      showFooter: false,
      dismissOnOverlayPress: false,
      onClose() {
        setLocalLoading(false);
      },
      renderContent: <ConnectToWalletDialogContent loading={localLoading} />,
    });
    await connectToWallet();
  }, [connectToWallet, intl, localLoading, name]);

  return (
    <WalletItemView
      onPress={connectToWalletWithDialogShow}
      logo={logo}
      name={name || 'unknown'}
      loading={localLoading}
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

  return (
    <Stack px="$5" py="$4">
      <XStack flexWrap="wrap" mx="$-1.5">
        {/* detected wallets - filter out injected wallets and OneKey wallets */}
        {allWallets?.wallets?.[impl || '--']
          ?.filter?.((item) => {
            // filter out injected wallets
            if (item.connectionInfo?.evmInjected) {
              return false;
            }
            // filter out OneKey wallets (already shown in the first tab)
            if (item.name?.toLowerCase().includes('onekey')) {
              return false;
            }
            return true;
          })
          ?.map?.((item, index) => {
            const { name, icon, connectionInfo } = item;
            return (
              <WalletItem
                key={index}
                logo={icon}
                name={name || 'unknown'}
                connectionInfo={connectionInfo}
                networkType={impl === 'sol' ? 'SOL' : 'EVM'}
              />
            );
          })}

        {/* WalletConnect - put at the end */}
        <WalletConnectItem impl={impl} />
      </XStack>
    </Stack>
  );
}

// Reusable WalletConnect component for ListItem style (used in OneKeyWalletConnectionOptions)
function WalletConnectListItem({ impl }: { impl?: string }) {
  const intl = useIntl();
  const { connectToWalletWithDialog } = useConnectExternalWallet();
  const [localLoading, setLocalLoading] = useState(false);
  const dialogRef = useRef<IDialogInstance | null>(null);

  const connectToWallet = useCallback(async () => {
    try {
      setLocalLoading(true);
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
      await connectToWalletWithDialog(connectionInfo);
      await dialogRef.current?.close();
    } catch (error) {
      console.error('Connect wallet error:', error);
      Toast.error({
        title: intl.formatMessage({
          id: ETranslations.global_connection_failed,
        }),
      });
    } finally {
      setLocalLoading(false);
    }
  }, [connectToWalletWithDialog, impl, intl]);

  const connectToWalletWithDialogShow = useCallback(async () => {
    if (localLoading) {
      return;
    }
    await dialogRef.current?.close();
    dialogRef.current = Dialog.show({
      title: intl.formatMessage(
        { id: ETranslations.global_connect_to_wallet },
        {
          wallet: walletConnectInfo.name || 'Wallet',
        },
      ),
      showFooter: false,
      dismissOnOverlayPress: false,
      onClose() {
        setLocalLoading(false);
      },
      renderContent: <ConnectToWalletDialogContent loading={localLoading} />,
    });
    await connectToWallet();
  }, [connectToWallet, intl, localLoading]);

  return {
    name: walletConnectInfo.name,
    logo: walletConnectInfo.logo,
    onPress: connectToWalletWithDialogShow,
    loading: localLoading,
  };
}

export { ExternalWalletList, WalletConnectItem, WalletConnectListItem };
