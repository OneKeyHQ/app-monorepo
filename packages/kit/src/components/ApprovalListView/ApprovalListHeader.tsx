import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';
import { EContractApprovalAlertType } from '@onekeyhq/shared/types/approval';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import {
  useApprovalListAtom,
  useContractMapAtom,
  useTokenMapAtom,
} from '../../states/jotai/contexts/approvalList';
import { ListItem } from '../ListItem';

import { useApprovalListViewContext } from './ApprovalListViewContext';

function HeaderItem({ label }: { label: string }) {
  return (
    <SizableText size="$bodyMdMedium" color="$textSubdued" userSelect="none">
      {label}
    </SizableText>
  );
}

function ApprovalListHeader({
  recomputeLayout,
}: {
  recomputeLayout: () => void;
}) {
  const intl = useIntl();

  const navigation = useAppNavigation();

  const { tableLayout, accountId, networkId } = useApprovalListViewContext();

  const [showInactiveApprovalsAlert, setShowInactiveApprovalsAlert] =
    useState(false);

  const [inactiveApprovalsAlertOpacity, setInactiveApprovalsAlertOpacity] =
    useState(0);
  const [tableHeaderOpacity, setTableHeaderOpacity] = useState(0);

  const { result: shouldShowInactiveApprovalsAlert } =
    usePromiseResult(async () => {
      return backgroundApiProxy.serviceApproval.shouldShowInactiveApprovalsAlert(
        {
          accountId,
          networkId,
        },
      );
    }, [accountId, networkId]);

  const renderTableHeader = useCallback(() => {
    if (!tableLayout) {
      return null;
    }

    return (
      <ListItem
        testID="Wallet-Approval-List-Header"
        opacity={tableHeaderOpacity}
      >
        <Stack flexGrow={1} flexBasis={0} alignItems="flex-start">
          <HeaderItem
            label={intl.formatMessage({ id: ETranslations.global_contract })}
          />
        </Stack>
        <Stack flexGrow={1} flexBasis={0}>
          <HeaderItem
            label={intl.formatMessage({
              id: ETranslations.global_contract_address,
            })}
          />
        </Stack>
        <Stack flexGrow={1} flexBasis={0}>
          <HeaderItem
            label={intl.formatMessage({
              id: ETranslations.global_approval_time,
            })}
          />
        </Stack>
        <Stack flexGrow={1} flexBasis={0} alignItems="flex-end" maxWidth="$36">
          <HeaderItem
            label={intl.formatMessage({
              id: ETranslations.wallet_approval_approved_token,
            })}
          />
        </Stack>
      </ListItem>
    );
  }, [intl, tableLayout, tableHeaderOpacity]);

  const [{ approvals }] = useApprovalListAtom();
  const [{ tokenMap }] = useTokenMapAtom();
  const [{ contractMap }] = useContractMapAtom();

  const handleViewRiskApprovals = useCallback(
    ({
      alertType,
      approvals: _approvals,
    }: {
      alertType: EContractApprovalAlertType;
      approvals: IContractApproval[];
    }) => {
      navigation.pushModal(EModalRoutes.ApprovalManagementModal, {
        screen: EModalApprovalManagementRoutes.RevokeSuggestion,
        params: {
          approvals: _approvals,
          contractMap,
          tokenMap,
          alertType,
          accountId,
          networkId,
        },
      });
    },
    [navigation, contractMap, tokenMap, accountId, networkId],
  );

  const { riskApprovals, warningApprovals } = useMemo(() => {
    return approvals.reduce<{
      riskApprovals: IContractApproval[];
      warningApprovals: IContractApproval[];
    }>(
      (acc, approval) => {
        if (approval.isRiskContract) {
          acc.riskApprovals.push(approval);
        } else if (approval.isInactiveApproval) {
          acc.warningApprovals.push(approval);
        }
        return acc;
      },
      { riskApprovals: [], warningApprovals: [] },
    );
  }, [approvals]);

  const handleCloseInactiveApprovalsAlert = useCallback(async () => {
    await backgroundApiProxy.serviceApproval.updateInactiveApprovalsAlertConfig(
      {
        accountId,
        networkId,
      },
    );
    setShowInactiveApprovalsAlert(false);
    setTimeout(() => {
      recomputeLayout();
    }, 350);
  }, [accountId, networkId, recomputeLayout]);

  const renderRiskOverview = useCallback(() => {
    if (
      riskApprovals.length === 0 &&
      (warningApprovals.length === 0 || !showInactiveApprovalsAlert)
    ) {
      return null;
    }

    return (
      <YStack px="$5" py="$3" gap="$5">
        {riskApprovals.length > 0 ? (
          <Alert
            icon="ShieldExclamationOutline"
            title={intl.formatMessage({
              id: ETranslations.wallet_revoke_suggestion,
            })}
            description={intl.formatMessage(
              {
                id: ETranslations.wallet_approval_risky_suggestion_title,
              },
              {
                number: (
                  <SizableText color="$textCritical">
                    {riskApprovals.length}
                  </SizableText>
                ) as unknown as string,
              },
            )}
            type="danger"
            action={{
              primary: intl.formatMessage({
                id: ETranslations.global_view,
              }),
              onPrimaryPress: () => {
                handleViewRiskApprovals({
                  alertType: EContractApprovalAlertType.Risk,
                  approvals: riskApprovals,
                });
              },
            }}
          />
        ) : null}
        {shouldShowInactiveApprovalsAlert && warningApprovals.length > 0 ? (
          <Alert
            opacity={inactiveApprovalsAlertOpacity}
            onClose={handleCloseInactiveApprovalsAlert}
            icon="ShieldExclamationOutline"
            title={intl.formatMessage({
              id: ETranslations.wallet_revoke_suggestion,
            })}
            description={intl.formatMessage(
              {
                id: ETranslations.wallet_approval_inactive_suggestion_title,
              },
              {
                number: (
                  <SizableText size="$bodyMdMedium" color="$textCaution">
                    {warningApprovals.length}
                  </SizableText>
                ) as unknown as string,
              },
            )}
            closable
            type="warning"
            action={{
              primary: intl.formatMessage({
                id: ETranslations.global_view,
              }),
              onPrimaryPress: () => {
                handleViewRiskApprovals({
                  alertType: EContractApprovalAlertType.Warning,
                  approvals: warningApprovals,
                });
              },
            }}
          />
        ) : null}
      </YStack>
    );
  }, [
    handleCloseInactiveApprovalsAlert,
    handleViewRiskApprovals,
    inactiveApprovalsAlertOpacity,
    intl,
    riskApprovals,
    shouldShowInactiveApprovalsAlert,
    showInactiveApprovalsAlert,
    warningApprovals,
  ]);

  useEffect(() => {
    setShowInactiveApprovalsAlert(!!shouldShowInactiveApprovalsAlert);

    setTimeout(() => {
      recomputeLayout();
      if (shouldShowInactiveApprovalsAlert) {
        setInactiveApprovalsAlertOpacity(1);
      }
      setTableHeaderOpacity(1);
    }, 350);
  }, [shouldShowInactiveApprovalsAlert, recomputeLayout]);

  return (
    <>
      {renderRiskOverview()}
      {renderTableHeader()}
    </>
  );
}

export default memo(ApprovalListHeader);
