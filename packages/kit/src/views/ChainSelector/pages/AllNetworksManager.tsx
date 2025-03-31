import { memo, useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import { Page, SizableText, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EChainSelectorPages,
  IChainSelectorParamList,
} from '@onekeyhq/shared/src/routes';
import { isEnabledNetworksInAllNetworks } from '@onekeyhq/shared/src/utils/networkUtils';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import { AllNetworksManagerContext } from '../components/AllNetworksManager/AllNetworksManagerContext';
import NetworksSectionList from '../components/AllNetworksManager/NetworksSectionList';

import type { IServerNetworkMatch } from '../types';
import type { RouteProp } from '@react-navigation/core';

function AllNetworksManager() {
  const intl = useIntl();

  const route =
    useRoute<
      RouteProp<IChainSelectorParamList, EChainSelectorPages.AllNetworksManager>
    >();

  const { walletId } = route.params;

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

  const contextValue = useMemo(
    () => ({
      networks,
      networksState,
      setNetworksState,
    }),
    [networks, networksState, setNetworksState],
  );

  const enabledNetworksCount = useMemo(() => {
    return networks.mainNetworks.filter((network) =>
      isEnabledNetworksInAllNetworks({
        networkId: network.id,
        enabledNetworks: networksState.enabledNetworks,
        disabledNetworks: networksState.disabledNetworks,
        isTestnet: network.isTestnet,
      }),
    ).length;
  }, [networks, networksState]);

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
          walletId,
          networkIds: allNetworks.map((network) => network.id),
        },
      );
    setNetworks({
      mainNetworks: compatibleNetworks.mainnetItems,
      frequentlyUsedNetworks: compatibleNetworks.frequentlyUsedItems,
    });
  }, [walletId]);

  const renderHeaderTitle = useCallback(() => {
    return (
      <YStack>
        <SizableText size="$headingLg">
          {intl.formatMessage({ id: ETranslations.global_all_networks })}
        </SizableText>
        <SizableText size="$bodySm" color="$textSubdued">
          {intl.formatMessage({
            id: ETranslations.global_all_networks,
          })}
        </SizableText>
      </YStack>
    );
  }, [intl]);
  return (
    <AllNetworksManagerContext.Provider value={contextValue}>
      <Page safeAreaEnabled>
        <Page.Header
          headerTitle={renderHeaderTitle}
          headerTitleAlign="center"
        />
        <Page.Body>
          <NetworksSectionList />
        </Page.Body>
        <Page.Footer>
          <Page.FooterActions
            onConfirmText={intl.formatMessage(
              {
                id: ETranslations.network_enable_count,
              },
              {
                count: enabledNetworksCount,
              },
            )}
            confirmButtonProps={{
              disabled: (() => {
                if (enabledNetworksCount <= 0) {
                  return true;
                }
                return false;
              })(),
            }}
          />
        </Page.Footer>
      </Page>
    </AllNetworksManagerContext.Provider>
  );
}

export default memo(AllNetworksManager);
