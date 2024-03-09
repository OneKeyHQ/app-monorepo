import { useCallback } from 'react';

import {
  Button,
  Dialog,
  Divider,
  Image,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { useShouldUpdateConnectedAccount } from '../../../Discovery/hooks/useDAppNotifyChanges';
import { EDAppConnectionModal } from '../../router/type';
import { AccountListItem } from '../DAppAccountList';

function ExtensionConnectPanel({
  url,
  accountsInfo,
  afterChangeAccount,
  closeDialog,
}: {
  url: string;
  accountsInfo: IConnectionAccountInfoWithNum[] | null | undefined;
  afterChangeAccount: () => void;
  closeDialog: () => void;
}) {
  const { origin } = new URL(url);
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();
  const navigation = useAppNavigation();
  const onPressManageConnection = useCallback(() => {
    closeDialog();
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.ConnectionList,
    });
  }, [navigation, closeDialog]);

  const onDisconnect = useCallback(async () => {
    if (accountsInfo?.[0].storageType) {
      await backgroundApiProxy.serviceDApp.disconnectWebsite({
        origin,
        storageType: accountsInfo?.[0].storageType,
      });
      afterChangeAccount();
      closeDialog();
    }
  }, [origin, accountsInfo, afterChangeAccount, closeDialog]);

  if (!Array.isArray(accountsInfo)) {
    return null;
  }
  return (
    <>
      <AccountSelectorProviderMirror
        config={{
          sceneName: EAccountSelectorSceneName.discover,
          sceneUrl: origin,
        }}
        enabledNum={accountsInfo.map((account) => account.num)}
        availableNetworksMap={accountsInfo.reduce((acc, account) => {
          if (Array.isArray(account.availableNetworkIds)) {
            acc[account.num] = { networkIds: account.availableNetworkIds };
          }
          return acc;
        }, {} as Record<number, { networkIds: string[] }>)}
      >
        <YStack space="$2">
          {accountsInfo.map((account) => (
            <AccountListItem
              key={account.num}
              num={account.num}
              compressionUiMode
              handleAccountChanged={async (accountChangedParams) => {
                await handleAccountInfoChanged({
                  origin,
                  accountSelectorNum: account.num,
                  prevAccountInfo: account,
                  accountChangedParams,
                  storageType: account.storageType,
                  afterUpdate: afterChangeAccount,
                });
              }}
            />
          ))}
        </YStack>
      </AccountSelectorProviderMirror>
      <Divider mx="$-5" mt="$5" />
      <Stack bg="$bgSubdued" py="$3" space="$2" mx="$-5" mb="$-5">
        <Button
          variant="tertiary"
          size="large"
          justifyContent="flex-start"
          px="$5"
          onPress={onPressManageConnection}
        >
          Manage dApp Connections
        </Button>
        <Button variant="tertiary" justifyContent="flex-start" px="$5">
          Default Wallet Settings
        </Button>
        <Divider my="$2" />
        <Button
          variant="tertiary"
          justifyContent="flex-start"
          px="$5"
          onPress={onDisconnect}
        >
          Disconnect
        </Button>
      </Stack>
    </>
  );
}

export default function DAppConnectExtensionFloatingTrigger() {
  const { result, run } = usePromiseResult(
    () =>
      new Promise<{
        url: string;
        showFloatingButton: boolean;
        connectedAccountsInfo: IConnectionAccountInfoWithNum[] | null;
        faviconUrl: string | undefined;
      } | null>((resolve) => {
        chrome.tabs.query(
          { active: true, currentWindow: true },
          async (tabs) => {
            if (tabs[0]) {
              try {
                const currentOrigin = new URL(tabs[0]?.url ?? '').origin;
                const connectedAccountsInfo =
                  await backgroundApiProxy.serviceDApp.getAllConnectedAccountsByOrigin(
                    currentOrigin,
                  );
                resolve({
                  url: tabs[0].url ?? '',
                  showFloatingButton: (connectedAccountsInfo ?? []).length > 0,
                  connectedAccountsInfo,
                  faviconUrl: tabs[0].favIconUrl,
                });
                return;
              } catch (error) {
                console.error('DappConnectExtensionPanel error:', error);
                resolve(null);
                return;
              }
            }
            resolve(null);
          },
        );
      }),
    [],
  );

  const handlePressFloatingButton = useCallback(() => {
    const dialog = Dialog.show({
      title: uriUtils.getHostNameFromUrl({ url: result?.url ?? '' }),
      description: 'Connected',
      showFooter: false,
      renderContent: (
        <ExtensionConnectPanel
          url={result?.url ?? ''}
          accountsInfo={result?.connectedAccountsInfo}
          afterChangeAccount={() => run()}
          closeDialog={() => dialog.close()}
        />
      ),
    });
  }, [result, run]);

  if (!result?.showFloatingButton) {
    return null;
  }

  return (
    <Stack
      position="absolute"
      bottom="$2"
      right="$2"
      h="$14"
      w="$14"
      space="$2"
      alignItems="center"
      justifyContent="center"
      bg="$bgApp"
      borderRadius="$3"
      shadowOffset={{
        width: 0,
        height: 12,
      }}
      shadowRadius={24}
      shadowColor="rgba(0, 0, 0, 0.09)"
      onPress={handlePressFloatingButton}
    >
      <Image
        size="$10"
        borderRadius="$2"
        source={{
          uri: result?.faviconUrl,
        }}
      />
    </Stack>
  );
}
