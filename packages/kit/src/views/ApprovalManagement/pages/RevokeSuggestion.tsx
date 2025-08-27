import { memo, useCallback, useMemo, useState } from 'react';

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
import type {
  EModalApprovalManagementRoutes,
  IModalApprovalManagementParamList,
} from '@onekeyhq/shared/src/routes/approvalManagement';
import { EContractApprovalAlertType } from '@onekeyhq/shared/types/approval';

import { ApprovalListView } from '../../../components/ApprovalListView';
import { HomeApprovalListProviderMirror } from '../../Home/components/HomeApprovalListProvider/HomeApprovalListProviderMirror';
import { ApprovalManagementContext } from '../components/ApprovalManagementContext';

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
  const { approvals, alertType } = route.params;
  const renderRevokeSuggestionOverview = useCallback(() => {
    return (
      <YStack p="$5" gap="$4">
        <XStack>
          <Stack
            borderRadius="$full"
            bg={
              alertType === EContractApprovalAlertType.Warning
                ? '$bgCaution'
                : '$bgCritical'
            }
            p="$3"
          >
            <Icon
              name="ShieldExclamationOutline"
              size="$8"
              color={
                alertType === EContractApprovalAlertType.Warning
                  ? '$iconCaution'
                  : '$iconCritical'
              }
            />
          </Stack>
        </XStack>
        <YStack gap="$1">
          <SizableText size="$heading2xl">
            {intl.formatMessage(
              {
                id:
                  alertType === EContractApprovalAlertType.Warning
                    ? ETranslations.wallet_approval_inactive_suggestion_title
                    : ETranslations.wallet_approval_risky_suggestion_title,
              },
              {
                number: (
                  <SizableText
                    size="$heading2xl"
                    color={
                      alertType === EContractApprovalAlertType.Warning
                        ? '$textCaution'
                        : '$textCritical'
                    }
                  >
                    {approvals.length}
                  </SizableText>
                ),
              },
            )}
          </SizableText>
          <SizableText size="$bodyMd" color="$textSubdued">
            {intl.formatMessage({
              id:
                alertType === EContractApprovalAlertType.Warning
                  ? ETranslations.wallet_approval_inactive_suggestion_description
                  : ETranslations.wallet_approval_risky_detected_suggestion_description,
            })}
          </SizableText>
        </YStack>
      </YStack>
    );
  }, [alertType, approvals, intl]);

  const renderRevokeSuggestionList = useCallback(() => {
    return (
      <YStack p="$5" gap="$4">
        <ApprovalListView />
      </YStack>
    );
  }, []);

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.wallet_revoke_suggestion,
        })}
      />
      <Page.Body>
        {renderRevokeSuggestionOverview()}
        {renderRevokeSuggestionList()}
      </Page.Body>
    </Page>
  );
}

const RevokeSuggestionWithProvider = memo(() => {
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
        <RevokeSuggestion />
      </ApprovalManagementContext.Provider>
    </HomeApprovalListProviderMirror>
  );
});
RevokeSuggestionWithProvider.displayName = 'RevokeSuggestionWithProvider';

export default RevokeSuggestionWithProvider;
