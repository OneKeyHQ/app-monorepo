import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';

// One payout address form for the earnings card and the payout history. It is
// short enough that the card never clips it, and keeps six characters at the
// end, which is how people check an address.
export function shortenPayoutAddress(address: string): string {
  return accountUtils.shortenAddress({
    address,
    leadingLength: 6,
    trailingLength: 6,
  });
}
