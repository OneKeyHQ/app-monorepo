import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/native';
import { CanceledError } from 'axios';
import { isEmpty, isNil, pickBy } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Button, Page, Toast, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import type { IModalApprovalManagementParamList } from '@onekeyhq/shared/src/routes/approvalManagement';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { NetworkSelectorTriggerApproval } from '../../../components/AccountSelector';
import ApprovalListView from '../../../components/ApprovalListView';
import { usePromiseResult } from '../../../hooks/usePromiseResult';
import {
  ProviderJotaiContextApprovalList,
  useApprovalListActions,
  useApprovalListAtom,
  useContractMapAtom,
  useIsBulkRevokeModeAtom,
  useSearchNetworkAtom,
  useSelectedTokensAtom,
  useTokenMapAtom,
} from '../../../states/jotai/contexts/approvalList';
import ApprovalActions from '../components/ApprovalActions';
import { useBulkRevoke } from '../hooks/useBulkRevoke';

import type { RouteProp } from '@react-navigation/core';

function ApprovalList() {
  const route =
    useRoute<
      RouteProp<
        IModalApprovalManagementParamList,
        EModalApprovalManagementRoutes.ApprovalList
      >
    >();
  const {
    accountId,
    networkId,
    walletId,
    indexedAccountId,
    isBulkRevokeMode: routeBulkMode,
    approvals: approvalsProp,
    tokenMap: tokenMapProp,
    contractMap: contractMapProp,
  } = route.params;

  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    toggleIsBulkRevokeMode,
    updateSearchKey,
    updateSearchNetwork,
    updateSelectedTokens,
    updateIsBulkRevokeMode,
    updateApprovalList,
    updateTokenMap,
    updateContractMap,
    updateApprovalListState,
  } = useApprovalListActions().current;

  const approvalListInitRef = useRef(false);

  const { navigationToBulkRevokeProcess, isBuildingRevokeTxs } =
    useBulkRevoke();

  const [{ networkId: searchNetworkId }] = useSearchNetworkAtom();
  const [isBulkRevokeMode] = useIsBulkRevokeModeAtom();
  const [{ selectedTokens }] = useSelectedTokensAtom();
  const [{ approvals }] = useApprovalListAtom();
  const [{ tokenMap }] = useTokenMapAtom();
  const [{ contractMap }] = useContractMapAtom();

  const { run } = usePromiseResult(async () => {
    if (!searchNetworkId) {
      return;
    }

    if (!approvalListInitRef.current) {
      updateApprovalListState({
        isRefreshing: true,
      });
    }

    let realAccountId = accountId;

    const globalDeriveType =
      await backgroundApiProxy.serviceNetwork.getGlobalDeriveTypeOfNetwork({
        networkId: searchNetworkId,
      });

    if (indexedAccountId) {
      const { accounts } =
        await backgroundApiProxy.serviceAccount.getAccountsByIndexedAccounts({
          indexedAccountIds: [indexedAccountId ?? ''],
          networkId: searchNetworkId,
          deriveType: globalDeriveType,
        });
      realAccountId = accounts[0]?.id ?? accountId;
    }

    await backgroundApiProxy.serviceApproval.abortFetchAccountApprovals();

    try {
      const resp =
        await backgroundApiProxy.serviceApproval.fetchAccountApprovals({
          accountId: realAccountId,
          networkId: searchNetworkId,
          indexedAccountId,
          networksEnabledOnly: false,
        });

      updateApprovalList({ data: resp.contractApprovals });
      updateTokenMap({ data: resp.tokenMap });
      updateContractMap({ data: resp.contractMap });
    } catch (error) {
      if (error instanceof CanceledError) {
        console.log('fetchAccountApprovals canceled');
      } else {
        throw error;
      }
    } finally {
      updateApprovalListState({
        isRefreshing: false,
        initialized: true,
      });
    }
  }, [
    updateApprovalListState,
    accountId,
    searchNetworkId,
    indexedAccountId,
    updateApprovalList,
    updateTokenMap,
    updateContractMap,
  ]);

  useEffect(() => {
    const refreshAnyway = () => {
      void run({ alwaysSetState: true });
    };

    appEventBus.on(EAppEventBusNames.RefreshApprovalList, refreshAnyway);
    return () => {
      appEventBus.off(EAppEventBusNames.RefreshApprovalList, refreshAnyway);
    };
  }, [run]);

  useEffect(() => {
    if (!isNil(routeBulkMode) && !accountUtils.isWatchingWallet({ walletId })) {
      updateIsBulkRevokeMode(!!routeBulkMode);
    }
    return () => {
      updateSearchKey('');
      updateIsBulkRevokeMode(false);
      updateSelectedTokens({
        selectedTokens: {},
      });
    };
  }, [
    routeBulkMode,
    updateIsBulkRevokeMode,
    updateSearchKey,
    updateSelectedTokens,
    walletId,
  ]);

  useEffect(() => {
    if (!isNil(approvalsProp)) {
      if (!isEmpty(approvalsProp)) {
        approvalListInitRef.current = true;
        updateApprovalListState({
          isRefreshing: false,
          initialized: true,
        });
      }
      updateApprovalList({ data: approvalsProp });
    }
    if (!isNil(tokenMapProp)) {
      updateTokenMap({ data: tokenMapProp });
    }
    if (!isNil(contractMapProp)) {
      updateContractMap({ data: contractMapProp });
    }
  }, [
    approvalsProp,
    tokenMapProp,
    contractMapProp,
    updateApprovalList,
    updateTokenMap,
    updateContractMap,
    updateApprovalListState,
  ]);

  useEffect(() => {
    const networksSupportBulkRevokeApproval =
      getNetworksSupportBulkRevokeApproval();

    if (
      networkUtils.isAllNetwork({ networkId }) ||
      networksSupportBulkRevokeApproval[networkId]
    ) {
      updateSearchNetwork(networkId);
    } else {
      updateSearchNetwork(getNetworkIdsMap().onekeyall);
    }
  }, [networkId, updateSearchNetwork]);

  const filteredSelectedTokensByNetwork = useMemo(() => {
    if (searchNetworkId === getNetworkIdsMap().onekeyall) {
      return selectedTokens;
    }
    return pickBy(selectedTokens, (_, key) => {
      return (
        approvalUtils.parseSelectedTokenKey({
          selectedTokenKey: key,
        }).networkId === searchNetworkId
      );
    });
  }, [selectedTokens, searchNetworkId]);

  const filteredApprovalsByNetwork = useMemo(() => {
    if (searchNetworkId === getNetworkIdsMap().onekeyall) {
      return approvals;
    }
    return approvals.filter((approval) => {
      return approval.networkId === searchNetworkId;
    });
  }, [approvals, searchNetworkId]);

  const { isSelectAllTokens, selectedCount } = useMemo(() => {
    return approvalUtils.checkIsSelectAllTokens({
      approvals: filteredApprovalsByNetwork,
      selectedTokens: filteredSelectedTokensByNetwork,
    });
  }, [filteredSelectedTokensByNetwork, filteredApprovalsByNetwork]);

  const renderNetworkFilter = useCallback(() => {
    const networksSupportBulkRevokeApproval =
      getNetworksSupportBulkRevokeApproval();

    const availableNetworkIds: string[] = [getNetworkIdsMap().onekeyall];

    Object.keys(networksSupportBulkRevokeApproval).forEach((n) => {
      availableNetworkIds.push(n);
    });

    return (
      <XStack alignItems="center" px="$5">
        <NetworkSelectorTriggerApproval
          networkIds={availableNetworkIds}
          value={searchNetworkId}
          onChange={(value) => {
            approvalListInitRef.current = false;
            updateSearchNetwork(value);
          }}
        />
      </XStack>
    );
  }, [searchNetworkId, updateSearchNetwork]);
  const renderHeaderRight = useCallback(() => {
    return (
      <Button
        size="medium"
        variant="tertiary"
        onPress={() => {
          if (accountUtils.isWatchingWallet({ walletId })) {
            Toast.error({
              title: intl.formatMessage({
                id: ETranslations.wallet_approval_revocation_not_available_for_watch_only_wallets,
              }),
            });
            return;
          }

          toggleIsBulkRevokeMode();
        }}
      >
        {isBulkRevokeMode
          ? intl.formatMessage({ id: ETranslations.global_done })
          : intl.formatMessage({ id: ETranslations.global_edit })}
      </Button>
    );
  }, [intl, toggleIsBulkRevokeMode, isBulkRevokeMode, walletId]);

  const handleSearchTextChange = useDebouncedCallback((text: string) => {
    updateSearchKey(text);
  }, 500);

  const handleApprovalOnPress = useCallback(
    (approval: IContractApproval) => {
      navigation.push(EModalApprovalManagementRoutes.ApprovalDetails, {
        approval,
        isSelectMode: isBulkRevokeMode,
        onSelected: ({
          selectedTokens: _selectedTokens,
        }: {
          selectedTokens: Record<string, boolean>;
        }) => {
          updateSelectedTokens({
            selectedTokens: _selectedTokens,
            merge: true,
          });
        },
        selectedTokens: filteredSelectedTokensByNetwork,
        tokenMap,
        contractMap,
      });
    },
    [
      navigation,
      isBulkRevokeMode,
      updateSelectedTokens,
      filteredSelectedTokensByNetwork,
      tokenMap,
      contractMap,
    ],
  );
  const handleSelectAll = useCallback(() => {
    const selectedTokensTemp = approvalUtils.buildToggleSelectAllTokensMap({
      approvals: filteredApprovalsByNetwork,
      toggle: !(isSelectAllTokens === true),
    });

    updateSelectedTokens({
      selectedTokens: selectedTokensTemp,
    });
  }, [updateSelectedTokens, filteredApprovalsByNetwork, isSelectAllTokens]);

  const handleOnConfirm = useCallback(() => {
    void navigationToBulkRevokeProcess({
      selectedTokens: filteredSelectedTokensByNetwork,
      tokenMap,
      contractMap,
    });
  }, [
    navigationToBulkRevokeProcess,
    filteredSelectedTokensByNetwork,
    tokenMap,
    contractMap,
  ]);
  const handleOnCancel = useCallback(() => {
    updateIsBulkRevokeMode(false);
  }, [updateIsBulkRevokeMode]);

  const renderBulkRevokeActions = () => {
    if (!isBulkRevokeMode) {
      return null;
    }

    return (
      <ApprovalActions
        isSelectAll={isSelectAllTokens}
        isBulkRevokeMode={isBulkRevokeMode}
        setIsSelectAll={handleSelectAll}
        onConfirm={handleOnConfirm}
        onCancel={handleOnCancel}
        onCancelText={intl.formatMessage({
          id: ETranslations.wallet_approval_cancel,
        })}
        selectedCount={selectedCount}
        isBuildingRevokeTxs={isBuildingRevokeTxs}
      />
    );
  };

  return (
    <Page>
      <Page.Header
        title={
          isBulkRevokeMode
            ? intl.formatMessage({
                id: ETranslations.wallet_approval_manage_title,
              })
            : intl.formatMessage({ id: ETranslations.global_approval_list })
        }
        headerRight={renderHeaderRight}
        headerSearchBarOptions={{
          placeholder: intl.formatMessage({ id: ETranslations.global_search }),
          onSearchTextChange: handleSearchTextChange,
        }}
      />
      <Page.Body>
        {renderNetworkFilter()}
        <ApprovalListView
          withHeader
          hideRiskOverview={accountUtils.isWatchingWallet({ walletId })}
          accountId={accountId}
          networkId={searchNetworkId}
          indexedAccountId={indexedAccountId}
          onPress={handleApprovalOnPress}
        />
      </Page.Body>
      {renderBulkRevokeActions()}
    </Page>
  );
}

const ApprovalListWithProvider = memo(() => {
  return (
    <ProviderJotaiContextApprovalList>
      <ApprovalList />
    </ProviderJotaiContextApprovalList>
  );
});

ApprovalListWithProvider.displayName = 'ApprovalListWithProvider';

export default ApprovalListWithProvider;
