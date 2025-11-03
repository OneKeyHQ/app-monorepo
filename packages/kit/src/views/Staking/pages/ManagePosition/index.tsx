import { useCallback, useMemo, useState } from 'react';

import { useSharedValue } from 'react-native-reanimated';

import { Page, SizableText, Tabs, XStack } from '@onekeyhq/components';
import { AccountSelectorProviderMirror } from '@onekeyhq/kit/src/components/AccountSelector';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useAppRoute } from '@onekeyhq/kit/src/hooks/useAppRoute';
import { useActiveAccount } from '@onekeyhq/kit/src/states/jotai/contexts/accountSelector';
import { EJotaiContextStoreNames } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EModalStakingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalStakingParamList } from '@onekeyhq/shared/src/routes';
import { EAccountSelectorSceneName } from '@onekeyhq/shared/types';
import { type ISupportedSymbol } from '@onekeyhq/shared/types/earn';
import {
  normalizeToEarnProvider,
  normalizeToEarnSymbol,
} from '@onekeyhq/shared/types/earn/earnProvider.constants';
import { EStakingActionType } from '@onekeyhq/shared/types/staking';

import { DiscoveryBrowserProviderMirror } from '../../../Discovery/components/DiscoveryBrowserProviderMirror';
import { EarnProviderMirror } from '../../../Earn/EarnProviderMirror';
import { EarnNetworkUtils } from '../../../Earn/earnUtils';

import { HeaderRight } from './components/HeaderRight';
import { StakeSection } from './components/StakeSection';
import { WithdrawSection } from './components/WithdrawSection';
import { useProtocolDetails } from './hooks/useProtocolDetails';

const ManagePositionPage = () => {
  const route = useAppRoute<
    IModalStakingParamList,
    EModalStakingRoutes.ManagePosition
  >();
  const { activeAccount } = useActiveAccount({ num: 0 });

  // parse route params, support two types of routes
  const resolvedParams = useMemo<{
    networkId: string;
    symbol: ISupportedSymbol;
    provider: string;
    vault: string | undefined;
    isFromShareLink: boolean;
  }>(() => {
    const routeParams = route.params as any;

    // check if it is the new share link format
    if ('network' in routeParams) {
      // new format: /earn/:network/:symbol/:provider
      const {
        network,
        symbol: symbolParam,
        provider: providerParam,
        vault,
      } = routeParams;
      const networkId = EarnNetworkUtils.getNetworkIdByName(network);
      const symbol = normalizeToEarnSymbol(symbolParam);
      const provider = normalizeToEarnProvider(providerParam);

      if (!networkId) {
        throw new OneKeyLocalError(`Unknown network: ${String(network)}`);
      }
      if (!symbol) {
        throw new OneKeyLocalError(`Unknown symbol: ${String(symbolParam)}`);
      }
      if (!provider) {
        throw new OneKeyLocalError(
          `Unknown provider: ${String(providerParam)}`,
        );
      }

      return {
        accountId: activeAccount.account?.id || '',
        indexedAccountId: activeAccount.indexedAccount?.id,
        networkId,
        symbol,
        provider,
        vault,
        isFromShareLink: true,
      };
    }

    // old format: /defi/staking/v2/:symbol/:provider
    const {
      accountId: routeAccountId,
      indexedAccountId: routeIndexedAccountId,
      networkId,
      symbol,
      provider,
      vault,
    } = routeParams;

    return {
      accountId: routeAccountId || activeAccount.account?.id || '',
      indexedAccountId:
        routeIndexedAccountId || activeAccount.indexedAccount?.id,
      networkId,
      symbol,
      provider,
      vault,
      isFromShareLink: false,
    };
  }, [route.params, activeAccount]);

  const appNavigation = useAppNavigation();
  const { account, indexedAccount } = activeAccount;
  const { networkId, symbol, provider, vault } = resolvedParams;

  const { isLoading, tokenInfo, earnAccount, protocolInfo, detailInfo } =
    useProtocolDetails({
      accountId: account?.id || '',
      networkId,
      indexedAccountId: indexedAccount?.id,
      symbol,
      provider,
      vault,
    });

  const historyAction = useMemo(() => {
    return detailInfo?.actions?.find((i) => i.type === 'history');
  }, [detailInfo?.actions]);

  const onHistory = useMemo(() => {
    if (historyAction?.disabled || !earnAccount?.accountId) {
      return undefined;
    }
    return (params?: { filterType?: string }) => {
      const { filterType } = params || {};
      appNavigation.navigate(EModalStakingRoutes.HistoryList, {
        accountId: earnAccount?.accountId,
        networkId,
        symbol,
        provider,
        stakeTag: protocolInfo?.stakeTag || '',
        protocolVault: vault,
        filterType,
      });
    };
  }, [
    historyAction?.disabled,
    appNavigation,
    earnAccount?.accountId,
    networkId,
    protocolInfo?.stakeTag,
    provider,
    symbol,
    vault,
  ]);

  const [selectedTabIndex, setSelectedTabIndex] = useState(0);

  const tabData = useMemo(
    () => [
      {
        title: 'Deposit',
        type: EStakingActionType.Deposit,
      },
      {
        title: 'Withdraw',
        type: EStakingActionType.Withdraw,
      },
    ],
    [],
  );

  const TabNames = useMemo(() => {
    return tabData.map((item) => item.title);
  }, [tabData]);

  const focusedTab = useSharedValue(TabNames[0]);

  const handleTabChange = useCallback(
    (name: string) => {
      const index = tabData.findIndex((item) => item.title === name);
      if (index !== -1) {
        focusedTab.value = name;
        setSelectedTabIndex(index);
      }
    },
    [focusedTab, tabData],
  );

  if (!tokenInfo || isLoading) {
    return null;
  }

  return (
    <Page scrollEnabled>
      <Page.Header title={symbol} />
      <Page.Body>
        <XStack jc="space-between" px="$5">
          <Tabs.TabBar
            divider={false}
            onTabPress={handleTabChange}
            tabNames={TabNames}
            focusedTab={focusedTab}
            renderItem={({ name, isFocused, onPress }) => (
              <XStack
                px="$2"
                py="$1.5"
                mr="$1"
                bg={isFocused ? '$bgActive' : '$bg'}
                borderRadius="$2"
                borderCurve="continuous"
                onPress={() => onPress(name)}
              >
                <SizableText
                  size="$bodyMdMedium"
                  color={isFocused ? '$text' : '$textSubdued'}
                  letterSpacing={-0.15}
                >
                  {name}
                </SizableText>
              </XStack>
            )}
          />
          <HeaderRight historyAction={historyAction} onHistory={onHistory} />
        </XStack>
        {selectedTabIndex === 0 ? (
          <StakeSection
            accountId={earnAccount?.account?.id || ''}
            networkId={networkId}
            tokenInfo={tokenInfo}
            protocolInfo={protocolInfo}
          />
        ) : null}
        {selectedTabIndex === 1 ? (
          <WithdrawSection
            accountId={earnAccount?.account?.id || ''}
            networkId={networkId}
            tokenInfo={tokenInfo}
            protocolInfo={protocolInfo}
          />
        ) : null}
      </Page.Body>
    </Page>
  );
};

function ManagePositionPageWithProvider() {
  return (
    <AccountSelectorProviderMirror
      config={{
        sceneName: EAccountSelectorSceneName.home,
        sceneUrl: '',
      }}
      enabledNum={[0]}
    >
      <EarnProviderMirror storeName={EJotaiContextStoreNames.earn}>
        <DiscoveryBrowserProviderMirror>
          <ManagePositionPage />
        </DiscoveryBrowserProviderMirror>
      </EarnProviderMirror>
    </AccountSelectorProviderMirror>
  );
}

export default ManagePositionPageWithProvider;
