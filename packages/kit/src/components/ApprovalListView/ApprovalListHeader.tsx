import { memo, useCallback, useEffect, useMemo, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

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
  hideRiskOverview,
}: {
  recomputeLayout: () => void;
  hideRiskOverview?: boolean;
}) {
  const intl = useIntl();

  const navigation = useAppNavigation();

  const { tableLayout, accountId, networkId, indexedAccountId } =
    useApprovalListViewContext();

  const [showApprovalsAlert, setShowApprovalsAlert] = useState(false);
  const [approvalsAlertOpacity, setApprovalsAlertOpacity] = useState(0);
  const [tableHeaderOpacity, setTableHeaderOpacity] = useState(0);

  const [{ approvals }] = useApprovalListAtom();
  const [{ tokenMap }] = useTokenMapAtom();
  const [{ contractMap }] = useContractMapAtom();

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

  const { result } = usePromiseResult(async () => {
    const [_shouldShowInactiveApprovalsAlert, _shouldShowRiskApprovalsAlert] =
      await Promise.all([
        backgroundApiProxy.serviceApproval.shouldShowInactiveApprovalsAlert({
          accountId,
          networkId,
        }),
        backgroundApiProxy.serviceApproval.shouldShowRiskApprovalsAlert({
          accountId,
          networkId,
        }),
      ]);
    return {
      shouldShowInactiveApprovalsAlert:
        _shouldShowInactiveApprovalsAlert && warningApprovals.length > 0,
      shouldShowRiskApprovalsAlert:
        _shouldShowRiskApprovalsAlert && riskApprovals.length > 0,
    };
  }, [accountId, networkId, riskApprovals.length, warningApprovals.length]);

  const { shouldShowInactiveApprovalsAlert, shouldShowRiskApprovalsAlert } =
    result ?? {};

  const renderTableHeader = useCallback(() => {
    if (!tableLayout || approvals?.length <= 0) {
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
              id: ETranslations.wallet_approval_approved_token,
            })}
          />
        </Stack>
        <Stack flexGrow={1} flexBasis={0} alignItems="flex-end" maxWidth="$36">
          <HeaderItem
            label={intl.formatMessage({
              id: ETranslations.global_approval_time,
            })}
          />
        </Stack>
      </ListItem>
    );
  }, [intl, tableLayout, tableHeaderOpacity, approvals?.length]);

  const handleViewRiskApprovals = useCallback(
    ({ approvals: _approvals }: { approvals: IContractApproval[] }) => {
      navigation.pushModal(EModalRoutes.ApprovalManagementModal, {
        screen: EModalApprovalManagementRoutes.RevokeSuggestion,
        params: {
          approvals: _approvals,
          contractMap,
          tokenMap,
          accountId,
          networkId,
          indexedAccountId,
        },
      });
    },
    [navigation, contractMap, tokenMap, accountId, networkId, indexedAccountId],
  );

  const handleCloseApprovalsAlert = useCallback(async () => {
    const tasks = [];

    if (riskApprovals.length > 0) {
      tasks.push(
        backgroundApiProxy.serviceApproval.updateRiskApprovalsAlertConfig({
          accountId,
          networkId,
        }),
      );
    }

    if (warningApprovals.length > 0) {
      tasks.push(
        backgroundApiProxy.serviceApproval.updateInactiveApprovalsAlertConfig({
          accountId,
          networkId,
        }),
      );
    }

    await Promise.all(tasks);

    setShowApprovalsAlert(false);
    setTimeout(() => {
      recomputeLayout();
    }, 350);
  }, [
    accountId,
    networkId,
    recomputeLayout,
    riskApprovals.length,
    warningApprovals.length,
  ]);

  const renderRiskOverview = useCallback(() => {
    if (hideRiskOverview) {
      return null;
    }

    const riskyNumber = riskApprovals.length;
    const inactiveNumber = warningApprovals.length;

    if (!showApprovalsAlert || (riskyNumber === 0 && inactiveNumber === 0)) {
      return null;
    }

    return (
      <YStack px="$5" py="$3" gap="$5">
        <Alert
          opacity={approvalsAlertOpacity}
          onClose={handleCloseApprovalsAlert}
          icon="ShieldExclamationOutline"
          title={intl.formatMessage({
            id: ETranslations.wallet_revoke_suggestion,
          })}
          description={(() => {
            if (riskyNumber > 0 && inactiveNumber > 0) {
              return intl.formatMessage(
                { id: ETranslations.wallet_approval_alert_title_summary },
                {
                  riskyNumber: (
                    <SizableText color="$textCritical">
                      {riskyNumber}
                    </SizableText>
                  ) as unknown as string,
                  inactiveNumber: (
                    <SizableText color="$textCaution">
                      {inactiveNumber}
                    </SizableText>
                  ) as unknown as string,
                },
              );
            }
            if (riskyNumber > 0) {
              return intl.formatMessage(
                { id: ETranslations.wallet_approval_risky_suggestion_title },
                {
                  number: (
                    <SizableText color="$textCritical">
                      {riskyNumber}
                    </SizableText>
                  ) as unknown as string,
                },
              );
            }
            return intl.formatMessage(
              { id: ETranslations.wallet_approval_inactive_suggestion_title },
              {
                number: (
                  <SizableText color="$textCaution">
                    {inactiveNumber}
                  </SizableText>
                ) as unknown as string,
              },
            );
          })()}
          closable
          type={riskyNumber > 0 ? 'danger' : 'warning'}
          action={{
            primary: intl.formatMessage({ id: ETranslations.global_view }),
            onPrimaryPress: () => {
              let approvalsToView: IContractApproval[] = [];
              if (riskyNumber > 0 && inactiveNumber > 0) {
                approvalsToView = [...riskApprovals, ...warningApprovals];
              } else if (riskyNumber > 0) {
                approvalsToView = riskApprovals;
              } else {
                approvalsToView = warningApprovals;
              }
              handleViewRiskApprovals({ approvals: approvalsToView });
            },
          }}
        />
      </YStack>
    );
  }, [
    handleCloseApprovalsAlert,
    handleViewRiskApprovals,
    hideRiskOverview,
    approvalsAlertOpacity,
    intl,
    riskApprovals,
    showApprovalsAlert,
    warningApprovals,
  ]);

  useEffect(() => {
    const targetShow = !!(
      shouldShowInactiveApprovalsAlert || shouldShowRiskApprovalsAlert
    );
    setShowApprovalsAlert(targetShow);

    setTimeout(() => {
      recomputeLayout();
      if (targetShow) {
        setApprovalsAlertOpacity(1);
      }
      setTableHeaderOpacity(1);
    }, 350);
  }, [
    shouldShowInactiveApprovalsAlert,
    shouldShowRiskApprovalsAlert,
    recomputeLayout,
  ]);

  return (
    <YStack>
      {renderRiskOverview()}
      {renderTableHeader()}
    </YStack>
  );
}

export default memo(ApprovalListHeader);
