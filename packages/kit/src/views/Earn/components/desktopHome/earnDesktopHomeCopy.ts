// Demo copy the app has no translation key for yet. Before this layout ships
// these go through the 1k-i18n flow; every other string uses an existing key.
export const EARN_DESKTOP_DEMO_COPY = {
  withdrawals: 'Withdrawals',
  aYear: 'a year',
  more: (count: number) => `${count} more`,
  // Pay with, and the swap-then-deposit path the demo simulates. The real
  // deposit form takes "Est. annual rewards" from the server
  payWith: 'Pay with',
  swapAnd: (action: string) => `Swap and ${action}`,
  estAnnualRewards: 'Est. annual rewards',
  // After a withdrawal: the same token's better rate on the same network,
  // against the rate the withdrawal left
  earnMoreOn: (symbol: string) => `Earn more on ${symbol}`,
  paysRate: (protocol: string, rate: string) => `${protocol} pays ${rate}`,
  // The hero without positions: the wallet's tokens that can earn here
  readyToEarn: 'Ready to earn',
  readyToEarnInfo:
    'What the tokens under Earns on your holding are worth, and about what they would earn in a year, each at the rate its row shows. Rates change.',
};
