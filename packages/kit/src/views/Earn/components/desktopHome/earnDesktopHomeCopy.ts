// Demo copy the app has no translation key for yet. Before this layout ships
// these go through the 1k-i18n flow; every other string uses an existing key.
export const EARN_DESKTOP_DEMO_COPY = {
  withdrawals: 'Withdrawals',
  upTo: 'Up to',
  from: 'From',
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
};
