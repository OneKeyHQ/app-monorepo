import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SizableText, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { AllNetworksManagerContext } from '../components/AllNetworksManager/AllNetworksManagerContext';
import NetworksSectionList from '../components/AllNetworksManager/NetworksSectionList';

import type { IServerNetworkMatch } from '../types';
import type { RouteProp } from '@react-navigation/core';

function AllNetworksManager() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { createAddress } = useAccountSelectorCreateAddress();

  const route =
    useRoute<
      RouteProp<IChainSelectorParamList, EChainSelectorPages.AllNetworksManager>
    >();

  const { accountId, walletId, indexedAccountId, onNetworksChanged } =
    route.params;

  const [networksState, setNetworksState] = useState<{
    enabledNetworks: Record<string, boolean>;
    disabledNetworks: Record<string, boolean>;
  }>({
    enabledNetworks: {},
    disabledNetworks: {},
  });
  const [networks, setNetworks] = useState<{
    mainNetworks: IServerNetworkMatch[];
    frequentlyUsedNetworks: IServerNetworkMatch[];
  }>({
    mainNetworks: [],
    frequentlyUsedNetworks: [],
  });

  const enabledNetworksInit = useRef(false);

  const [originalEnabledNetworks, setOriginalEnabledNetworks] = useState<
    IServerNetworkMatch[]
  >([]);
  const [enabledNetworks, setEnabledNetworks] = useState<IServerNetworkMatch[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);

  const [searchKey, setSearchKey] = useState('');

  const [enabledNetworksWithoutAccount, setEnabledNetworksWithoutAccount] =
    useState<
      {
        networkId: string;
        deriveType: IAccountDeriveTypes;
      }[]
    >([]);

  const contextValue = useMemo(
    () => ({
      networks,
      networksState,
      setNetworksState,
      enabledNetworks,
      searchKey,
      setSearchKey,
    }),
    [networks, networksState, setNetworksState, enabledNetworks, searchKey],
  );

  useEffect(() => {
    const result = networks.mainNetworks.filter((network) =>
      isEnabledNetworksInAllNetworks({
        networkId: network.id,
        enabledNetworks: networksState.enabledNetworks,
        disabledNetworks: networksState.disabledNetworks,
        isTestnet: network.isTestnet,
      }),
    );
    setEnabledNetworks(result);
    if (!enabledNetworksInit.current && result.length > 0) {
      setOriginalEnabledNetworks(result);
      enabledNetworksInit.current = true;
    }
  }, [networksState, networks.mainNetworks]);

  usePromiseResult(async () => {
    const [allNetworksState, { networks: allNetworks }] = await Promise.all([
      backgroundApiProxy.serviceAllNetwork.getAllNetworksState(),
      backgroundApiProxy.serviceNetwork.getAllNetworks(),
    ]);
    setNetworksState({
      enabledNetworks: allNetworksState.enabledNetworks,
      disabledNetworks: allNetworksState.disabledNetworks,
    });

    const compatibleNetworks =
      await backgroundApiProxy.serviceNetwork.getChainSelectorNetworksCompatibleWithAccountId(
        {
          accountId,
          walletId,
          networkIds: allNetworks.map((network) => network.id),
        },
      );
    setNetworks({
      mainNetworks: compatibleNetworks.mainnetItems,
      frequentlyUsedNetworks: compatibleNetworks.frequentlyUsedItems,
    });
  }, [accountId, walletId]);

  const renderHeaderTitle = useCallback(() => {
    return (
      <YStack>
        <SizableText
          size="$headingLg"
          {...(platformEnv.isNativeIOS && {
            textAlign: 'center',
          })}
        >
          {intl.formatMessage({ id: ETranslations.global_all_networks })}
        </SizableText>
        <SizableText
          size="$bodySm"
          color="$textSubdued"
          {...(platformEnv.isNativeIOS && {
            textAlign: 'center',
          })}
        >
          {intl.formatMessage({
            id: ETranslations.network_selection_prompt,
          })}
        </SizableText>
      </YStack>
    );
  }, [intl]);

  const handleEnableAllNetworks = useCallback(async () => {
    setIsLoading(true);

    const { accountsInfo } =
      await backgroundApiProxy.serviceAllNetwork.getAllNetworkAccounts({
        accountId: accountId ?? '',
        indexedAccountId,
        networkId: getNetworkIdsMap().onekeyall,
        deriveType: undefined,
        excludeTestNetwork: true,
      });

    const networkAccountMap: Record<string, IAllNetworkAccountInfo> = {};
    for (let i = 0; i < accountsInfo.length; i += 1) {
      const item = accountsInfo[i];
      const { networkId, deriveType, dbAccount } = item;
      if (dbAccount) {
        networkAccountMap[`${networkId}_${deriveType ?? ''}`] = item;
      }
    }

    const enabledNetworksWithoutAccountTemp: {
      networkId: string;
      deriveType: IAccountDeriveTypes;
    }[] = [];

    for (let i = 0; i < enabledNetworks.length; i += 1) {
      const deriveTypes: IAccountDeriveTypes[] = [];
      const network = enabledNetworks[i];
      const vaultSettings =
        await backgroundApiProxy.serviceNetwork.getVaultSettings({
          networkId: network.id,
        });

      if (vaultSettings.createAllDeriveTypeAccountsByDefault) {
        const deriveInfoItems =
          await backgroundApiProxy.serviceNetwork.getDeriveInfoItemsOfNetwork({
            networkId: network.id,
          });
        deriveTypes.push(
          ...deriveInfoItems.map((item) => item.value as IAccountDeriveTypes),
        );
      } else {
        deriveTypes.push(
          await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
            networkId: network.id,
          }),
        );
      }

      for (let j = 0; j < deriveTypes.length; j += 1) {
        const deriveType = deriveTypes[j];
        const networkAccount = networkAccountMap[`${network.id}_${deriveType}`];
        if (!networkAccount) {
          enabledNetworksWithoutAccountTemp.push({
            networkId: network.id,
            deriveType,
          });
        }
      }
    }

    setEnabledNetworksWithoutAccount(enabledNetworksWithoutAccountTemp);

    if (enabledNetworksWithoutAccountTemp.length > 0) {
      await createAddress({
        num: 0,
        account: {
          walletId,
          networkId: getNetworkIdsMap().onekeyall,
          indexedAccountId,
          deriveType: 'default',
        },
        customNetworks: enabledNetworksWithoutAccountTemp,
      });
    }

    await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
      enabledNetworks: networksState.enabledNetworks,
      disabledNetworks: networksState.disabledNetworks,
    });

    navigation.pop();

    if (
      enabledNetworksWithoutAccountTemp.length > 0 ||
      !(
        enabledNetworks.length === originalEnabledNetworks.length &&
        enabledNetworks.every(
          (network, index) => network.id === originalEnabledNetworks[index].id,
        )
      )
    ) {
      void onNetworksChanged?.();
    }

    setIsLoading(false);
  }, [
    accountId,
    createAddress,
    enabledNetworks,
    indexedAccountId,
    navigation,
    networksState.disabledNetworks,
    networksState.enabledNetworks,
    onNetworksChanged,
    originalEnabledNetworks,
    walletId,
  ]);

  const confirmButtonText = useMemo(() => {
    if (isLoading && enabledNetworksWithoutAccount.length > 0) {
      return intl.formatMessage({
        id: ETranslations.global_creating_address,
      });
    }

    if (enabledNetworks.length > 0) {
      return intl.formatMessage(
        {
          id: ETranslations.network_enable_count,
        },
        {
          count: enabledNetworks.length,
        },
      );
    }

    return intl.formatMessage({
      id: ETranslations.network_none_selected,
    });
  }, [
    enabledNetworks.length,
    enabledNetworksWithoutAccount.length,
    intl,
    isLoading,
  ]);

  return (
    <AllNetworksManagerContext.Provider value={contextValue}>
      <Page safeAreaEnabled>
        <Page.Header headerTitle={renderHeaderTitle} />
        <Page.Body>
          <NetworksSectionList />
        </Page.Body>
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={confirmButtonText}
            confirmButtonProps={{
              loading: isLoading,
              disabled: (() => {
                if (enabledNetworks.length <= 0) {
                  return true;
                }
                if (isLoading) {
                  return true;
                }
                return false;
              })(),
            }}
            onConfirm={handleEnableAllNetworks}
          />
        </Page.Footer>
      </Page>
    </AllNetworksManagerContext.Provider>
  );
}

const AllNetworksManagerMemo = memo(AllNetworksManager);

export default function AllNetworksManagerPage() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <AllNetworksManagerMemo />
    </AccountSelectorProviderMirror>
  );
}
