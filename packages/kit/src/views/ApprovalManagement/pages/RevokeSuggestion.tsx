import { memo, useCallback, useEffect, useMemo, useRef } from 'react';

import { useRoute } from '@react-navigation/core';
import { useIntl } from 'react-intl';

import {
  Icon,
  Page,
  SizableText,
  Stack,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IModalApprovalManagementParamList } from '@onekeyhq/shared/src/routes/approvalManagement';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import approvalUtils from '@onekeyhq/shared/src/utils/approvalUtils';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';
import ApprovalListView from '../../../components/ApprovalListView';
import useAppNavigation from '../../../hooks/useAppNavigation';
import {
  ProviderJotaiContextApprovalList,
  useApprovalListActions,
  useSelectedTokensAtom,
} from '../../../states/jotai/contexts/approvalList';
import ApprovalActions from '../components/ApprovalActions';
import { useBulkRevoke } from '../hooks/useBulkRevoke';

import type { RouteProp } from '@react-navigation/core';

function RevokeSuggestion() {
  const intl = useIntl();
  const route =
    useRoute<
      RouteProp<
        IModalApprovalManagementParamList,
        EModalApprovalManagementRoutes.RevokeSuggestion
      >
    >();
  const { accountId, networkId, approvals, tokenMap, contractMap, autoShow } =
    route.params;
  const {
    updateApprovalList,
    updateTokenMap,
    updateContractMap,
    updateApprovalListState,
    updateSelectedTokens,
    updateIsBulkRevokeMode,
  } = useApprovalListActions().current;

  const navigation = useAppNavigation();

  const { navigationToBulkRevokeProcess, isBuildingRevokeTxs } =
    useBulkRevoke();

  const [{ selectedTokens }] = useSelectedTokensAtom();

  const navToRevokeRef = useRef(false);

  const { riskyNumber, inactiveNumber } = useMemo(() => {
    let risky = 0;
    let inactive = 0;
    approvals.forEach((item) => {
      if (item.isRiskContract) risky += 1;
      if (item.isInactiveApproval) inactive += 1;
    });
    return {
      riskyNumber: risky,
      inactiveNumber: inactive,
    };
  }, [approvals]);
  const { isSelectAllTokens, selectedCount } = useMemo(() => {
    return approvalUtils.checkIsSelectAllTokens({
      approvals,
      selectedTokens,
    });
  }, [approvals, selectedTokens]);

  useEffect(() => {
    defaultLogger.approval.revokeSuggestion.revokeSuggestionShow({
      inactiveCount: inactiveNumber,
      riskyCount: riskyNumber,
    });
  }, [inactiveNumber, riskyNumber]);

  useEffect(() => {
    // select all tokens by default
    const selectedTokensTemp = approvalUtils.buildToggleSelectAllTokensMap({
      approvals,
      toggle: true,
    });

    updateSelectedTokens({
      selectedTokens: selectedTokensTemp,
    });
    updateApprovalList({
      data: approvals,
    });
    updateTokenMap({
      data: tokenMap,
    });
    updateContractMap({
      data: contractMap,
    });
    updateApprovalListState({
      isRefreshing: false,
      initialized: true,
    });

    updateIsBulkRevokeMode(true);
  }, [
    approvals,
    contractMap,
    tokenMap,
    updateApprovalList,
    updateTokenMap,
    updateContractMap,
    updateApprovalListState,
    updateSelectedTokens,
    updateIsBulkRevokeMode,
  ]);

  const handleApprovalItemOnPress = useCallback(
    (approval: IContractApproval) => {
      navigation.push(EModalApprovalManagementRoutes.ApprovalDetails, {
        approval,
        isSelectMode: true,

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
        selectedTokens,
        tokenMap,
        contractMap,
      });
    },
    [navigation, updateSelectedTokens, selectedTokens, tokenMap, contractMap],
  );

  const renderRevokeSuggestionOverview = useCallback(() => {
    const hasRisk = riskyNumber > 0;
    const hasInactive = inactiveNumber > 0;
    const bgColor = hasRisk ? '$bgCritical' : '$bgCaution';
    const iconColor = hasRisk ? '$iconCritical' : '$iconCaution';

    let titleId = ETranslations.wallet_approval_suggestion_title_only_inactive;
    if (hasRisk && hasInactive) {
      titleId = ETranslations.wallet_approval_suggestion_title_summary;
    } else if (hasRisk) {
      titleId = ETranslations.wallet_approval_suggestion_title_only_risky;
    }

    return (
      <YStack p="$5" gap="$4">
        <XStack>
          <Stack borderRadius="$full" bg={bgColor} p="$3">
            <Icon name="ShieldExclamationOutline" size="$8" color={iconColor} />
          </Stack>
        </XStack>
        <YStack gap="$1">
          <SizableText size="$heading2xl">
            {intl.formatMessage(
              { id: titleId },
              {
                riskyNumber: (
                  <SizableText size="$heading2xl" color="$textCritical">
                    {riskyNumber}
                  </SizableText>
                ) as unknown as string,
                inactiveNumber: (
                  <SizableText size="$heading2xl" color="$textCaution">
                    {inactiveNumber}
                  </SizableText>
                ) as unknown as string,
              },
            )}
          </SizableText>
          <SizableText size="$bodyLg" color="$textSubdued">
            {intl.formatMessage({
              id: ETranslations.wallet_approval_summary_suggestion_desc_all,
            })}
          </SizableText>
        </YStack>
      </YStack>
    );
  }, [inactiveNumber, intl, riskyNumber]);

  const renderRevokeSuggestionList = useCallback(() => {
    const shouldShowBadge = riskyNumber > 0 && inactiveNumber > 0;
    return (
      <ApprovalListView
        hideRiskBadge={!shouldShowBadge}
        onPress={handleApprovalItemOnPress}
        accountId={accountId}
        networkId={networkId}
      />
    );
  }, [
    accountId,
    handleApprovalItemOnPress,
    networkId,
    riskyNumber,
    inactiveNumber,
  ]);

  const handleSelectAll = useCallback(() => {
    const selectedTokensTemp = approvalUtils.buildToggleSelectAllTokensMap({
      approvals,
      toggle: !(isSelectAllTokens === true),
    });

    updateSelectedTokens({
      selectedTokens: selectedTokensTemp,
    });
  }, [approvals, isSelectAllTokens, updateSelectedTokens]);

  const handleOnConfirm = useCallback(() => {
    navToRevokeRef.current = true;
    defaultLogger.approval.revokeSuggestion.revokeSuggestionClick({
      type: 'revoke',
      inactiveCount: inactiveNumber,
      riskyCount: riskyNumber,
      selectedTokenCount: selectedCount,
    });
    void navigationToBulkRevokeProcess({
      selectedTokens,
      tokenMap,
      contractMap,
    });
  }, [
    navigationToBulkRevokeProcess,
    selectedTokens,
    tokenMap,
    contractMap,
    inactiveNumber,
    riskyNumber,
    selectedCount,
  ]);
  const handleOnCancel = useCallback(async () => {
    navigation.popStack();
  }, [navigation]);

  const renderBulkRevokeActions = () => {
    return (
      <ApprovalActions
        isSelectAll={isSelectAllTokens}
        setIsSelectAll={handleSelectAll}
        onConfirm={handleOnConfirm}
        onCancel={handleOnCancel}
        onCancelText={intl.formatMessage({
          id: autoShow
            ? ETranslations.global_skip_for_now
            : ETranslations.global_cancel,
        })}
        isBulkRevokeMode
        selectedCount={selectedCount}
        isBuildingRevokeTxs={isBuildingRevokeTxs}
      />
    );
  };

  const handleOnClose = useCallback(async () => {
    if (autoShow && !navToRevokeRef.current) {
      defaultLogger.approval.revokeSuggestion.revokeSuggestionClick({
        type: 'skip',
        inactiveCount: inactiveNumber,
        riskyCount: riskyNumber,
      });

      const tasks: Promise<unknown>[] = [];
      if (riskyNumber > 0) {
        tasks.push(
          backgroundApiProxy.serviceApproval.updateRiskApprovalsRevokeSuggestionConfig(
            {
              networkId,
              accountId,
            },
          ),
        );
      }
      if (inactiveNumber > 0) {
        tasks.push(
          backgroundApiProxy.serviceApproval.updateInactiveApprovalsAlertConfig(
            {
              networkId,
              accountId,
            },
          ),
        );
      }
      if (tasks.length) {
        await Promise.all(tasks);
      }
    }
  }, [autoShow, networkId, accountId, riskyNumber, inactiveNumber]);

  return (
    <Page scrollEnabled onClose={handleOnClose}>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_revoke_suggestion,
        })}
      />
      <Page.Body>
        {renderRevokeSuggestionOverview()}
        {renderRevokeSuggestionList()}
      </Page.Body>
      {renderBulkRevokeActions()}
    </Page>
  );
}

const RevokeSuggestionWithProvider = memo(() => {
  return (
    <ProviderJotaiContextApprovalList>
      <RevokeSuggestion />
    </ProviderJotaiContextApprovalList>
  );
});
RevokeSuggestionWithProvider.displayName = 'RevokeSuggestionWithProvider';

export default RevokeSuggestionWithProvider;
