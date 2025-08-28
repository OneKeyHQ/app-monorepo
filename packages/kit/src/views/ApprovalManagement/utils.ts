import type { IContractApproval } from '@onekeyhq/shared/types/approval';

function buildSelectedTokenKey({
  contractAddress,
  tokenAddress,
  networkId,
}: {
  contractAddress: string;
  tokenAddress: string;
  networkId: string;
}) {
  return `${networkId}_${contractAddress}_${tokenAddress}`;
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

export {
  buildSelectedTokenKey,
  buildToggleSelectAllTokensMap,
  checkIsSelectAllTokens,
};
