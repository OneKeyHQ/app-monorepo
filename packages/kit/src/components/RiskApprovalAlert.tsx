import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import backgroundApiProxy from '../background/instance/backgroundApiProxy';
import { usePromiseResult } from '../hooks/usePromiseResult';
import { useApprovalsInfoAtom } from '../states/jotai/contexts/accountOverview';
import { useActiveAccount } from '../states/jotai/contexts/accountSelector';
import { useNavigateToApprovalList } from '../views/Home/hooks/useNavigateToApprovalList';

function BasicRiskApprovalAlert() {
  const intl = useIntl();
  const [{ hasRiskApprovals, riskApprovalsCount }] = useApprovalsInfoAtom();
  const navigateToApprovalList = useNavigateToApprovalList();
  const {
    activeAccount: { account, network, wallet },
  } = useActiveAccount({ num: 0 });
  const accountId = account?.id;
  const networkId = network?.id;

  const { result: visibilityResult, setResult: setVisibilityResult } =
    usePromiseResult(
      async () => {
        if (!hasRiskApprovals || !accountId || !networkId) {
          return undefined;
        }

        let shouldShow = true;
        try {
          shouldShow =
            await backgroundApiProxy.serviceApproval.shouldShowRiskApprovalsAlert(
              {
                accountId,
                networkId,
              },
            );
        } catch (error) {
          defaultLogger.approval.revokeSuggestion.consoleError(
            'Failed to read risk approval alert visibility',
            error,
          );
        }

        return {
          accountId,
          networkId,
          shouldShow,
        };
      },
      [accountId, hasRiskApprovals, networkId],
      {
        revalidateOnFocus: true,
        undefinedResultIfReRun: true,
      },
    );

  const handlePress = useCallback(() => {
    void navigateToApprovalList({
      networkId,
      accountId,
      walletId: wallet?.id,
      indexedAccountId: account?.indexedAccountId,
    });
  }, [
    navigateToApprovalList,
    networkId,
    accountId,
    wallet?.id,
    account?.indexedAccountId,
  ]);

  const handleClose = useCallback(async () => {
    if (!accountId || !networkId) {
      return;
    }

    try {
      await backgroundApiProxy.serviceApproval.updateRiskApprovalsAlertConfig({
        accountId,
        networkId,
      });
    } catch (error) {
      defaultLogger.approval.revokeSuggestion.consoleError(
        'Failed to persist risk approval alert dismissal',
        error,
      );
      return;
    }

    setVisibilityResult((current) => {
      if (current?.accountId !== accountId || current.networkId !== networkId) {
        return current;
      }

      return {
        ...current,
        shouldShow: false,
      };
    });
  }, [accountId, networkId, setVisibilityResult]);

  const shouldShowRiskApprovalAlert = Boolean(
    visibilityResult &&
    visibilityResult.accountId === accountId &&
    visibilityResult.networkId === networkId &&
    visibilityResult.shouldShow,
  );

  if (!hasRiskApprovals || !shouldShowRiskApprovalAlert) {
    return null;
  }

  return (
    <Stack
      testID="home-risk-approval-alert"
      pt="$2"
      px="$pagePadding"
      bg="$bgApp"
    >
      <Alert
        type="warning"
        icon="ShieldCheckDoneOutline"
        closable
        onClose={handleClose}
        title={intl.formatMessage(
          { id: ETranslations.wallet_approval_risky_suggestion_title },
          { number: riskApprovalsCount },
        )}
        action={{
          primary: intl.formatMessage({ id: ETranslations.global_view }),
          onPrimaryPress: handlePress,
        }}
      />
    </Stack>
  );
}

export const RiskApprovalAlert = memo(BasicRiskApprovalAlert);
