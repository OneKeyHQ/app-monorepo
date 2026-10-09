// Hardcoded English until copy review; then move to Lokalise keys.
export const INVITE_COPY = {
  benefitsTab: 'Rewards',
  benefitsEmptyTitle: 'No rewards yet',
  benefitsEmptyDescription: 'Rewards you get as an invitee will show up here',
  headline: 'Invite friends, earn rewards',
  copyLink: 'Copy link',
  inviteFriends: 'Invite friends',
  rateLabel: 'Rate (you / invitee)',
  upTo: 'Up to',
  manageCodes: 'Manage codes',
  referrals: 'Referrals',
  codesTab: 'Codes',
  bindTitle: 'Invited by a friend?',
  bindDescription: 'Enter their referral code',
  boundTitle: 'Invited by a friend',
  boundDescription: 'Referral code linked',
  totalEarned: 'Total earned',
  rewardsByProduct: 'Earnings by product',
  payoutHistory: 'Payout history',
  rewardsEmptyHint:
    'Rewards show up here once friends you invite buy hardware or pay fees.',
  product: 'Product',
  codesRemaining: (remaining: number, max: number) => {
    if (remaining <= 0) {
      return `You've used all ${max} codes`;
    }
    return remaining === 1
      ? 'You can create 1 more code'
      : `You can create ${remaining} more codes`;
  },
  codeDefault: 'Default',
  codeStats: (orders: number, wallets: number) =>
    `${orders} ${orders === 1 ? 'order' : 'orders'} · ${wallets} ${
      wallets === 1 ? 'wallet' : 'wallets'
    } ·`,
  codeEarned: 'earned',
  codeCreated: (date: string) => `Created ${date}`,
} as const;
