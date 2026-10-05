import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import type { IContractApproval } from '@onekeyhq/shared/types/approval';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

// Shows the caution dot for risk approvals the user has not reviewed. Opening
// Approvals marks them reviewed; they resurface after the configured window.
export async function shouldShowRiskApprovalsDot({
  contractApprovals,
  accountId,
  networkId,
}: {
  contractApprovals: Pick<IContractApproval, 'isRiskContract'>[];
  accountId: string;
  networkId: string;
}): Promise<boolean> {
  if (!contractApprovals.some((item) => item.isRiskContract)) {
    return false;
  }
  try {
    return await backgroundApiProxy.serviceApproval.shouldShowRiskApprovalsAlert(
      { accountId, networkId },
    );
  } catch (error) {
    defaultLogger.approval.revokeSuggestion.consoleError(
      'Failed to read risk approval dot visibility',
      error,
    );
    return true;
  }
}
