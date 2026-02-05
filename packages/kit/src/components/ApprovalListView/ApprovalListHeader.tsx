import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import { Alert, SizableText, Stack, YStack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';
import type { IAddressInfo } from '@onekeyhq/shared/types/address';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';
import type { IToken } from '@onekeyhq/shared/types/token';

import backgroundApiProxy from '../../background/instance/backgroundApiProxy';
import useAppNavigation from '../../hooks/useAppNavigation';
import { usePromiseResult } from '../../hooks/usePromiseResult';
import { useApprovalListAtom } from '../../states/jotai/contexts/approvalList';
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
  tokenMap,
  contractMap,
}: {
  recomputeLayout: () => void;
  hideRiskOverview?: boolean;
  tokenMap: Record<
    string,
    {
      price: string;
      price24h: string;
      info: IToken;
    }
  >;
  contractMap: Record<string, IAddressInfo>;
}) {
  const intl = useIntl();

  const navigation = useAppNavigation();

  const { tableLayout, accountId, networkId, indexedAccountId } =
    useApprovalListViewContext();

  // isReady: async result has returned
  // isVisible: layout has been computed, safe to show
  const [isReady, setIsReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [showApprovalsAlert, setShowApprovalsAlert] = useState(false);
  const hasInitialized = useRef(false);

  const [{ approvals }] = useApprovalListAtom();

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
    if (!tableLayout || approvals?.length <= 0 || !isReady) {
      return null;
    }

    return (
      <ListItem
        testID="Wallet-Approval-List-Header"
        opacity={isVisible ? 1 : 0}
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
  }, [intl, tableLayout, approvals?.length, isReady, isVisible]);

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
    if (hideRiskOverview || !isReady) {
      return null;
    }

    const riskyNumber = riskApprovals.length;
    const inactiveNumber = warningApprovals.length;

    if (!showApprovalsAlert || (riskyNumber === 0 && inactiveNumber === 0)) {
      return null;
    }

    return (
      <YStack px="$pagePadding" py="$3" gap="$5" opacity={isVisible ? 1 : 0}>
        <Alert
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
    intl,
    riskApprovals,
    showApprovalsAlert,
    warningApprovals,
    isReady,
    isVisible,
  ]);

  // Step 1: When async result returns, set isReady and showApprovalsAlert
  useEffect(() => {
    if (
      shouldShowInactiveApprovalsAlert === undefined &&
      shouldShowRiskApprovalsAlert === undefined
    ) {
      return;
    }

    if (hasInitialized.current) {
      return;
    }
    hasInitialized.current = true;

    const targetShow = !!(
      shouldShowInactiveApprovalsAlert || shouldShowRiskApprovalsAlert
    );

    setShowApprovalsAlert(targetShow);
    setIsReady(true);

    // Use requestAnimationFrame to wait for the next paint,
    // then recompute layout and show content
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        recomputeLayout();
        setIsVisible(true);
      });
    });
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
