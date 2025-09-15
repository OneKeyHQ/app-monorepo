import { memo, useCallback, useEffect, useMemo } from 'react';

import { useRoute } from '@react-navigation/native';
import { pickBy } from 'lodash';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import { Button, Page, XStack } from '@onekeyhq/components';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { getNetworksSupportBulkRevokeApproval } from '@onekeyhq/shared/src/config/presetNetworks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import type { IModalApprovalManagementParamList } from '@onekeyhq/shared/src/routes/approvalManagement';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import { NetworkSelectorTriggerApproval } from '../../../components/AccountSelector';
import ApprovalListView from '../../../components/ApprovalListView';
import { useEnabledNetworksCompatibleWithWalletIdInAllNetworks } from '../../../hooks/useAllNetwork';
import {
  useApprovalListActions,
  useApprovalListAtom,
  useContractMapAtom,
  useIsBulkRevokeModeAtom,
  useSearchNetworkAtom,
  useSelectedTokensAtom,
  useTokenMapAtom,
} from '../../../states/jotai/contexts/approvalList';
import { HomeApprovalListProviderMirror } from '../../Home/components/HomeApprovalListProvider/HomeApprovalListProviderMirror';
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
    isBulkRevokeMode: routeBulkMode,
  } = route.params;
  const intl = useIntl();
  const navigation = useAppNavigation();
  const {
    toggleIsBulkRevokeMode,
    updateSearchKey,
    updateSearchNetwork,
    updateSelectedTokens,
    updateIsBulkRevokeMode,
  } = useApprovalListActions().current;

  const { navigationToBulkRevokeProcess, isBuildingRevokeTxs } =
    useBulkRevoke();

  const [{ networkId: searchNetworkId }] = useSearchNetworkAtom();
  const [isBulkRevokeMode] = useIsBulkRevokeModeAtom();
  const [{ selectedTokens }] = useSelectedTokensAtom();
  const [{ approvals }] = useApprovalListAtom();
  const [{ tokenMap }] = useTokenMapAtom();
  const [{ contractMap }] = useContractMapAtom();
  const { enabledNetworksCompatibleWithWalletId } =
    useEnabledNetworksCompatibleWithWalletIdInAllNetworks({
      walletId,
      networkId,
    });

  useEffect(() => {
    if (typeof routeBulkMode !== 'undefined') {
      updateIsBulkRevokeMode(!!routeBulkMode);
    }
    // Only apply on mount or when param changes
  }, [routeBulkMode, updateIsBulkRevokeMode]);

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
    if (!networkUtils.isAllNetwork({ networkId })) {
      return null;
    }

    const networksSupportBulkRevokeApproval =
      getNetworksSupportBulkRevokeApproval();

    const availableNetworkIds: string[] = [getNetworkIdsMap().onekeyall];

    enabledNetworksCompatibleWithWalletId.forEach((network) => {
      if (networksSupportBulkRevokeApproval[network.id]) {
        availableNetworkIds.push(network.id);
      }
    });

    return (
      <XStack alignItems="center" px="$5">
        <NetworkSelectorTriggerApproval
          networkIds={availableNetworkIds}
          value={searchNetworkId}
          onChange={(value) => {
            updateSearchNetwork(value);
          }}
        />
      </XStack>
    );
  }, [
    enabledNetworksCompatibleWithWalletId,
    networkId,
    searchNetworkId,
    updateSearchNetwork,
  ]);
  const renderHeaderRight = useCallback(() => {
    return (
      <Button
        size="medium"
        variant="tertiary"
        onPress={() => {
          toggleIsBulkRevokeMode();
        }}
      >
        {isBulkRevokeMode
          ? intl.formatMessage({ id: ETranslations.global_done })
          : intl.formatMessage({ id: ETranslations.global_edit })}
      </Button>
    );
  }, [intl, toggleIsBulkRevokeMode, isBulkRevokeMode]);

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
      });
    },
    [
      navigation,
      isBulkRevokeMode,
      updateSelectedTokens,
      filteredSelectedTokensByNetwork,
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
  const handleOnClose = useCallback(() => {
    updateSearchKey('');
    updateIsBulkRevokeMode(false);
    updateSelectedTokens({
      selectedTokens: {},
    });
  }, [updateIsBulkRevokeMode, updateSelectedTokens, updateSearchKey]);

  return (
    <Page onClose={handleOnClose}>
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
          accountId={accountId}
          networkId={networkId}
          onPress={handleApprovalOnPress}
        />
      </Page.Body>
      {renderBulkRevokeActions()}
    </Page>
  );
}

const ApprovalListWithProvider = memo(() => {
  return (
    <HomeApprovalListProviderMirror>
      <ApprovalList />
    </HomeApprovalListProviderMirror>
  );
});

ApprovalListWithProvider.displayName = 'ApprovalListWithProvider';

export default ApprovalListWithProvider;
