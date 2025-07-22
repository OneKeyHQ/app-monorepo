import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useFocusEffect } from '@react-navigation/core';
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
import {
  EDAppConnectionModal,
  EModalRoutes,
  EModalSettingRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { useShouldUpdateConnectedAccount } from '../../../Discovery/hooks/useDAppNotifyChanges';
import { DAppAccountListItem } from '../../components/DAppAccountList';
import useActiveTabDAppInfo from '../../hooks/useActiveTabDAppInfo';

function CurrentConnectionModal() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { result } = useActiveTabDAppInfo();

  // Memoize result to avoid unnecessary re-renders
  const memoizedResult = useMemo(() => result, [result]);

  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();

  const [accountsInfo, setAccountsInfo] = useState<
    IConnectionAccountInfoWithNum[] | null
  >([]);

  const shouldRefreshWhenPageGoBack = useRef(false);
  const lastUrlRef = useRef<string>('');
  const lastHasConnectionRef = useRef<boolean>(false);

  const fetchAccountsInfo = useCallback(async () => {
    const origin = memoizedResult?.origin;
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
  }, [memoizedResult?.origin, navigation]);

  useEffect(() => {
    const currentUrl = memoizedResult?.origin ?? '';
    const currentHasConnection = Boolean(
      memoizedResult?.connectedAccountsInfo?.length,
    );

    if (
      currentUrl !== lastUrlRef.current && // url changed
      currentHasConnection && // new url has connection
      lastHasConnectionRef.current // last url had connection
    ) {
      void fetchAccountsInfo();
    }

    lastUrlRef.current = currentUrl;
    lastHasConnectionRef.current = currentHasConnection;
  }, [memoizedResult, fetchAccountsInfo]);

  useFocusEffect(
    useCallback(() => {
      if (shouldRefreshWhenPageGoBack.current) {
        void fetchAccountsInfo();
        shouldRefreshWhenPageGoBack.current = false;
      }
    }, [fetchAccountsInfo]),
  );

  useEffect(() => {
    void fetchAccountsInfo();
  }, [fetchAccountsInfo]);

  const onPressManageConnection = useCallback(() => {
    shouldRefreshWhenPageGoBack.current = true;
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.ConnectionList,
    });
  }, [navigation]);

  const onPressAlignAccountSettings = useCallback(() => {
    navigation.pushModal(EModalRoutes.SettingModal, {
      screen: EModalSettingRoutes.SettingAlignPrimaryAccount,
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
        origin: memoizedResult?.origin ?? '',
        storageType: accountsInfo?.[0].storageType,
        entry: 'ExtPanel',
      });
      navigation.pop();
    }
  }, [memoizedResult?.origin, accountsInfo, navigation]);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({ id: ETranslations.global_connect })}
      />
      <Page.Body>
        <XStack p="$5" gap="$3">
          <Image
            size="$10"
            borderRadius="$2"
            source={{ uri: memoizedResult?.faviconUrl }}
            fallback={
              <Image.Fallback>
                <Icon size="$10" name="GlobusOutline" />
              </Image.Fallback>
            }
          />
          <YStack>
            <SizableText size="$bodyLgMedium">
              {memoizedResult?.origin
                ? new URL(memoizedResult.origin).hostname
                : ''}
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
              sceneUrl: memoizedResult?.origin ?? '',
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
                    // compressionUiMode
                    handleAccountChanged={async (accountChangedParams) => {
                      await handleAccountInfoChanged({
                        origin: memoizedResult?.origin ?? '',
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
        <YStack bg="$bgSubdued" py="$3" gap="$2">
          <ListItem key="manage-connection" onPress={onPressManageConnection}>
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.explore_manage_dapp_connections,
              })}
            </SizableText>
          </ListItem>
          <ListItem
            key="align-account-settings"
            onPress={onPressAlignAccountSettings}
          >
            <SizableText size="$bodyMd">
              {intl.formatMessage({
                id: ETranslations.settings_account_sync_modal_title,
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
