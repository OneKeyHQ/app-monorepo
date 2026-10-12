import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

export interface IOffTabTokenListRefreshTarget {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
}

// Regular single-network fetching is gated on the Portfolio tab. Resolve an
// explicit refresh on mount or owner changes while another tab is active so
// the shared header follows the current account. All Networks uses the fan-out
// hook, which is not gated on the inner tab.
export function resolveOffTabTokenListRefreshOnMount({
  accountId,
  networkId,
  indexedAccountId,
  activeTabId,
}: {
  accountId: string | undefined;
  networkId: string | undefined;
  indexedAccountId: string | undefined;
  activeTabId: EHomeWalletTab | undefined;
}): IOffTabTokenListRefreshTarget | undefined {
  if (!activeTabId || activeTabId === EHomeWalletTab.Portfolio) {
    return undefined;
  }
  if (!accountId || !networkId) {
    return undefined;
  }
  if (networkUtils.isAllNetwork({ networkId })) {
    return undefined;
  }
  return { accountId, networkId, indexedAccountId };
}
