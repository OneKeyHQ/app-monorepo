import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

// Demo copy the app has no translation key for yet. Before this layout ships
// these go through the 1k-i18n flow; every other string uses an existing key.
const PENDLE_RATE_ROW_TITLES = ['Effective Fixed APY', 'Market Reference APY'];

const EN = {
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
  // Over the network list's numbers on the Loans tab: what they count
  networkPairs: 'Pairs',
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
  // The card beside the form names the market
  loanPosition: 'Your position',
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
  // The picked card's strip: a cell each, a short name over a figure
  bonus: 'Bonus',
  endsIn: 'Ends in',
  // How long the bonus has left; its date shows on hover
  days: (days: number) => (days === 1 ? '1 day' : `${days} days`),
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

type IEarnDesktopDemoCopy = typeof EN;

// The same copy in Simplified Chinese, in the app's own words for each term
// (认购, 存入, 借币, 赎回, 兑换, 跨链, 授权, 金库, 持仓). Pendle's rows stay
// as they are: they stand in for the server's words until its answer is in
const ZH_CN: IEarnDesktopDemoCopy = {
  withdrawals: '赎回',
  intro: '介绍',
  aYear: '每年',
  more: (count: number) => `其他 ${count} 个`,
  payWith: '支付方式',
  youDeposit: '认购',
  youSupply: '存入',
  swapAnd: (action: string) => `兑换并${action}`,
  bridgeAnd: (action: string) => `跨链并${action}`,
  approveAnd: (action: string) => `授权并${action}`,
  estAnnualRewards: '预估年收益',
  alsoBacksLoan: (market?: string) =>
    market ? `同时担保你在 ${market} 的借款` : '同时担保你的借款',
  atMaturityYouGet: EN.atMaturityYouGet,
  pendleRowTitles: EN.pendleRowTitles,
  pendleSellRowTitles: EN.pendleSellRowTitles,
  pendleSellDetailTitles: EN.pendleSellDetailTitles,
  pendleSellNote: EN.pendleSellNote,
  pendleRateRowTitles: EN.pendleRateRowTitles,
  earnMoreOn: (symbol: string) => `${symbol} 有更高的收益`,
  paysRate: (protocol: string, rate: string) => `${protocol} 的收益是 ${rate}`,
  depositedTo: (amount: string, target: string) => `${amount} 存入 ${target}`,
  withdrewFrom: (amount: string, target: string) =>
    `从 ${target} 赎回 ${amount}`,
  readyToEarn: '可生息资产',
  readyToEarnInfo:
    '“持币生息”下各代币的价值，以及按每行显示的利率估算的一年收益。利率会变动。',
  inYourWallet: '钱包中',
  showMore: (count: number) => `再显示 ${count} 个`,
  loanNetApyHeader: (ltv: string) => `净 APY (${ltv} LTV)`,
  networkPairs: '组合',
  loanNetApyInfo: (ltv: string) =>
    `抵押品一年的收益减去借款一年的成本，再除以你在该市场的净值。按借出抵押品价值的一半（${ltv} LTV）计算，所以每一行比较的是同一笔借款。借不出这么多的组合不会列出。`,
  guideTitle: '4 步开始赚币',
  guideSteps: [
    '添加 ETH 支付网络费用',
    '选择金库',
    '认购 USDC',
    '在“我的投资组合”查看',
  ],
  guideActions: ['添加 ETH', '选择金库', '认购', '我的投资组合'],
  guideGasTitle: '在 Base 上添加 ETH',
  guideGasBody: (amount: string) =>
    `网络费用用 ETH 支付，不能用 USDC。添加约 ${amount} ETH，够这次认购和之后的一次赎回。`,
  guideGasWaiting: '等待 ETH 到账',
  guideGasReceived: 'ETH 已到账',
  guideConnect: '连接钱包以获取你的 Base 地址。',
  guideVaultTitle: '选择金库',
  guideVaultBody:
    '金库把你的 USDC 借给借款人，并把利息付给你。这些金库在 Base 上，网络费用只要几美分。',
  guideUseVault: '使用这个金库',
  guideDepositTitle: '认购 USDC',
  guideWithdrawNote:
    '可随时在“我的投资组合”赎回：你的 USDC 和赚到的收益会回到这个钱包，除非那一刻金库的资金已全部借出。',
  guideDoneTitle: '已开始赚币',
  guideDoneBody: '你的认购已在“我的投资组合”中，所在的行有“赎回”。',
  guideGoToPortfolio: '我的投资组合',
  supplyAndBorrow: '存入并借币',
  swapSupplyAndBorrow: '兑换、存入并借币',
  loanLtv: 'LTV',
  loanCurrentLtv: '当前 LTV',
  loanMaxShort: (ltv: string) => `最高 ${ltv}`,
  loanPosition: '我的持仓',
  yourLoans: '我的借款',
  loanPoolInfo:
    '你在这里存入的所有抵押品共同担保这里的每一笔借款。健康系数低于 1 时，其中任何一项都可能被卖出。',
  loanLiquidationPrice: '清算价格',
  loanBelowNow: (percent: string) => `比现价低 ${percent}`,
  loanNoAccount: (network: string) => `此账户无法使用 ${network}`,
  noFundsOnNetwork: (network: string) => `${network} 上没有资金`,
  onNetwork: (network: string) => `在 ${network}`,
  bonus: '奖励',
  endsIn: '剩余',
  days: (days: number) => `${days} 天`,
  maturity: '到期日',
  fixedRateEarlySale: '到期前卖出按市场价成交。',
  loanNotLent: (symbol: string, eMode?: string) =>
    eMode
      ? `你在这里的 E-Mode（${eMode}）不能借 ${symbol}`
      : `这个市场不向此账户借出 ${symbol}`,
  loanLiquidity: (amount: string) => `只剩 ${amount} 可借`,
  loanMaxLtv: (ltv: string, wouldBe?: string) =>
    wouldBe
      ? `这里的 LTV 会是 ${wouldBe}，最高 ${ltv}`
      : `这里的最高 LTV 是 ${ltv}`,
  loanNoMarket: (collateral: string, borrow: string) =>
    `没有市场接受用 ${collateral} 抵押借 ${borrow}`,
  loanLanding: '存入已发送，确认后继续借币。',
  loanSupplyLanding: '存入已发送，等待确认。',
  loanSupplied: (amount: string, market: string) =>
    `${amount} 已存入 ${market}，可随时借币。`,
  classMembers: (shown: string[], rest: number) =>
    rest > 0
      ? `${shown.join('、')} 等 ${shown.length + rest} 个`
      : shown.join('、'),
  assetSelectNoEarn: (network: string) =>
    `这个代币在 ${network} 上没有赚币选项`,
  assetSelectNoLoan: '这里没有市场接受这个代币',
  earnClassHint: (kind: string) => `比较全部${kind}`,
  loanDone: (borrowed: string, market: string, supplied?: string) =>
    supplied
      ? `已在 ${market} 存入 ${supplied} 并借出 ${borrowed}`
      : `已在 ${market} 借出 ${borrowed}`,
  loanSupplyDone: (supplied: string, market: string) =>
    `已向 ${market} 存入 ${supplied}`,
  loanAssetOn: (symbol: string, market: string) => `${market} 的 ${symbol}`,
  loanBridgeSupplyAndBorrow: '跨链、存入并借币',
  assetSelectAllOfKind: (kind: string) => `全部${kind}`,
  assetSelectNoEarnAnywhere: '这个代币没有赚币选项',
};

const COPY_BY_LOCALE: Partial<Record<string, IEarnDesktopDemoCopy>> = {
  'zh-CN': ZH_CN,
};

// Each string is read where it is drawn, in the language the app is in then
function followLocale(): IEarnDesktopDemoCopy {
  const copy = {} as IEarnDesktopDemoCopy;
  (Object.keys(EN) as (keyof IEarnDesktopDemoCopy)[]).forEach((key) => {
    Object.defineProperty(copy, key, {
      enumerable: true,
      get: () => (COPY_BY_LOCALE[appLocale.getLocale()] ?? EN)[key],
    });
  });
  return copy;
}

export const EARN_DESKTOP_DEMO_COPY = followLocale();
