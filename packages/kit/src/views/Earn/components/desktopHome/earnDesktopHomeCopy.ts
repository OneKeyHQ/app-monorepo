// Demo copy the app has no translation key for yet. Before this layout ships
// these go through the 1k-i18n flow; every other string uses an existing key.
const PENDLE_RATE_ROW_TITLES = ['Effective Fixed APY', 'Market Reference APY'];

export const EARN_DESKTOP_DEMO_COPY = {
  withdrawals: 'Withdrawals',
  // A lending market's Earn details page names its first section as a
  // vault's page does (the server's word there)
  intro: 'Intro',
  aYear: 'a year',
  more: (count: number) => `${count} more`,
  // Pay with, and the swap-then-deposit path
  payWith: 'Pay with',
  // Under the Pay with box: about what the swap brings in, in the button's
  // word (Supply on a lending market)
  youDeposit: 'You deposit',
  youSupply: 'You supply',
  swapAnd: (action: string) => `Swap and ${action}`,
  // Pay with's token on another network: bridged there first (11-05)
  bridgeAnd: (action: string) => `Bridge and ${action}`,
  // A lending form's one press that approves, then supplies or repays, named
  // as the vaults' "Approve and Deposit" is
  approveAnd: (action: string) => `Approve and ${action}`,
  // The interest an amount earns in a year, named as "Est. 24h earnings" is:
  // "rewards" are what is claimed
  estAnnualRewards: 'Est. annual earnings',
  // Under a lending form's Health Factor: a supply that is collateral
  alsoBacksLoan: (market?: string) =>
    market ? `Also backs your ${market} loan` : 'Also backs your loan',
  // Pendle's result before its first quote, in the server's own words for
  // it once the quote is in
  atMaturityYouGet: 'At Maturity You Get',
  // The rows a Pendle quote brings first, also in its own words, held in
  // place with dashes until the first quote is in
  pendleRowTitles: [...PENDLE_RATE_ROW_TITLES, 'Min. Received'],
  // Sell Early before its first quote, in the server's own words for them:
  // the rows a sell quote brings, held in place with dashes, the rows in
  // "Details" and the note under them
  pendleSellRowTitles: [
    'Effective Fixed APY',
    'Maturity',
    'At Maturity You Get',
  ],
  pendleSellDetailTitles: ['Market Reference APY', 'Min. Received', 'Fee'],
  pendleSellNote:
    'Selling Early May Result in a Lower Value Than Holding to Maturity',
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
    'See it in My portfolio',
  ],
  // The step names the card's button and the modal's steps show: the card's
  // rows, shortened only where a row is a sentence
  guideActions: ['Add ETH', 'Choose a vault', 'Deposit', 'My portfolio'],
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
    "Withdraw anytime from My portfolio: your USDC and what it earned come back to this wallet, unless the vault's funds are all lent out at that moment.",
  guideDoneTitle: "You're earning",
  guideDoneBody: 'Your deposit is in My portfolio, with Withdraw on its row.',
  guideGoToPortfolio: 'My portfolio',
  // The Loans router: a collateral and a loan, and the markets that take them
  supplyAndBorrow: 'Supply and Borrow',
  // Paid with another token: the swap that brings the collateral first
  swapSupplyAndBorrow: 'Swap, Supply and Borrow',
  loanLtv: 'LTV',
  // The bar before anything is typed: the position's own (demo 10-29)
  loanCurrentLtv: 'Current LTV',
  // Under the LTV bar's wall
  loanMaxShort: (ltv: string) => `Max ${ltv}`,
  loanPositionTitle: (market: string) => `Your ${market} position`,
  // The account's loans, a card per market, above the Loans list
  yourLoans: 'Your loans',
  loanPoolInfo:
    'Everything you supply here as collateral backs every loan here. If Health Factor falls below 1, any of it can be sold.',
  loanLiquidationPrice: 'Liquidation Price',
  loanBelowNow: (percent: string) => `${percent} below now`,
  loanNoAccount: (network: string) => `This account can't use ${network}`,
  // Pay with's balance when the wallet holds nothing on the network
  noFundsOnNetwork: (network: string) => `No funds on ${network}`,
  // After the Earn window's pick: the network it is on
  onNetwork: (network: string) => `on ${network}`,
  // The Earn window's picked card: what tells the offer apart
  bonusApy: 'Bonus APY',
  bonusEnds: 'Bonus ends',
  // How long the bonus has left; its date shows on hover
  inDays: (days: number) => (days === 1 ? 'in 1 day' : `in ${days} days`),
  maturity: 'Maturity',
  fixedRateEarlySale: 'Selling before maturity gets the market price.',
  loanNotLent: (symbol: string, eMode?: string) =>
    eMode
      ? `Your E-Mode here (${eMode}) doesn't lend ${symbol}`
      : `This market doesn't lend ${symbol} to this account`,
  loanLiquidity: (amount: string) => `Only ${amount} left to borrow`,
  // With what the position's LTV there would be, so it says why (demo 10-29)
  loanMaxLtv: (ltv: string, wouldBe?: string) =>
    wouldBe
      ? `LTV here would be ${wouldBe}, max ${ltv}`
      : `Max LTV here is ${ltv}`,
  loanNoMarket: (collateral: string, borrow: string) =>
    `No market lends ${borrow} against ${collateral}`,
  loanLanding: 'Supply sent. The loan follows once it is confirmed.',
  // A supply alone (no loan typed): the press ends once it is confirmed
  loanSupplyLanding: 'Supply sent. Waiting for confirmation.',
  loanSupplied: (amount: string, market: string) =>
    `${amount} is supplied to ${market}. Borrow when you're ready.`,
  // The routers' token selector (10-29): a kind's row names its first
  // tokens; a pasted address no token here has says why
  classMembers: (shown: string[], rest: number) =>
    rest > 0 ? `${shown.join(', ')} and ${rest} more` : shown.join(', '),
  assetSelectNoEarn: (network: string) =>
    `This token has no Earn options on ${network}`,
  assetSelectNoLoan: 'No market here takes this token',
  loanPairOn: (pair: string, network: string) => `${pair} on ${network}`,
  // Under one token's offers, where another of its kind pays more
  earnClassHint: (kind: string) => `Compare all ${kind}`,
  loanDone: (borrowed: string, market: string, supplied?: string) =>
    supplied
      ? `${supplied} supplied and ${borrowed} borrowed on ${market}`
      : `${borrowed} borrowed on ${market}`,
  loanSupplyDone: (supplied: string, market: string) =>
    `${supplied} supplied to ${market}`,
  // The picked market's links to its two reserve pages (demo 11-03)
  loanAssetOn: (symbol: string, market: string) => `${symbol} on ${market}`,
  // The Loans window (11-05): collateral Pay with pays for on another network
  // is bridged to the market's network first, named in the button as a
  // swap first is (one action alone: bridgeAnd)
  loanBridgeSupplyAndBorrow: 'Bridge, Supply and Borrow',
  // The routers' token selector with its network column (11-05): a kind's
  // tab's first row, and a pasted address no token on any network has
  assetSelectAllOfKind: (kind: string) => `All ${kind}`,
  assetSelectNoEarnAnywhere: 'This token has no Earn options',
};
