import { memo, useState } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

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
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type {
  EModalApprovalManagementRoutes,
  IModalApprovalManagementParamList,
} from '@onekeyhq/shared/src/routes/approvalManagement';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import { TX_RISKY_LEVEL_SPAM } from '@onekeyhq/shared/src/walletConnect/constant';

import { Token } from '../../../components/Token';
import { useContractMapAtom } from '../../../states/jotai/contexts/approvalList';
import { openExplorerAddressUrl } from '../../../utils/explorerUtils';

import type { RouteProp } from '@react-navigation/core';
import ApprovedTokenItem from '../components/ApprovedTokenItem';

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
    isSelectMode: isSelectedModeFromParent,
    onSelected,
  } = route.params;

  const intl = useIntl();

  const { copyText } = useClipboard();

  const isRiskApproval = approval.highestRiskLevel >= TX_RISKY_LEVEL_SPAM;

  const [isSelectMode, setIsSelectMode] = useState(false);

  const [{ contractMap }] = useContractMapAtom();
  const contract =
    contractMap[
      approvalUtils.buildContractMapKey({
        networkId: approval.networkId,
        contractAddress: approval.contractAddress,
      })
    ];

  const renderApprovalOverview = () => {
    if (isSelectedModeFromParent) {
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
          <XStack flex={1} gap="$3">
            <Token isNFT size="sm" />
            <YStack flex={1}>
              <SizableText size="$heading3xl" numberOfLines={1}>
                {contract.label ??
                  intl.formatMessage({ id: ETranslations.global_unknown })}
              </SizableText>
              <SizableText size="$bodyLgMedium" color="$textSubdued">
                {approval.approvals.length}
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
          <XStack justifyContent="space-between" alignItems="center">
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
            <SizableText size="$bodyLgMedium" color="$textSubdued">
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
                setIsSelectMode((v) => !v);
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
            isChecked={false}
            isSelectMode={!!(isSelectMode || isSelectedModeFromParent)}
          />
        )}
      />
    );
  };

  return (
    <Page scrollEnabled>
      <Page.Header />
      <Page.Body>
        {renderApprovalOverview()}
        {renderApprovedTokens()}
      </Page.Body>
    </Page>
  );
}

export default memo(ApprovalDetails);
