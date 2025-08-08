import { memo, useCallback, useMemo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

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
import {
  EModalRoutes,
  EModalSignatureConfirmRoutes,
} from '@onekeyhq/shared/src/routes';
import type {
  EModalApprovalManagementRoutes,
  IModalApprovalManagementParamList,
} from '@onekeyhq/shared/src/routes/approvalManagement';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { TX_RISKY_LEVEL_SPAM } from '@onekeyhq/shared/src/walletConnect/constant';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import { Token } from '../../../components/Token';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useContractMapAtom } from '../../../states/jotai/contexts/approvalList';
import { openExplorerAddressUrl } from '../../../utils/explorerUtils';
import { HomeApprovalListProviderMirror } from '../../Home/components/HomeApprovalListProvider/HomeApprovalListProviderMirror';
import ApprovalActions from '../components/ApprovalActions';
import {
  ApprovalManagementContext,
  useApprovalManagementContext,
} from '../components/ApprovalManagementContext';
import ApprovedTokenItem from '../components/ApprovedTokenItem';
import { buildSelectedTokenKey } from '../utils';

import type { RouteProp } from '@react-navigation/core';

function ApprovalDetails() {
  const route =
    useRoute<
      RouteProp<
        IModalApprovalManagementParamList,
        EModalApprovalManagementRoutes.ApprovalDetails
      >
    >();
  const { approval, isSelectMode, onSelected } = route.params;

  const intl = useIntl();

  const { copyText } = useClipboard();

  const navigation = useAppNavigation();

  const isRiskApproval = approval.highestRiskLevel >= TX_RISKY_LEVEL_SPAM;

  const [isBulkRevokeMode, setIsBulkRevokeMode] = useState(false);

  const { selectedTokens, setSelectedTokens, setIsBuildingRevokeTxs } =
    useApprovalManagementContext();

  const isSelectAllTokens = useMemo(() => {
    let selectedCount = 0;
    for (const item of approval.approvals) {
      if (
        selectedTokens[
          buildSelectedTokenKey({
            networkId: approval.networkId,
            contractAddress: approval.contractAddress,
            tokenAddress: item.tokenAddress,
          })
        ]
      ) {
        selectedCount += 1;
      }
    }
    if (selectedCount === approval.approvals.length) {
      return true;
    }

    if (selectedCount > 0) {
      return 'indeterminate';
    }

    return false;
  }, [
    approval.approvals,
    approval.contractAddress,
    approval.networkId,
    selectedTokens,
  ]);

  const [{ contractMap }] = useContractMapAtom();
  const contract = contractMap[
    approvalUtils.buildContractMapKey({
      networkId: approval.networkId,
      contractAddress: approval.contractAddress,
    })
  ] ?? {
    label: intl.formatMessage({ id: ETranslations.global_unknown }),
    icon: 'Document2Outline',
  };

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
        [buildSelectedTokenKey({
          networkId: approval.networkId,
          contractAddress: approval.contractAddress,
          tokenAddress: tokenInfo.address,
        })]: isSelected,
      }));
    },
    [approval.contractAddress, approval.networkId, setSelectedTokens],
  );

  const handleSelectAll = useCallback(
    (isSelectAll: ICheckedState) => {
      if (isSelectAll === true) {
        const selectedAllTokens = approval.approvals.reduce((acc, item) => {
          acc[
            buildSelectedTokenKey({
              networkId: approval.networkId,
              contractAddress: approval.contractAddress,
              tokenAddress: item.tokenAddress,
            })
          ] = true;
          return acc;
        }, {} as Record<string, boolean>);
        setSelectedTokens(selectedAllTokens);
      } else {
        setSelectedTokens({});
      }
    },
    [
      approval.approvals,
      approval.contractAddress,
      approval.networkId,
      setSelectedTokens,
    ],
  );

  const handleOnConfirm = useCallback(() => {}, []);

  const handleOnCancel = useCallback(() => {
    console.log('handleOnCancel');
  }, []);

  const handleTokenOnRevoke = useCallback(
    async ({ tokenInfo }: { tokenInfo: IToken }) => {
      setIsBuildingRevokeTxs(true);
      setSelectedTokens({
        [buildSelectedTokenKey({
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

      navigation.pushModal(EModalRoutes.SignatureConfirmModal, {
        screen: EModalSignatureConfirmRoutes.TxConfirm,
        params: {
          accountId: approval.accountId,
          networkId: approval.networkId,
          unsignedTxs: [unsignedTx],
        },
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
        {isRiskApproval && approval.riskReason ? (
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
          {isRiskApproval ? (
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

  const renderApprovedTokens = () => {
    return (
      <ListView
        ListHeaderComponent={
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
        }
        data={approval.approvals}
        renderItem={({ item }) => (
          <ApprovedTokenItem
            key={item.tokenAddress}
            networkId={approval.networkId}
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
          selectedCount={Object.keys(selectedTokens).length}
        />
      );
    }

    return null;
  };

  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_approval_approval_details,
        })}
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
