import networkUtils from '@onekeyhq/shared/src/utils/networkUtils';
import { EHomeWalletTab } from '@onekeyhq/shared/types/wallet';

export interface IOffTabTokenListRefreshTarget {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
}

// The wallet (spot) token list fetches only while its tab is focused, and it
// is remounted for every account switch. When that happens while another
// home tab is active, nothing fetches the new owner until the user returns,
// so the always-visible header worth stays on a skeleton. Resolve the
// explicit single-network refresh the freshly mounted list should run for
// its owner instead. All Networks is left to the fan-out hook, which is not
// gated on the inner tab.
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
