import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SizableText, YStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import { useAccountSelectorCreateAddress } from '@onekeyhq/kit/src/components/AccountSelector/hooks/useAccountSelectorCreateAddress';
import type { IAccountDeriveTypes } from '@onekeyhq/kit-bg/src/vaults/types';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { AllNetworksManagerContext } from '../components/AllNetworksManager/AllNetworksManagerContext';
import NetworksSectionList from '../components/AllNetworksManager/NetworksSectionList';
import { useFindNetworksWithoutAccount } from '../hooks/useFindNetworksWithoutAccount';

import type { IServerNetworkMatch } from '../types';
import type { RouteProp } from '@react-navigation/core';

function AllNetworksManager() {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { createAddress } = useAccountSelectorCreateAddress();
  const { findNetworksWithoutAccount } = useFindNetworksWithoutAccount();

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
    allNetworks: IServerNetworkMatch[];
    mainNetworks: IServerNetworkMatch[];
    frequentlyUsedNetworks: IServerNetworkMatch[];
  }>({
    allNetworks: [],
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

  const [missingAddressCount, setMissingAddressCount] = useState(0);

  const [isCreatingMissingAddresses, setIsCreatingMissingAddresses] =
    useState(false);

  const [isCreatingEnabledAddresses, setIsCreatingEnabledAddresses] =
    useState(false);

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
      walletId,
      indexedAccountId,
      accountId,
      networks: {
        mainNetworks: networks.mainNetworks,
        frequentlyUsedNetworks: networks.frequentlyUsedNetworks,
      },
      networksState,
      setNetworksState,
      enabledNetworks,
      searchKey,
      setSearchKey,
      isCreatingEnabledAddresses,
      setIsCreatingEnabledAddresses,
      isCreatingMissingAddresses,
      setIsCreatingMissingAddresses,
      missingAddressCount,
      setMissingAddressCount,
      accountNetworkValues: {},
      accountNetworkValueCurrency: undefined,
      accountDeFiOverview: {},
    }),
    [
      walletId,
      indexedAccountId,
      accountId,
      networks.mainNetworks,
      networks.frequentlyUsedNetworks,
      networksState,
      setNetworksState,
      enabledNetworks,
      searchKey,
      isCreatingEnabledAddresses,
      isCreatingMissingAddresses,
      setIsCreatingEnabledAddresses,
      setIsCreatingMissingAddresses,
      missingAddressCount,
    ],
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
    if (!enabledNetworksInit.current && networks.allNetworks.length > 0) {
      setOriginalEnabledNetworks(result);
      enabledNetworksInit.current = true;
    }
  }, [networksState, networks.mainNetworks, networks.allNetworks]);

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
          excludeTestNetwork: true,
        },
      );
    setNetworks({
      allNetworks,
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
          numberOfLines={1}
          $md={{
            maxWidth: 280,
          }}
        >
          {intl.formatMessage({
            id: ETranslations.network_selection_prompt,
          })}
        </SizableText>
      </YStack>
    );
  }, [intl]);

  const handleEnableAllNetworks = useCallback(async () => {
    setIsCreatingEnabledAddresses(true);
    try {
      if (!accountUtils.isOthersWallet({ walletId })) {
        // 1. Find networks missing addresses
        const networksWithoutAccount = await findNetworksWithoutAccount({
          accountId: accountId ?? '',
          indexedAccountId,
          enabledNetworks,
        });

        setEnabledNetworksWithoutAccount(networksWithoutAccount);

        // 2. Create missing addresses if any
        if (networksWithoutAccount.length > 0) {
          await createAddress({
            num: 0,
            account: {
              walletId,
              networkId: getNetworkIdsMap().onekeyall,
              indexedAccountId,
              deriveType: 'default',
            },
            customNetworks: networksWithoutAccount,
          });
        }
      } else {
        setEnabledNetworksWithoutAccount([]);
      }

      await backgroundApiProxy.serviceAllNetwork.updateAllNetworksState({
        enabledNetworks: networksState.enabledNetworks,
        disabledNetworks: networksState.disabledNetworks,
      });

      appEventBus.emit(EAppEventBusNames.EnabledNetworksChanged, undefined);

      navigation.pop();

      void onNetworksChanged?.();
    } finally {
      setIsCreatingEnabledAddresses(false);
    }
  }, [
    accountId,
    createAddress,
    enabledNetworks,
    findNetworksWithoutAccount,
    indexedAccountId,
    navigation,
    networksState.disabledNetworks,
    networksState.enabledNetworks,
    onNetworksChanged,
    walletId,
  ]);

  const confirmButtonText = useMemo(() => {
    if (
      isCreatingEnabledAddresses &&
      enabledNetworksWithoutAccount.length > 0
    ) {
      return intl.formatMessage({
        id: ETranslations.global_creating_address,
      });
    }

    if (enabledNetworks.length > 0) {
      return `${intl.formatMessage({
        id: ETranslations.global_done,
      })} (${enabledNetworks.length}/${networks.mainNetworks.length})`;
    }

    return intl.formatMessage({
      id: ETranslations.network_none_selected,
    });
  }, [
    isCreatingEnabledAddresses,
    enabledNetworksWithoutAccount.length,
    enabledNetworks.length,
    intl,
    networks.mainNetworks.length,
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
              loading: isCreatingEnabledAddresses,
              disabled: (() => {
                if (enabledNetworks.length <= 0) {
                  return true;
                }
                if (isCreatingEnabledAddresses || isCreatingMissingAddresses) {
                  return true;
                }

                if (
                  enabledNetworks.length === originalEnabledNetworks.length &&
                  enabledNetworks.every((network) =>
                    originalEnabledNetworks.find(
                      (item) => item.id === network.id,
                    ),
                  )
                ) {
                  return true;
                }
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
