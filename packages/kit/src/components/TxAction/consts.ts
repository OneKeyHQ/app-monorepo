import { ETranslations } from '@onekeyhq/shared/src/locale';

import type { IntlShape } from 'react-intl';

// Max number of individual transfer rows rendered for a single transaction —
// both in the history list row (tableLayout expanded change column) and on the
// history detail page. Beyond this, a single "+N" overflow line is shown
// instead of listing every transfer.
//
// This bounds render work for txs that move many assets in one transaction
// (notably airdrops of thousands of NFTs — each NFT has a unique
// tokenIdOnNetwork so they don't group into one line). Without the cap, the
// list row / detail page would mount thousands of rows plus thousands of remote
// images and freeze the UI. See OK-55756.
export const MAX_DISPLAYED_TRANSFERS = 5;

// Label for the "+N" overflow row: "+N NFTs" when the hidden transfers are all
// NFTs (hardcoded — "NFT" is not translated), otherwise "+N assets" reusing the
// existing count_assets entry. Shared by the list row and the detail page.
// Callers never collapse a single trailing transfer (see MAX_DISPLAYED_TRANSFERS
// usage), so `count` is always >= 2 and the plural-only count_assets string is
// grammatically correct.
export function formatTransferOverflowLabel({
  count,
  isNFT,
  intl,
}: {
  count: number;
  isNFT: boolean;
  intl: IntlShape;
}): string {
  if (isNFT) {
    return `+${count} NFT${count > 1 ? 's' : ''}`;
  }
  return `+${intl.formatMessage(
    { id: ETranslations.count_assets },
    { count },
  )}`;
}
