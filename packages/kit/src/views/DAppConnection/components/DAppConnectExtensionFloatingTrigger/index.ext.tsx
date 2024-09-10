import { useCallback, useEffect, useState } from 'react';

import {
  Button,
  Icon,
  IconButton,
  Image,
  SizableText,
  Skeleton,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { AccountSelectorTriggerAddressSingle } from '@onekeyhq/kit/src/components/AccountSelector/AccountSelectorTrigger/AccountSelectorTriggerDApp';
import { Token } from '@onekeyhq/kit/src/components/Token';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import {
  EDAppConnectionModal,
  EModalRoutes,
} from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import type { IConnectionAccountInfoWithNum } from '@onekeyhq/shared/types/dappConnection';

import { useShouldUpdateConnectedAccount } from '../../../Discovery/hooks/useDAppNotifyChanges';
import useActiveTabDAppInfo from '../../hooks/useActiveTabDAppInfo';
import {
  type IHandleAccountChangedParams,
  useHandleDiscoveryAccountChanged,
} from '../../hooks/useHandleAccountChanged';

function SingleAccountAddressSelectorTrigger({
  origin,
  num,
  account,
  afterChangeAccount,
}: {
  origin: string;
  num: number;
  account: IConnectionAccountInfoWithNum;
  afterChangeAccount: () => void;
}) {
  const { handleAccountInfoChanged } = useShouldUpdateConnectedAccount();
  const handleAccountChanged = useCallback(
    async (accountChangedParams: IHandleAccountChangedParams) => {
      await handleAccountInfoChanged({
        origin,
        accountSelectorNum: num,
        prevAccountInfo: account,
        accountChangedParams,
        storageType: account.storageType,
        afterUpdate: afterChangeAccount,
      });
    },
    [num, account, afterChangeAccount, handleAccountInfoChanged, origin],
  );

  useHandleDiscoveryAccountChanged({
    num,
    handleAccountChanged,
  });
  return <AccountSelectorTriggerAddressSingle num={num} />;
}

function DAppConnectExtensionFloatingTrigger() {
  const { result, refreshConnectionInfo } = useActiveTabDAppInfo();

  const {
    activeAccount: {
      account,
      indexedAccount,
      network,
      wallet,
      deriveType,
      isOthersWallet,
    },
  } = useActiveAccount({ num: 0 });

  const [shouldSwitchAccount, setShouldSwitchAccount] = useState(false);
  const [accountExist, setAccountExist] = useState(false);
  const [hideAccountSelectorTrigger, setHideAccountSelectorTrigger] =
    useState(false);
  const checkShouldSwitchAccount = useCallback(
    async (params: {
      origin: string;
      accountId?: string;
      networkId?: string;
      indexedAccountId?: string;
      isOthersWallet?: boolean;
    }) => {
      if (!params.origin) {
        console.log(
          '🚀 ~ checkShouldSwitchAccount ~ supportSwitchConnectionAccount: false, accountExist: false',
        );
        setShouldSwitchAccount(false);
        setAccountExist(false);
      }
      const { supportSwitchConnectionAccount, accountExist: _accountExist } =
        await backgroundApiProxy.serviceDApp.isSupportSwitchDAppConnectionAccount(
          params,
        );
      console.log(
        '🚀 ~ checkShouldSwitchAccount ~ supportSwitchConnectionAccount: ',
        supportSwitchConnectionAccount,
        ', accountExist:',
        _accountExist,
      );
      setShouldSwitchAccount(supportSwitchConnectionAccount);
      setAccountExist(_accountExist);
    },
    [],
  );

  useEffect(() => {
    // 1. 判断能不能切换
    // - 针对当前 tab 有没有 dApp 连接
    // - 针对当前 tab 的 dApp 连接的账户有没有变动
    // - 如果当前账户是 othersWallet，判断当前账户的网络是否支持，EVM 理论上支持全系切换，其他网络必须 networkId 相等
    // 2. 判断账户存不存在，需不需要创建账户
    // 3. 切换账户
    void checkShouldSwitchAccount({
      origin: result?.origin ?? '',
      accountId: account?.id,
      networkId: network?.id,
      indexedAccountId: indexedAccount?.id,
      isOthersWallet,
    });
  }, [
    indexedAccount?.id,
    account?.id,
    isOthersWallet,
    network?.id,
    result?.origin,
    checkShouldSwitchAccount,
  ]);

  const onSwitchAccount = useCallback(async () => {
    console.log('onSwitchAccount');

    if (typeof result?.connectedAccountsInfo?.[0].num !== 'number') {
      return;
    }
    setHideAccountSelectorTrigger(true);
    await backgroundApiProxy.serviceDApp.updateConnectionSession({
      origin: result?.origin ?? '',
      accountSelectorNum: result?.connectedAccountsInfo?.[0].num,
      updatedAccountInfo: {
        walletId: wallet?.id ?? '',
        indexedAccountId: indexedAccount?.id ?? '',
        othersWalletAccountId: isOthersWallet ? wallet?.id : undefined,
        networkId: network?.id ?? '',
        deriveType,
        networkImpl: network?.impl ?? '',
        accountId: account?.id ?? '',
        address: account?.address ?? '',
        num: result?.connectedAccountsInfo?.[0].num,
        focusedWallet: wallet?.id,
      },
      storageType: result?.connectedAccountsInfo?.[0].storageType,
    });
    setTimeout(() => {
      refreshConnectionInfo();
      if (result?.origin) {
        void backgroundApiProxy.serviceDApp.notifyDAppAccountsChanged(
          result.origin,
        );
      }
      setHideAccountSelectorTrigger(true);
    }, 200);
  }, [
    result?.connectedAccountsInfo,
    wallet?.id,
    indexedAccount?.id,
    isOthersWallet,
    network?.id,
    deriveType,
    network?.impl,
    account?.id,
    account?.address,
    result?.origin,
    refreshConnectionInfo,
  ]);

  const navigation = useAppNavigation();
  const handlePressFloatingButton = useCallback(() => {
    navigation.pushModal(EModalRoutes.DAppConnectionModal, {
      screen: EDAppConnectionModal.CurrentConnectionModal,
      params: {
        origin: result?.origin ?? '',
        faviconUrl: result?.faviconUrl ?? '',
      },
    });
  }, [result, navigation]);

  const onDisconnect = useCallback(async () => {
    if (result?.connectedAccountsInfo?.[0].storageType) {
      await backgroundApiProxy.serviceDApp.disconnectWebsite({
        origin: result?.origin ?? '',
        storageType: result?.connectedAccountsInfo?.[0].storageType,
      });
      void refreshConnectionInfo();
    }
  }, [result?.origin, result?.connectedAccountsInfo, refreshConnectionInfo]);

  if (!result?.showFloatingPanel) {
    return null;
  }

  return (
    <>
      {shouldSwitchAccount ? (
        <Stack
          position="absolute"
          bottom="$16"
          right="0"
          left="0"
          h="$16"
          w="100%"
          py="$3"
          px="$5"
        >
          <Button size="small" onPress={() => onSwitchAccount()}>
            Switch Account
          </Button>
          <Button onPress={() => setShouldSwitchAccount(false)}>Cancel</Button>
        </Stack>
      ) : null}
      <Stack
        position="absolute"
        bottom="0"
        right="0"
        left="0"
        h="$16"
        w="100%"
        py="$3"
        px="$5"
        flexDirection="row"
        alignItems="center"
        justifyContent="space-between"
        bg="$bgApp"
        borderTopWidth="$px"
        borderBottomWidth="0"
        borderLeftWidth="0"
        borderRightWidth="0"
        borderColor="$border"
        onPress={handlePressFloatingButton}
      >
        <XStack alignItems="center" gap="$3">
          <Stack position="relative">
            <Image size="$9" borderRadius="$2">
              <Image.Source
                src={result?.faviconUrl || result?.originFaviconUrl}
              />
              <Image.Fallback>
                <Icon size="$10" name="GlobusOutline" />
              </Image.Fallback>
              <Image.Loading>
                <Skeleton width="100%" height="100%" />
              </Image.Loading>
            </Image>
            <Stack
              position="absolute"
              bottom={-2}
              right={-2}
              justifyContent="center"
              alignItems="center"
              w="$3"
              h="$3"
              borderRadius="$full"
              bg="$bg"
              zIndex="$1"
            >
              <Stack w="$2" h="$2" bg="$iconSuccess" borderRadius="$full" />
            </Stack>
          </Stack>
          <YStack maxWidth={276}>
            <SizableText size="$bodyLgMedium" numberOfLines={1}>
              {result?.connectLabel}
            </SizableText>
            {result?.connectedAccountsInfo?.length === 1 &&
            !hideAccountSelectorTrigger ? (
              <AccountSelectorProviderMirror
                config={{
                  sceneName: EAccountSelectorSceneName.discover,
                  sceneUrl: result?.origin ?? '',
                }}
                enabledNum={result?.connectedAccountsInfo?.map(
                  (connectAccount) => connectAccount.num,
                )}
                availableNetworksMap={result?.connectedAccountsInfo?.reduce(
                  (acc, connectAccount) => {
                    if (Array.isArray(connectAccount.availableNetworkIds)) {
                      acc[connectAccount.num] = {
                        networkIds: connectAccount.availableNetworkIds,
                      };
                    }
                    return acc;
                  },
                  {} as Record<number, { networkIds: string[] }>,
                )}
              >
                <SingleAccountAddressSelectorTrigger
                  origin={result?.origin ?? ''}
                  num={result?.connectedAccountsInfo?.[0]?.num}
                  account={result?.connectedAccountsInfo?.[0]}
                  afterChangeAccount={() => {
                    void refreshConnectionInfo();
                  }}
                />
              </AccountSelectorProviderMirror>
            ) : (
              <XStack
                alignItems="center"
                borderRadius="$2"
                hoverStyle={{
                  bg: '$bgHover',
                }}
                pressStyle={{
                  bg: '$bgActive',
                }}
                focusable
                focusVisibleStyle={{
                  outlineWidth: 2,
                  outlineColor: '$focusRing',
                  outlineStyle: 'solid',
                }}
                onPress={() => {}}
              >
                {result?.networkIcons.slice(0, 2).map((icon, index) => (
                  <Token
                    key={icon}
                    size="xs"
                    tokenImageUri={icon}
                    ml={index === 1 ? '$-2' : undefined}
                    borderColor={index === 1 ? '$bgApp' : undefined}
                    borderWidth={index === 1 ? 2 : undefined}
                    borderStyle={index === 1 ? 'solid' : undefined}
                    style={
                      // @ts-expect-error
                      index === 1 ? { boxSizing: 'content-box' } : undefined
                    }
                  />
                ))}
                <SizableText pl="$1" size="$bodySm" numberOfLines={1}>
                  {result?.addressLabel}
                </SizableText>
                <Icon
                  size="$4"
                  color="$iconSubdued"
                  name="ChevronRightSmallOutline"
                />
              </XStack>
            )}
          </YStack>
        </XStack>
        <IconButton
          icon="BrokenLinkOutline"
          size="medium"
          variant="tertiary"
          onPress={onDisconnect}
        />
      </Stack>
    </>
  );
}

export default function DAppConnectExtensionFloatingTriggerWithHomeProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <DAppConnectExtensionFloatingTrigger />
    </AccountSelectorProviderMirror>
  );
}
