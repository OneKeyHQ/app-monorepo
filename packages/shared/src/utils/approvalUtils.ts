import type {
  IApproval,
  IContractApproval,
} from '@onekeyhq/shared/types/approval';

const ERC20_APPROVAL_IDENTITY = 'erc20';
const PERMIT2_EXPIRATION_MAX_SECONDS = 281_474_976_710_655;

function buildSelectedTokenKey({
  contractAddress,
  tokenAddress,
  networkId,
  accountId,
  permit2Address,
}: {
  contractAddress: string;
  tokenAddress: string;
  networkId: string;
  accountId: string;
  permit2Address?: string;
}) {
  const approvalIdentity =
    permit2Address?.toLowerCase() || ERC20_APPROVAL_IDENTITY;
  return `${accountId}_${networkId}_${contractAddress}_${tokenAddress}_${approvalIdentity}`;
}

function parseSelectedTokenKey({
  selectedTokenKey,
}: {
  selectedTokenKey: string;
}) {
  const [
    accountId,
    networkId,
    contractAddress,
    tokenAddress,
    approvalIdentity,
  ] = selectedTokenKey.split('_');

  return {
    accountId,
    networkId,
    contractAddress,
    tokenAddress,
    permit2Address:
      approvalIdentity && approvalIdentity !== ERC20_APPROVAL_IDENTITY
        ? approvalIdentity
        : undefined,
  };
}

function normalizePermit2ExpirationMs(expirationMs?: number) {
  if (
    typeof expirationMs !== 'number' ||
    !Number.isFinite(expirationMs) ||
    expirationMs < 0
  ) {
    return undefined;
  }

  const expirationSeconds = Math.round(expirationMs / 1000);
  if (
    !Number.isSafeInteger(expirationSeconds) ||
    expirationSeconds < 0 ||
    expirationSeconds > PERMIT2_EXPIRATION_MAX_SECONDS
  ) {
    return undefined;
  }

  return {
    expirationSeconds: expirationSeconds.toString(),
    isNeverExpires: expirationSeconds === PERMIT2_EXPIRATION_MAX_SECONDS,
  };
}

function isPermit2Approval({
  approval,
}: {
  approval: Pick<IApproval, 'permit2Address'>;
}) {
  return Boolean(approval.permit2Address);
}

function hasPermit2ApprovalMetadata({
  approval,
}: {
  approval: Pick<IApproval, 'permit2Address' | 'expirationMs'>;
}) {
  return (
    approval.permit2Address !== undefined || approval.expirationMs !== undefined
  );
}

function buildToggleSelectAllTokensMap({
  approvals,
  toggle,
}: {
  approvals: IContractApproval[];
  toggle: boolean;
}) {
  const selectedTokensTemp: Record<string, boolean> = {};
  approvals.forEach((item) => {
    item.approvals.forEach((approval) => {
      selectedTokensTemp[
        buildSelectedTokenKey({
          contractAddress: item.contractAddress,
          tokenAddress: approval.tokenAddress,
          networkId: item.networkId,
          accountId: item.accountId,
          permit2Address: approval.permit2Address,
        })
      ] = toggle;
    });
  });
  return selectedTokensTemp;
}

function checkIsSelectAllTokens({
  approvals,
  selectedTokens,
}: {
  approvals: IContractApproval[];
  selectedTokens: Record<string, boolean>;
}) {
  let selectedCount = 0;
  let totalCount = 0;
  let isSelectAllTokens: boolean | 'indeterminate' = false;
  for (const approval of approvals) {
    for (const item of approval.approvals) {
      totalCount += 1;
      if (
        selectedTokens[
          buildSelectedTokenKey({
            networkId: approval.networkId,
            contractAddress: approval.contractAddress,
            tokenAddress: item.tokenAddress,
            accountId: approval.accountId,
            permit2Address: item.permit2Address,
          })
        ]
      ) {
        selectedCount += 1;
      }
    }
  }

  if (selectedCount === totalCount) {
    isSelectAllTokens = true;
  } else if (selectedCount > 0) {
    isSelectAllTokens = 'indeterminate';
  }

  return {
    isSelectAllTokens,
    totalCount,
    selectedCount,
  };
}

function buildContractMapKey({
  networkId,
  contractAddress,
}: {
  networkId: string;
  contractAddress: string;
}) {
  return `${networkId}_${contractAddress}`;
}

function buildTokenMapKey({
  networkId,
  tokenAddress,
}: {
  networkId: string;
  tokenAddress: string;
}) {
  return `${networkId}_${tokenAddress}`;
}

function checkIsExistRiskApprovals({
  contractApprovals,
}: {
  contractApprovals: IContractApproval[];
}) {
  return contractApprovals.some((item) => item.isRiskContract);
}

export default {
  buildContractMapKey,
  buildTokenMapKey,
  buildSelectedTokenKey,
  parseSelectedTokenKey,
  normalizePermit2ExpirationMs,
  isPermit2Approval,
  hasPermit2ApprovalMetadata,
  buildToggleSelectAllTokensMap,
  checkIsSelectAllTokens,
  checkIsExistRiskApprovals,
};
