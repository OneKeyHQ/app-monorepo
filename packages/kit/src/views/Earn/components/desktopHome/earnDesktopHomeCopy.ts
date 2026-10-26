// Demo copy the app has no translation key for yet. Before this layout ships
// these go through the 1k-i18n flow; every other string uses an existing key.
const PENDLE_RATE_ROW_TITLES = ['Effective Fixed APY', 'Market Reference APY'];

export const EARN_DESKTOP_DEMO_COPY = {
  withdrawals: 'Withdrawals',
  aYear: 'a year',
  more: (count: number) => `${count} more`,
  // Pay with, and the swap-then-deposit path. The real deposit form takes
  // "Est. annual rewards" from the server
  payWith: 'Pay with',
  // Under the Pay with box: about what the swap brings in, in the button's
  // word (Supply on a lending market)
  youDeposit: 'You deposit',
  youSupply: 'You supply',
  swapAnd: (action: string) => `Swap and ${action}`,
  // A lending form's one press that approves, then supplies or repays, named
  // as the vaults' "Approve and Deposit" is
  approveAnd: (action: string) => `Approve and ${action}`,
  estAnnualRewards: 'Est. annual rewards',
  // Pendle's result before its first quote, in the server's own words for
  // it once the quote is in
  atMaturityYouGet: 'At Maturity You Get',
  // The rows a Pendle quote brings first, also in its own words, held in
  // place with dashes until the first quote is in
  pendleRowTitles: [...PENDLE_RATE_ROW_TITLES, 'Min. Received'],
  // Paying with a token Pendle doesn't take, swap then buy: the rates only,
  // as the buy's own figures come with its quote at the second step
  pendleRateRowTitles: PENDLE_RATE_ROW_TITLES,
  // After a withdrawal: the same token's better rate on the same network,
  // against the rate the withdrawal left
  earnMoreOn: (symbol: string) => `Earn more on ${symbol}`,
  paysRate: (protocol: string, rate: string) => `${protocol} pays ${rate}`,
  // Under "Transaction submitted" once a deposit or withdrawal is out
  depositedTo: (amount: string, target: string) => `${amount} to ${target}`,
  withdrewFrom: (amount: string, target: string) => `${amount} from ${target}`,
  // The hero without positions: the wallet's tokens that can earn here
  readyToEarn: 'Ready to earn',
  readyToEarnInfo:
    'What the tokens under Earns on your holding are worth, and about what they would earn in a year, each at the rate its row shows. Rates change.',
  // Loans as collateral and borrow pairs
  inYourWallet: 'In your wallet',
  showMore: (count: number) => `Show ${count} more`,
  loanNetApyHeader: (ltv: string) => `Net APY (${ltv} LTV)`,
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
};
