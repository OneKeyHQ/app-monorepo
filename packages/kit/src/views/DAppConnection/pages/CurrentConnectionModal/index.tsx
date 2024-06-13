import { useCallback, useEffect, useRef, useState } from 'react';

import { useFocusEffect, useRoute } from '@react-navigation/core';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Divider,
  Icon,
  Image,
  ListView,
  Page,
  SizableText,
  Skeleton,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IDAppConnectionModalParamList } from '@onekeyhq/shared/src/routes';
import {
  EDAppConnectionModal,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { useShouldUpdateConnectedAccount } from '../../../Discovery/hooks/useDAppNotifyChanges';
import { DAppAccountListItem } from '../../components/DAppAccountList';

import type { RouteProp } from '@react-navigation/core';

function CurrentConnectionModal() {
  const intl = useIntl();
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

  const onPressDefaultWalletSettings = useCallback(() => {
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.DefaultWalletSettingsModal,
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
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_connect })}
      />
      <Page.Body>
        <XStack p="$5" space="$3">
          <Image size="$10" borderRadius="$2">
            <Image.Source src={faviconUrl} />
            <Image.Fallback>
              <Icon size="$10" name="GlobusOutline" />
            </Image.Fallback>
            <Image.Loading>
              <Skeleton width="100%" height="100%" />
            </Image.Loading>
          </Image>
          <YStack>
            <SizableText size="$bodyLgMedium">
              {new URL(origin).hostname}
            </SizableText>
            <SizableText size="$bodyMd" color="$textSuccess">
              {intl.formatMessage({ id: ETranslations.global_connected })}
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
            <ListView
              data={accountsInfo}
              renderItem={({ item: account }) => (
                <YStack px="$5" pb="$2">
                  <DAppAccountListItem
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
                        afterUpdate: fetchAccountsInfo,
                      });
                    }}
                  />
                </YStack>
              )}
              estimatedItemSize="$10"
            />
          </AccountSelectorProviderMirror>
        )}
      </Page.Body>
      <Page.Footer>
        <Divider />
        <YStack bg="$bgSubdued" py="$3" space="$2">
          <ListItem key="manage-connection" onPress={onPressManageConnection}>
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.explore_manage_dapp_connections,
              })}
            </SizableText>
          </ListItem>
          <ListItem
            key="default-wallet-settings"
            onPress={onPressDefaultWalletSettings}
          >
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.explore_default_wallet_settings,
              })}
            </SizableText>
          </ListItem>
          <Divider mx="$5" />
          <ListItem key="disconnection" onPress={onDisconnect}>
            <SizableText size="$bodyMd">
              {intl.formatMessage({ id: ETranslations.explore_disconnect })}
            </SizableText>
          </ListItem>
        </YStack>
      </Page.Footer>
    </Page>
  );
}

export default CurrentConnectionModal;
