import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { isNil } from 'lodash';

import {
  Divider,
  Image,
  Page,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { EModalRoutes } from '@onekeyhq/kit/src/routes/Modal/type';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

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
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();

  const [accountsInfo, setAccountsInfo] = useState<
    IConnectionAccountInfoWithNum[] | null
  >([]);

  const shouldRefreshWhenPageGoBack = useRef(false);
  const fetchAccountsInfo = useCallback(async () => {
    if (!origin) {
      setAccountsInfo(null);
      return;
    }
    const connectedAccountsInfo =
      await backgroundApiProxy.serviceDApp.findInjectedAccountByOrigin(origin);
    if (!connectedAccountsInfo) {
      navigation.pop();
      return;
    }
    setAccountsInfo(connectedAccountsInfo);
  }, [origin, navigation]);

  useFocusEffect(() => {
    if (shouldRefreshWhenPageGoBack.current) {
      void fetchAccountsInfo();
      shouldRefreshWhenPageGoBack.current = false;
    }
  });

  useEffect(() => {
    void fetchAccountsInfo();
  }, [fetchAccountsInfo]);

  const onPressManageConnection = useCallback(() => {
    shouldRefreshWhenPageGoBack.current = true;
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
        <XStack p="$5" space="$3">
          <Image size="$10" source={{ uri: faviconUrl }} borderRadius="$2" />
          <YStack>
            <SizableText size="$bodyLgMedium">
              {new URL(origin).hostname}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSuccess">
              Connected
            </SizableText>
          </YStack>
        </XStack>
        {isNil(accountsInfo) || !accountsInfo.length ? null : (
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
            <YStack space="$2" px="$5">
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
      </Page.Body>
      <Page.Footer>
        <Divider />
        <YStack bg="$bgSubdued" py="$3" space="$2">
          <ListItem key="manage-connection" onPress={onPressManageConnection}>
            <SizableText size="$bodyMd">Manage dApp Connections</SizableText>
          </ListItem>
          <Divider mx="$5" />
          <ListItem key="disconnection" onPress={onDisconnect}>
            <SizableText size="$bodyMd">Disconnect</SizableText>
          </ListItem>
        </YStack>
      </Page.Footer>
    </Page>
  );
}

export default CurrentConnectionModal;
