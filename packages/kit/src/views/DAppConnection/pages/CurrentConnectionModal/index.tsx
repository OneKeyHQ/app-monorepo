import { useCallback } from 'react';

import { useRoute } from '@react-navigation/core';
import { isNil } from 'lodash';

import {
  Divider,
  Page,
  SizableText,
  Stack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import { useShouldUpdateConnectedAccount } from '../../../Discovery/hooks/useDAppNotifyChanges';
import { AccountListItem } from '../../components/DAppAccountList';
import { EDAppConnectionModal } from '../../router/type';

import type { IDAppConnectionModalParamList } from '../../router';
import type { RouteProp } from '@react-navigation/core';

function CurrentConnectionModal() {
  const navigation = useAppNavigation();
  const route =
    useRoute<
      RouteProp<
        IDAppConnectionModalParamList,
        EDAppConnectionModal.CurrentConnectionModal
      >
    >();
  const { faviconUrl, origin } = route.params;
  const { result: accountsInfo, run } = usePromiseResult(async () => {
    if (!origin) return [];
    const connectedAccountsInfo =
      await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(origin);
    if (!connectedAccountsInfo) return [];
    return connectedAccountsInfo;
  }, [origin]);
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();

  const onPressManageConnection = useCallback(() => {
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.ConnectionList,
    });
  }, [navigation]);

  const onDisconnect = useCallback(async () => {
    if (accountsInfo?.[0].storageType) {
      await backgroundApiProxy.serviceDApp.disconnectWebsite({
        origin,
        storageType: accountsInfo?.[0].storageType,
      });
      navigation.pop();
    }
  }, [origin, accountsInfo, navigation]);

  return (
    <Page>
      <Page.Header title="Connect" />
      <Page.Body>
        <>
          {isNil(accountsInfo) || !Array.isArray(accountsInfo) ? null : (
            <AccountSelectorProviderMirror
              config={{
                sceneName: EAccountSelectorSceneName.discover,
                sceneUrl: origin,
              }}
              enabledNum={accountsInfo.map((account) => account.num)}
              availableNetworksMap={accountsInfo.reduce((acc, account) => {
                if (Array.isArray(account.availableNetworkIds)) {
                  acc[account.num] = {
                    networkIds: account.availableNetworkIds,
                  };
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
                        afterUpdate: () => {},
                      });
                    }}
                  />
                ))}
              </YStack>
            </AccountSelectorProviderMirror>
          )}
          <Divider mx="$-5" mt="$5" />
          <Stack bg="$bgSubdued" py="$3" space="$2">
            <ListItem key="manage-connection" onPress={onPressManageConnection}>
              <SizableText size="$bodyMd">Manage dApp Connections</SizableText>
            </ListItem>
            <Divider my="$2" />
            <ListItem key="disconnection" onPress={onDisconnect}>
              <SizableText size="$bodyMd">Disconnect</SizableText>
            </ListItem>
          </Stack>
        </>
      </Page.Body>
    </Page>
  );
}

export default CurrentConnectionModal;
