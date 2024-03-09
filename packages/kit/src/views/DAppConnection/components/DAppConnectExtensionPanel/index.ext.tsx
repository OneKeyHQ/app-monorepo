import { useCallback, useMemo } from 'react';

import { Dialog, Image, Stack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { useShouldUpdateConnectedAccount } from '../../../Discovery/hooks/useDAppNotifyChanges';
import { AccountListItem } from '../DAppAccountList';

export default function DAppConnectExtensionPanel() {
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

  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();
  const connectContent = useMemo(() => {
    console.log(
      'connectConntentMemo rerender: ',
      result?.connectedAccountsInfo,
    );
    if (!Array.isArray(result?.connectedAccountsInfo)) {
      return null;
    }
    const accountsInfo = result.connectedAccountsInfo;
    const { origin } = new URL(result.url);
    return (
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
        <YStack p="$5" space="$2">
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
                  afterUpdate: () => {
                    void run();
                  },
                });
              }}
            />
          ))}
        </YStack>
      </AccountSelectorProviderMirror>
    );
  }, [result, run, handleAccountInfoChanged]);

  const handlePressFloatingButton = useCallback(() => {
    Dialog.show({
      title: uriUtils.getHostNameFromUrl({ url: result?.url ?? '' }),
      description: 'Connected',
      showFooter: false,
      renderContent: connectContent,
    });
  }, [result, connectContent]);

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
