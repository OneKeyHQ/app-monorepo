import type { IContractApproval } from '@onekeyhq/shared/types/approval';

function buildSelectedTokenKey({
  contractAddress,
  tokenAddress,
  networkId,
  accountId,
}: {
  contractAddress: string;
  tokenAddress: string;
  networkId: string;
  accountId: string;
}) {
  return `${accountId}_${networkId}_${contractAddress}_${tokenAddress}`;
}

function parseSelectedTokenKey({
  selectedTokenKey,
}: {
  selectedTokenKey: string;
}) {
  const [accountId, networkId, contractAddress, tokenAddress] =
    selectedTokenKey.split('_');

  return {
    accountId,
    networkId,
    contractAddress,
    tokenAddress,
  };
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

export default {
  buildContractMapKey,
  buildTokenMapKey,
  buildSelectedTokenKey,
  parseSelectedTokenKey,
  buildToggleSelectAllTokensMap,
  checkIsSelectAllTokens,
};
