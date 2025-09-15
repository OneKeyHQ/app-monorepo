import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';
import { useDebouncedCallback } from 'use-debounce';

import type { ICheckedState } from '@onekeyhq/components';
import {
  Alert,
  Badge,
  Button,
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
import { useIsMounted } from '../../../hooks/useIsMounted';
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

  const isMountedRef = useIsMounted();

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
      if (!isMountedRef.current) return;

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
      isMountedRef,
    ],
  );

  const handleSelectAll = useCallback(
    (_isSelectAll: ICheckedState) => {
      if (!isMountedRef.current) return;

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
      isMountedRef,
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
      if (!isMountedRef.current) return;

      setIsBuildingRevokeTxs(true);
      setSelectedTokens({
        [approvalUtils.buildSelectedTokenKey({
          accountId: approval.accountId,
          networkId: approval.networkId,
          contractAddress: approval.contractAddress,
          tokenAddress: tokenInfo.address,
        })]: true,
      });

      try {
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

        if (!isMountedRef.current) return;

        navigation.push(EModalApprovalManagementRoutes.TxConfirm, {
          accountId: approval.accountId,
          networkId: approval.networkId,
          unsignedTxs: [unsignedTx],
        });

        await timerUtils.wait(1000);

        if (isMountedRef.current) {
          setIsBuildingRevokeTxs(false);
        }
      } catch (error) {
        if (isMountedRef.current) {
          setIsBuildingRevokeTxs(false);
        }
        throw error;
      }
    },

    [
      approval.accountId,
      approval.contractAddress,
      approval.networkId,
      approval.owner,
      navigation,
      setIsBuildingRevokeTxs,
      setSelectedTokens,
      isMountedRef,
    ],
  );

  const renderApprovalOverview = useCallback(() => {
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
              tokenImageUri={contract.logoURI}
              fallbackIcon={contract.icon}
            />
            <YStack flex={1}>
              <SizableText size="$heading2xl" numberOfLines={1}>
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
        <XStack
          px="$5"
          py="$3.5"
          gap="$6"
          alignItems="center"
          hoverStyle={{
            bg: '$bgHover',
          }}
          pressStyle={{
            bg: '$bgActive',
          }}
          onPress={() => {
            copyText(approval.contractAddress);
          }}
        >
          <YStack flex={1} gap="$1">
            <SizableText size="$bodyMdMedium" color="$textSubdued">
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
  }, [
    approval.approvals.length,
    approval.contractAddress,
    approval.isRiskContract,
    approval.networkId,
    approval.riskReason,
    contract.icon,
    contract.label,
    contract.logoURI,
    copyText,
    intl,
    isSelectMode,
  ]);

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

  const renderApprovedTokens = useCallback(() => {
    return (
      <ListView
        ListHeaderComponent={
          isSelectMode ? null : (
            <XStack
              justifyContent="space-between"
              alignItems="center"
              mt="$3"
              px="$5"
              py="$2"
            >
              <SizableText size="$bodyMdMedium" color="$textSubdued">
                {intl.formatMessage({
                  id: ETranslations.wallet_approval_approved_token,
                })}
              </SizableText>
              <Button
                variant="tertiary"
                size="small"
                onPress={() => {
                  setIsBulkRevokeMode((v) => !v);
                }}
              >
                {isBulkRevokeMode
                  ? intl.formatMessage({ id: ETranslations.global_done })
                  : intl.formatMessage({ id: ETranslations.global_edit })}
              </Button>
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
  }, [
    filteredApprovals,
    handleTokenOnSelect,
    handleTokenOnRevoke,
    isBulkRevokeMode,
    isSelectMode,
    intl,
    approval.accountId,
    approval.networkId,
  ]);

  const renderBulkRevokeActions = useCallback(() => {
    if (isBulkRevokeMode || isSelectMode) {
      return (
        <ApprovalActions
          isSelectAll={isSelectAllTokens}
          setIsSelectAll={handleSelectAll}
          onConfirm={handleOnConfirm}
          onCancel={handleOnCancel}
          onCancelText={
            isBulkRevokeMode
              ? intl.formatMessage({
                  id: ETranslations.wallet_approval_cancel,
                })
              : intl.formatMessage({
                  id: ETranslations.global_cancel,
                })
          }
          isSelectMode={isSelectMode}
          isBulkRevokeMode={isBulkRevokeMode}
          selectedCount={selectedCount}
          isBuildingRevokeTxs={isBuildingRevokeTxs}
        />
      );
    }

    return null;
  }, [
    handleOnCancel,
    handleOnConfirm,
    handleSelectAll,
    isBuildingRevokeTxs,
    isBulkRevokeMode,
    isSelectAllTokens,
    isSelectMode,
    selectedCount,
    intl,
  ]);

  const handleSearchTextChange = useDebouncedCallback((text: string) => {
    if (isMountedRef.current) {
      setSearchText(text);
    }
  }, 500);

  useEffect(() => {
    if (selectedTokensProp && isMountedRef.current) {
      setSelectedTokens(selectedTokensProp);
    }
  }, [selectedTokensProp, setSelectedTokens, isMountedRef]);

  useEffect(() => {
    if (isMountedRef.current) {
      if (tokenMapProp) {
        updateTokenMap({ data: tokenMapProp });
      }
      if (contractMapProp) {
        updateContractMap({ data: contractMapProp });
      }
    }
  }, [
    tokenMapProp,
    contractMapProp,
    updateTokenMap,
    updateContractMap,
    isMountedRef,
  ]);

  return (
    <Page scrollEnabled>
      <Page.Header
        title={
          isSelectMode
            ? intl.formatMessage({
                id: ETranslations.wallet_approval_select_tokens,
              })
            : intl.formatMessage({
                id: ETranslations.wallet_approval_approval_details,
              })
        }
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
