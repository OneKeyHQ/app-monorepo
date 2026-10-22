// Demo copy the app has no translation key for yet. Before this layout ships
// these go through the 1k-i18n flow; every other string uses an existing key.
export const EARN_DESKTOP_DEMO_COPY = {
  withdrawals: 'Withdrawals',
  aYear: 'a year',
  more: (count: number) => `${count} more`,
  // Pay with, and the swap-then-deposit path. The real deposit form takes
  // "Est. annual rewards" from the server
  payWith: 'Pay with',
  // Under the Pay with box: about what the swap brings into the vault
  youDeposit: 'You deposit',
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
  // Loans as collateral and borrow pairs
  inYourWallet: 'In your wallet',
  showMore: (count: number) => `Show ${count} more`,
  loanNetApyInfo: (ltv: string) =>
    `What the collateral earns less what the loan costs in a year, over your net worth in the market. Worked out for a loan of half the collateral's value (${ltv} LTV), so every row compares the same loan. Pairs that can't lend that much aren't listed.`,
  // The guide for a wallet without positions: the card's rows, and the
  // short names the card's button and the modal's steps use
  guideTitle: 'Start earning in 4 steps',
  guideSteps: [
    'Add ETH for network fees',
    'Choose a vault',
    'Deposit USDC',
    'View your position',
  ],
  guideActions: ['Add ETH', 'Choose vault', 'Deposit', 'View position'],
  guideGasTitle: 'Add ETH on Base',
  guideGasBody: (amount: string) =>
    `Network fees are paid in ETH, not USDC. Add about ${amount} ETH, enough for this deposit and a later withdrawal.`,
  guideGasWaiting: 'Waiting for ETH',
  guideGasReceived: 'ETH received',
  guideConnect: 'Connect a wallet to get your Base address.',
  guideVaultTitle: 'Choose a vault',
  guideVaultBody:
    'A vault lends your USDC to borrowers and pays you the interest. These vaults are on Base, where network fees are a few cents.',
  guideUseVault: 'Use this vault',
  guideDepositTitle: 'Deposit USDC',
  guideWithdrawNote:
    "Withdraw anytime from your position: your USDC and what it earned come back to this wallet, unless the vault's funds are all lent out at that moment.",
  guideDoneTitle: "You're earning",
  guideDoneBody:
    'Your deposit is on the positions page, with Redeem on its row.',
  guideGoToPosition: 'Go to position',
  guideHide: 'Hide guide',
};
