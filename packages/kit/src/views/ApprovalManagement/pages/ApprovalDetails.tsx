import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Alert,
  Badge,
  Divider,
  IconButton,
  ListView,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
  useClipboard,
} from '@onekeyhq/components';
import type { IApproveInfo } from '@onekeyhq/kit-bg/src/vaults/types';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IModalApprovalManagementParamList } from '@onekeyhq/shared/src/routes/approvalManagement';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  useApprovalListActions,
  useContractMapAtom,
  useTokenMapAtom,
} from '../../../states/jotai/contexts/approvalList';
import { openExplorerAddressUrl } from '../../../utils/explorerUtils';
import { HomeApprovalListProviderMirror } from '../../Home/components/HomeApprovalListProvider/HomeApprovalListProviderMirror';
import ApprovalActions from '../components/ApprovalActions';
import {
  ApprovalManagementContext,
  useApprovalManagementContext,
} from '../components/ApprovalManagementContext';
import ApprovedTokenItem from '../components/ApprovedTokenItem';
import { useBulkRevoke } from '../hooks/useBulkRevoke';

import type { RouteProp } from '@react-navigation/core';

function ApprovalDetails() {
  const route =
    useRoute<
      RouteProp<
        IModalApprovalManagementParamList,
        EModalApprovalManagementRoutes.ApprovalDetails
      >
    >();
  const {
    approval,
    isSelectMode,
    onSelected,
    selectedTokens: selectedTokensProp,
    tokenMap: tokenMapProp,
    contractMap: contractMapProp,
  } = route.params;

  const intl = useIntl();

  const { copyText } = useClipboard();

  const navigation = useAppNavigation();

  const [isBulkRevokeMode, setIsBulkRevokeMode] = useState(false);

  const { updateTokenMap, updateContractMap } =
    useApprovalListActions().current;

  const [{ tokenMap }] = useTokenMapAtom();

  const {
    selectedTokens,
    setSelectedTokens,
    setIsBuildingRevokeTxs,
    isBuildingRevokeTxs,
  } = useApprovalManagementContext();

  const { isSelectAllTokens, selectedCount } = useMemo(() => {
    return approvalUtils.checkIsSelectAllTokens({
      approvals: [approval],
      selectedTokens,
    });
  }, [approval, selectedTokens]);

  const [{ contractMap }] = useContractMapAtom();

  const { navigationToBulkRevokeProcess } = useBulkRevoke();

  const contract = contractMap[
    approvalUtils.buildContractMapKey({
      networkId: approval.networkId,
      contractAddress: approval.contractAddress,
    })
  ] ?? {
    label: intl.formatMessage({ id: ETranslations.global_unknown }),
    icon: 'Document2Outline',
  };

  const [searchText, setSearchText] = useState('');

  const handleTokenOnSelect = useCallback(
    async ({
      tokenInfo,
      isSelected,
    }: {
      tokenInfo: IToken;
      isSelected: boolean;
    }) => {
      setSelectedTokens((prev) => ({
        ...prev,
        [approvalUtils.buildSelectedTokenKey({
          accountId: approval.accountId,
          networkId: approval.networkId,
          contractAddress: approval.contractAddress,
          tokenAddress: tokenInfo.address,
        })]: isSelected,
      }));
    },
    [
      approval.accountId,
      approval.contractAddress,
      approval.networkId,
      setSelectedTokens,
    ],
  );

  const handleSelectAll = useCallback(
    (_isSelectAll: ICheckedState) => {
      const isSelectAll = _isSelectAll === true;
      const selectedAllTokens = approval.approvals.reduce((acc, item) => {
        acc[
          approvalUtils.buildSelectedTokenKey({
            accountId: approval.accountId,
            networkId: approval.networkId,
            contractAddress: approval.contractAddress,
            tokenAddress: item.tokenAddress,
          })
        ] = isSelectAll;
        return acc;
      }, {} as Record<string, boolean>);
      setSelectedTokens(selectedAllTokens);
    },
    [
      approval.accountId,
      approval.approvals,
      approval.contractAddress,
      approval.networkId,
      setSelectedTokens,
    ],
  );

  const handleOnConfirm = useCallback(async () => {
    if (isSelectMode) {
      onSelected?.({
        selectedTokens,
      });
      navigation.pop();
      return;
    }

    await navigationToBulkRevokeProcess({
      selectedTokens,
      tokenMap,
      contractMap,
    });
  }, [
    isSelectMode,
    navigation,
    navigationToBulkRevokeProcess,
    onSelected,
    selectedTokens,
    tokenMap,
    contractMap,
  ]);

  const handleOnCancel = useCallback(() => {
    setIsBulkRevokeMode(false);
  }, [setIsBulkRevokeMode]);

  const handleTokenOnRevoke = useCallback(
    async ({ tokenInfo }: { tokenInfo: IToken }) => {
      setIsBuildingRevokeTxs(true);
      setSelectedTokens({
        [approvalUtils.buildSelectedTokenKey({
          accountId: approval.accountId,
          networkId: approval.networkId,
          contractAddress: approval.contractAddress,
          tokenAddress: tokenInfo.address,
        })]: true,
      });

      const revokeInfo: IApproveInfo = {
        owner: approval.owner,
        spender: approval.contractAddress,
        amount: '0',
        tokenInfo,
      };

      const unsignedTx =
        await backgroundApiProxy.serviceSend.prepareSendConfirmUnsignedTx({
          networkId: approval.networkId,
          accountId: approval.accountId,
          approveInfo: revokeInfo,
        });

      navigation.push(EModalApprovalManagementRoutes.TxConfirm, {
        accountId: approval.accountId,
        networkId: approval.networkId,
        unsignedTxs: [unsignedTx],
      });

      await timerUtils.wait(1000);
      setIsBuildingRevokeTxs(false);
    },

    [
      approval.accountId,
      approval.contractAddress,
      approval.networkId,
      approval.owner,
      navigation,
      setIsBuildingRevokeTxs,
      setSelectedTokens,
    ],
  );

  const renderApprovalOverview = () => {
    if (isSelectMode) {
      return null;
    }

    return (
      <Stack>
        {approval.isRiskContract && approval.riskReason ? (
          <Alert
            icon="ErrorSolid"
            type="danger"
            title={approval.riskReason}
            fullBleed
          />
        ) : null}
        <XStack alignItems="center" gap="$6" padding="$5">
          <XStack flex={1} gap="$3" alignItems="center">
            <Token
              isNFT
              size="xl"
              showNetworkIcon
              networkId={approval.networkId}
              fallbackIcon={contract.icon}
            />
            <YStack flex={1}>
              <SizableText size="$heading3xl" numberOfLines={1}>
                {contract.label ??
                  intl.formatMessage({ id: ETranslations.global_unknown })}
              </SizableText>
              <SizableText size="$bodyLgMedium" color="$textSubdued">
                {intl.formatMessage(
                  {
                    id: ETranslations.wallet_approval_number,
                  },
                  {
                    number: approval.approvals.length,
                  },
                )}
              </SizableText>
            </YStack>
          </XStack>
          {approval.isRiskContract ? (
            <XStack>
              <Badge badgeSize="lg" badgeType="critical">
                <Badge.Text>
                  {intl.formatMessage({
                    id: ETranslations.global_risk,
                  })}
                </Badge.Text>
              </Badge>
            </XStack>
          ) : null}
        </XStack>
        <Divider />
        <XStack px="$5" py="$3" gap="$6" alignItems="center">
          <YStack flex={1} gap="$1">
            <SizableText size="$bodyMd" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_contract_address,
              })}
            </SizableText>
            <SizableText size="$bodyLgMedium" flexWrap="wrap">
              {approval.contractAddress}
            </SizableText>
          </YStack>
          <XStack gap="$5" alignItems="center">
            <IconButton
              title={intl.formatMessage({ id: ETranslations.global_copy })}
              variant="tertiary"
              icon="Copy3Outline"
              iconColor="$iconSubdued"
              size="small"
              onPress={() => {
                copyText(approval.contractAddress);
              }}
            />
            <IconButton
              title={intl.formatMessage({
                id: ETranslations.global_view_in_blockchain_explorer,
              })}
              variant="tertiary"
              icon="OpenOutline"
              iconColor="$iconSubdued"
              size="small"
              onPress={() =>
                openExplorerAddressUrl({
                  networkId: approval.networkId,
                  address: approval.contractAddress,
                  openInExternal: true,
                })
              }
            />
          </XStack>
        </XStack>
        <Divider />
      </Stack>
    );
  };

  const filteredApprovals = useMemo(() => {
    if (!searchText) {
      return approval.approvals;
    }

    return approval.approvals.filter((item) => {
      const searchTextLower = searchText.toLowerCase();
      if (item.tokenAddress.toLowerCase() === searchTextLower) {
        return true;
      }

      const tokenInfo =
        tokenMap[
          approvalUtils.buildTokenMapKey({
            networkId: approval.networkId,
            tokenAddress: item.tokenAddress,
          })
        ].info;

      return (
        tokenInfo.name?.toLowerCase().includes(searchTextLower) ||
        tokenInfo.symbol?.toLowerCase().includes(searchTextLower)
      );
    });
  }, [approval.approvals, approval.networkId, searchText, tokenMap]);

  const renderApprovedTokens = () => {
    console.log(filteredApprovals);

    return (
      <ListView
        ListHeaderComponent={
          isSelectMode ? null : (
            <XStack
              justifyContent="space-between"
              alignItems="center"
              px="$5"
              py="$2"
            >
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.wallet_approval_approved_token,
                })}
              </SizableText>
              <IconButton
                title={intl.formatMessage({ id: ETranslations.global_edit })}
                variant="tertiary"
                icon="EditOutline"
                iconColor="$iconSubdued"
                size="small"
                onPress={() => {
                  setIsBulkRevokeMode((v) => !v);
                }}
              />
            </XStack>
          )
        }
        data={filteredApprovals}
        renderItem={({ item }) => (
          <ApprovedTokenItem
            key={item.tokenAddress}
            networkId={approval.networkId}
            accountId={approval.accountId}
            approval={item}
            isSelectMode={!!(isSelectMode || isBulkRevokeMode)}
            onSelect={handleTokenOnSelect}
            onRevoke={handleTokenOnRevoke}
          />
        )}
      />
    );
  };

  const renderBulkRevokeActions = () => {
    if (isBulkRevokeMode || isSelectMode) {
      return (
        <ApprovalActions
          isSelectAll={isSelectAllTokens}
          setIsSelectAll={handleSelectAll}
          onConfirm={handleOnConfirm}
          onCancel={handleOnCancel}
          isSelectMode={isSelectMode}
          isBulkRevokeMode={isBulkRevokeMode}
          selectedCount={selectedCount}
          isBuildingRevokeTxs={isBuildingRevokeTxs}
        />
      );
    }

    return null;
  };

  const handleSearchTextChange = useDebouncedCallback((text: string) => {
    setSearchText(text);
  }, 500);

  useEffect(() => {
    if (selectedTokensProp) {
      setSelectedTokens(selectedTokensProp);
    }
  }, [selectedTokensProp, setSelectedTokens]);

  useEffect(() => {
    if (tokenMapProp) {
      updateTokenMap({ data: tokenMapProp });
    }
    if (contractMapProp) {
      updateContractMap({ data: contractMapProp });
    }
  }, [tokenMapProp, contractMapProp, updateTokenMap, updateContractMap]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_approval_approval_details,
        })}
        headerSearchBarOptions={
          isSelectMode
            ? {
                placeholder: intl.formatMessage({
                  id: ETranslations.global_search,
                }),
                onSearchTextChange: handleSearchTextChange,
              }
            : undefined
        }
      />
      <Page.Body>
        {renderApprovalOverview()}
        {renderApprovedTokens()}
      </Page.Body>
      {renderBulkRevokeActions()}
    </Page>
  );
}

const ApprovalDetailsWithProvider = memo(() => {
  const [isBuildingRevokeTxs, setIsBuildingRevokeTxs] = useState(false);
  const [selectedTokens, setSelectedTokens] = useState<Record<string, boolean>>(
    {},
  );

  const contextValue = useMemo(
    () => ({
      isBuildingRevokeTxs,
      setIsBuildingRevokeTxs,
      selectedTokens,
      setSelectedTokens,
    }),
    [
      isBuildingRevokeTxs,
      setIsBuildingRevokeTxs,
      selectedTokens,
      setSelectedTokens,
    ],
  );
  return (
    <HomeApprovalListProviderMirror>
      <ApprovalManagementContext.Provider value={contextValue}>
        <ApprovalDetails />
      </ApprovalManagementContext.Provider>
    </HomeApprovalListProviderMirror>
  );
});
ApprovalDetailsWithProvider.displayName = 'ApprovalDetailsWithProvider';

export default ApprovalDetailsWithProvider;
