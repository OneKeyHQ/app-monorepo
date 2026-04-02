import { memo, useCallback } from 'react';

import { useIntl } from 'react-intl';

import { Alert, Stack } from '@onekeyhq/components';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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

  const handlePress = useCallback(() => {
    void navigateToApprovalList({
      networkId: network?.id,
      accountId: account?.id,
      walletId: wallet?.id,
      indexedAccountId: account?.indexedAccountId,
    });
  }, [
    navigateToApprovalList,
    network?.id,
    account?.id,
    wallet?.id,
    account?.indexedAccountId,
  ]);

  if (!hasRiskApprovals) {
    return null;
  }

  return (
    <Stack pt="$2" px="$pagePadding" bg="$bgApp">
      <Alert
        type="warning"
        icon="ShieldCheckDoneOutline"
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
