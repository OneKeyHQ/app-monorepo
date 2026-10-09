// Hardcoded English until copy review; then move to Lokalise keys. Each
// entry is a whole sentence with named `{params}`, matching the planned key.
export const INVITE_COPY = {
  perksTab: 'Perks',
  perksEmptyTitle: 'No perks yet',
  perksEmptyDescription: 'To get fee discounts, enter a referral code',
  enterReferralCode: 'Enter referral code',
  title: 'Invite friends, earn together',
  // The rate line: what the referrer earns and what invitees save. Products
  // with different rates read "up to" the highest; without an invitee
  // discount only the referrer's part shows.
  rateLine: 'You earn {rate} · Invitees save {inviteeRate}',
  rateLineUpTo: 'You earn up to {rate} · Invitees save up to {inviteeRate}',
  youEarn: 'You earn {rate}',
  youEarnUpTo: 'You earn up to {rate}',
  earningsTitle: 'Earnings',
  copyLink: 'Copy link',
  inviteFriends: 'Invite friends',
  manageCodes: 'Manage codes',
  bindQuestion: 'Invited by a friend?',
  bound: 'Referral code linked',
  nextPayout: 'Next payout {date}',
  earningsByProduct: 'Earnings by product',
  noEarnings: 'No earnings yet',
  earningsEmptyHint: 'Earnings appear after invitees buy hardware or trade',
  payoutHistory: 'Payout history',
  product: 'Product',
  // Per-product rate rows in the rate breakdown: what each rate applies to.
  hardwareSalesRate: 'Hardware sales',
  perpsFeesRate: 'Perps fees',
  swapFeesRate: 'Swap fees',
  defiFeesRate: 'DeFi fees',
  inviteeColumn: 'Invitee',
  // ICU plural in Lokalise:
  // {count, plural, one {# more code available} other {# more codes available}}
  codesRemaining: (count: number) =>
    count === 1 ? '1 more code available' : `${count} more codes available`,
  codesUsedUp: 'All {max} codes used',
  // Facts on a code row, one phrase each so a narrow row wraps between them.
  // ICU plural in Lokalise: {count, plural, one {# order} other {# orders}}
  codeOrders: (count: number) => (count === 1 ? '1 order' : `${count} orders`),
  // ICU plural in Lokalise: {count, plural, one {# wallet} other {# wallets}}
  codeWallets: (count: number) =>
    count === 1 ? '1 wallet' : `${count} wallets`,
  codeEarned: '{amount} earned',
  codeDefault: 'Default',
  codeCreated: 'Created {date}',
  walletName: 'Wallet {number}',
  inviteesEmpty: 'No invitees yet',
} as const;
