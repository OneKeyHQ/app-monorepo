# Earn "My portfolio": the position model

Date: 2026-09-28
Ticket: OK-61377. Review of PR #13723 (`feat/defi-position` → `release/v6.6.0`)
Design: Figma 👛 Earn, node `29209-123064` (card `30292-17820`, states `30292-17104`)
Reference example: branch `example/earn-position-model` (§11)

## TL;DR

- My portfolio uses the position model of the wallet's DeFi Portfolio. There is **one card per position (`groupId`)**, and cards are grouped into **one row per protocol per network**.
- PR #13723 renders `useEarnPortfolio().investments` instead. `aggregateByProtocol` has already merged those into one item per provider, across markets, vaults and networks, so every card is a provider rather than a position. Everything in §1 comes from that: 10 Pendle markets on 4 networks in one card under one maturity date, withdrawn principal listed as rewards, and deposit figures that include rewards and withdrawals.
- The client cannot rebuild positions from the current Earn API:
  - `investment/detail` returns display strings (`"2.185 POL"`, or just `"USDG"` for Pendle).
  - It has no position identity, state, category or unlock time.
  - The PR adds row fields to the types (`kind`, `amount`, `fiatValue`, `unlockAt`, `category`, `rewardsFiatValue`), but none of them appear in any of the 145 Earn responses captured on the test env.
- Fix:
  - The Earn backend returns the wallet position contract (`IDeFiPosition`, the shape of `POST /wallet/v1/portfolio/positions`) for Earn protocols, plus one `earn` block per position.
  - The client groups the positions with the wallet's own code and renders them with the reference card.
  - Nothing is merged or parsed from text.

## 1. What the page shows today

Test env, test wallet, web at phone width, 2026-09-28. The header reads DeFi Assets $19.60 and Rewards $0.05.

| Protocol row                  | What the PR renders                                                                                                                                                  | What the account holds (same API responses)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pendle $12.03                 | One card titled `26 Mar 2026 · 已到期` ("matured"). Rows: mPendle, stk-ePendle, USDG, asdCRV, USD3, rETH, and more. The Balance column repeats the symbol, with no amount and no fiat. | **10 PT markets on 4 networks**, each with its own maturity and state. Ethereum: USD3 (17 Dec 2026, active), USDG (28 May 2026, matured), USDat (14 Jan 2027, active), asdCRV (25 Jun 2026, matured). Base: sKAITO (30 Jul 2026, matured). Arbitrum: mPendle and stk-ePendle (26 Mar 2026), rETH (25 Jun 2026) and thBILL (18 Jun 2026), all matured. BNB Chain: cUSDO (29 Oct 2026, active). The card title is the `vaultName` of whichever market came first. |
| Morpho $1.73                  | One card titled `Pangolins USDC` with 4 token rows                                                                                                                    | 4 vaults on 2 networks. Base: Pangolins USDC and Gauntlet USDC Prime. Ethereum: Hakutora USDT and Hakutora USDC.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Native $2.24                  | One card titled `Native USDT`. Deposited: USDT 2.112 and WETH 0.00004844. Rewards: WETH 0.00002419.                                                                  | 2 vaults. The WETH deposit figure is 0.00002425 deposited plus the 0.00002419 reward, so the reward shows twice.                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Stakefish $2.02               | One untitled card. Deposited: SOL 0.01616 and POL 0.7017. Rewards: SOL 0.008045 ($0.97) and POL 0.004208.                                                           | 2 networks. The 0.008045 SOL is withdrawn principal waiting to be claimed (`claimOrder`), not a reward. The 0.01616 SOL deposit figure is 0.008108 staked plus that 0.008045.                                                                                                                                                                                                                                                                                                                                                      |
| Everstake $0.25               | One untitled card. Deposited: 2.185 POL. Rewards: `1 POL` with no fiat, and 0.0008532 POL.                                                                           | 1.1842 POL staked, 1 POL withdrawn and claimable (`claimOrder`), and 0.0008532 POL of rewards (below the 1 POL claim minimum). The 2.185 figure is all three added together.                                                                                                                                                                                                                                                                                                                                                        |
| Lista, Spark, Lido            | One card each                                                                                                                                                        | These look right only because each holds a single vault.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |

On Rewards → Claimable, the Pendle row and card read **$12.04**, which is the principal of all 10 markets. The card's only reward row is 0.04588 USDe. Lista reads $0.91, which is also principal. The header above them says $0.05.

Loading the page took 141 Earn requests:

- 127 × `GET /earn/v2/investment/detail`, most of which returned a zero balance
- 9 airdrop details
- 4 Pendle batch details
- 1 rewards portfolio

## 2. Root cause

- `packages/kit/src/views/Earn/hooks/useEarnPortfolio.ts:180`: `aggregateByProtocol` keys investments by `protocol.providerDetail.code`.
- `packages/kit/src/views/Earn/hooks/earnPortfolioInvestmentMerge.ts`: `mergeEarnPortfolioInvestments` does three things.
  - It spreads the first item, so `protocol` (including `vaultName`, which carries the Pendle maturity), `network`, `netPnl` and `earnings24hFiatValue` all come from a single market.
  - It concatenates `assets`.
  - It sums `totalFiatValue`.
- The PR's `mobile/ProtocolGroupRow.tsx` and `mobile/PositionCard.tsx` draw one card per merged item.
- `mobile/myPortfolio.utils.ts` then builds rows out of the `deposit.title`, `assetsStatus` and `rewardAssets` text (`splitPositionRows`). It works out the deposit as the total minus the rows it carved out (`depositedFiatValue`).

An Earn _investment_ is the summary behind one product detail page. It mixes staked principal, withdrawals in progress, claimable principal and rewards into display text. It is not a position, and merging investments moves it further away from one.

The planned row fields would not fix this. Rows would be classified, but a card would still be one provider across networks. For example:

- Two Lido withdrawal requests would still be two rows inside one card.
- The card's title, maturity and PnL would still come from a single market.

## 3. The model: a position, as in the wallet DeFi Portfolio

This is the reference code. The example reuses all of it unchanged.

- `packages/shared/types/defi.ts`: `IDeFiPosition`, `IDeFiAsset`, `IProtocolSummary`.
- `packages/shared/src/utils/defiUtils.ts`: `transformDeFiData` builds one protocol per `${networkId}-${protocol}` and keys its positions by `groupId`.
- `packages/kit/src/utils/defiPositionUtils.ts`: `buildLocalizedProtocolPositionItems` builds the sections, value and health factor of each position.
- `packages/kit/src/views/AssetDetails/pages/DeFiProtocolDetails.tsx`: the wallet card.

Rules:

1. **A position is one holding the user acts on as a unit.** Examples: one vault share, one PT market, one staking account, one withdrawal request, one borrow market.
2. **`groupId` is the position's identity.**
   - It is stable across refreshes and unique within the account.
   - Entries that share a `groupId` are the same position.
   - Different `groupId`s never merge, even when they have the same name.
3. **The client never merges, splits or re-derives a position.**
4. **A protocol row is one protocol on one network.** The network shows on the logo badge. A protocol on 3 networks is 3 rows, so the network filter is an exact match.
5. **Values come from `amount × price`, never from text.**
   - Position value = assets + rewards − debts.
   - A protocol row is the sum of its cards.
   - The DeFi Assets header is the sum of the rows.
6. **A state belongs to a position.** Withdrawn principal waiting to be claimed is a position with its own `groupId`, and so is each withdrawal still in progress. Neither is ever a row inside the deposit. The wallet already works this way; see `Everstake Pending Withdrawal` and `Cooldown #5` in `packages/shared/src/utils/defiActionUtils.test.ts`.
7. **Rewards are incentive tokens only.** Principal is never a reward.
8. **Category is a badge, not a grouping key.**

## 4. One position per provider

| Provider                              | One position is                                              | `groupId` (example)                                           | `name`                          | `category` | `earn.state`                                                                  |
| ------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------- | ---------- | ----------------------------------------------------------------------------- |
| Pendle                                | one PT market on one network                                 | `pendle:evm--1:<market>`                                      | `PT-USD3-17DEC2026`             | `yield`    | `active` until redeemed, including after maturity. `maturityAt` is required. |
| Morpho, Native, Spark, Lista (vaults) | one vault                                                    | `morpho:evm--8453:<vault>`                                    | vault name, e.g. `Pangolins USDC` | `yield`    | `active`                                                                      |
| Morpho / Aave borrow, if in scope     | one market                                                   | `morpho:evm--1:market:<id>`                                   | `WETH / USDC`                   | `lending`  | `active`, with `debts[]` and `metrics.healthFactor`                           |
| Lido                                  | the stETH balance; each withdrawal request                  | `lido:evm--1:steth`, `lido:evm--1:withdrawal:<requestId>`     | `Lido staked ETH`               | `staked`   | `active`. Each request goes `unstaking` (`unlockAt`) → `claimable`.           |
| Everstake, Stakefish (ETH, POL, SOL)  | the stake; each pending unbond; the withdrawable amount     | `everstake:evm--1:pol`, `everstake:evm--1:pol:unbond:<nonce>` | `Everstake staked POL`          | `staked`   | `active` / `unstaking` / `claimable`                                          |
| Ethena                                | the sUSDe balance; the cooldown                              | `ethena:evm--1:susde`, `ethena:evm--1:cooldown`               | `Ethena staked USDe`            | `yield`    | `active`. The cooldown goes `unstaking` (`unlockAt` = cooldown end) → `claimable`. |
| Babylon                               | each stake                                                   | `babylon:btc--0:<stakingTxHash>`                              | `Babylon staked BTC`            | `staked`   | `active` / `unstaking` / `claimable`                                          |

Pendle details:

- The asset row is the PT itself: `symbol: "PT-USD3"`, `amount: "1.1405"`, and `price` is the PT price. Today the amount exists only as text in `assetsStatus` (`"1.1405 PT USD3"`), and `deposit.title` is the bare symbol.
- The maturity belongs to the position, in both `maturityAt` and the name. The protocol row never has a maturity.
- Two markets with the same underlying are two positions. The markets queried for the test wallet include two USD3 markets and three sUSDe markets.

## 5. Backend contract

**Endpoint (proposal):** `POST /earn/v1/portfolio/positions`, with body `{ "accounts": [{ "accountAddress", "networkId", "publicKey" }] }`.

- The body is the same accounts list that `POST /earn/v1/rewards/portfolio` already takes.
- This one call replaces the 140 detail requests.
- It returns only positions that have a balance.
- `price` and `value` use the currency in the `X-Onekey-Request-Currency` header, like every other endpoint.

**Response:** `IEarnPortfolioPositionsResponse` in `earnPositionModel.types.ts`. It is the wallet response (`positions` keyed by `networkId`, plus `protocolSummaries`) with one `earn` block added to each position.

```jsonc
{
  "positions": {
    "evm--1": [
      {
        "networkId": "evm--1",
        "chain": "eth",
        "owner": "0x…",
        "protocol": "pendle",
        "protocolName": "Pendle",
        "groupId": "pendle:evm--1:0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e",
        "name": "PT-USD3-17DEC2026",
        "category": "yield",
        "assets": [
          {
            "symbol": "PT-USD3",
            "address": "0x…",
            "amount": "1.1405",
            "price": 0.9733,
            "value": 1.11005, // amount × price
            "category": "deposit",
            "meta": { "logoUrl": "…", "decimals": 18, "isVerified": true }
          }
        ],
        "debts": [],
        "rewards": [],
        "metrics": { "healthFactor": null },
        "source": { "provider": "onekey-earn", "fetchedAt": "…", "ttl": 60, "cached": false },
        "earn": {
          "state": "active",
          "maturityAt": 1797465600000, // 2026-12-17
          "manage": {
            "networkId": "evm--1",
            "provider": "pendle",
            "symbol": "USD3",
            "vault": "0x4a5067c3ff1abb7449244025b0e37feaf77d8e3e"
          }
        }
      },
      {
        // a Lido withdrawal request: its own position, next to the stETH one
        "protocol": "lido",
        "category": "staked",
        "groupId": "lido:evm--1:withdrawal:81240",
        "name": "Lido staked ETH",
        "assets": [{ "symbol": "ETH", "amount": "1", "price": 3150, "value": 3150 /* … */ }],
        "earn": { "state": "unstaking", "unlockAt": 1790928000000 } // 2026-10-02 08:00 UTC
        // … other IDeFiPosition fields as above
      }
    ]
  },
  "protocolSummaries": [
    {
      "protocol": "pendle",
      "protocolName": "Pendle",
      "protocolLogo": "…",
      "protocolUrl": "",
      "networkIds": ["evm--1"],
      "totalValue": 2.8,
      "totalDebt": 0,
      "totalReward": 0,
      "netWorth": 2.8,
      "positionCount": 3,
      "positionIndices": []
    }
  ]
}
```

| Field                      | Rule                                                                                                                                                                         |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `groupId`                  | Required. Stable, unique within the account, one per position. A position without one still gets its own card (`__ungrouped__…`), but it has no identity across refreshes. |
| `protocol`, `protocolName` | Lowercase provider code and display name. Must match `protocolSummaries`.                                                                                                    |
| `name`                     | Card title: the vault name, `PT-<symbol>-<DDMMMYYYY>`, or `Lido staked ETH`.                                                                                                |
| `category`                 | `yield` \| `staked` \| `lending`. Drives the Yield / Staked / Loans badge.                                                                                                     |
| `assets[]`                 | Principal. `amount` is a decimal string in token units. `price` and `value` (= amount × price) are numbers. `meta.logoUrl` is required.                                       |
| `debts[]`                  | Borrowed tokens. Lending positions only.                                                                                                                                     |
| `rewards[]`                | Incentive tokens only, including amounts below the claim minimum.                                                                                                            |
| `metrics.healthFactor`     | Lending positions only; `null` otherwise.                                                                                                                                    |
| `earn.state`               | `active` \| `claimable` \| `unstaking`.                                                                                                                                      |
| `earn.unlockAt`            | Milliseconds. `unstaking` positions only; the provider's estimate. Omit it when unknown.                                                                                    |
| `earn.maturityAt`          | Milliseconds. Fixed-term positions (Pendle).                                                                                                                                 |
| `earn.manage`              | `active` positions only. The parameters the Earn detail page takes today: `networkId`, `provider`, `symbol`, `vault`.                                                      |
| `earn.claim`               | `claimable` positions only. The `IEarnClaimActionIcon` the detail page already uses: `type` (`claim` \| `claimOrder`), `disabled`, `text`, `data`.                           |
| `protocolSummaries[]`      | One entry per protocol per network: `protocolName`, `protocolLogo` and the totals.                                                                                           |

The response order doesn't matter, because the client sorts:

- Rows by value, highest first.
- Cards inside a row by state: `active`, then `claimable`, then `unstaking`. Unstaking cards go earliest `unlockAt` first.
- Cards with the same state by value, highest first.

## 6. Frontend

Once the contract exists, the page needs no Earn-specific grouping:

1. Fetch the positions through a kit-bg service. Today the Earn requests are made from `useEarnPortfolio`.
2. Call `buildEarnPortfolioView({ response, translate })` to get the protocol rows and the header total.
   - It runs the wallet's `transformDeFiData` and `buildLocalizedProtocolPositionItems`.
   - On top, it adds only what the Earn design adds: the badge, the section title for claimable and unstaking principal, the unlock-time line, the action, and the card order.
3. Render with `EarnPositionProtocolList` and `EarnPositionCard`.
   - Manage opens the position's own detail page: `EarnNavigation.pushToEarnProtocolDetails` with `earn.manage`.
   - Claim runs the detail page's claim with `earn.claim`.
4. Filter by network with `filterEarnProtocolsByNetworks`.
5. On Rewards → Claimable, list the protocol rewards from `buildEarnClaimableRewardsView`, followed by the ledger rewards from `POST /earn/v1/rewards/portfolio`.

The DeFi Assets tab then needs none of this from the PR:

- `useEarnPortfolio().investments`, which `aggregateByProtocol` has merged.
- `groupInvestmentsByProvider`, `splitPositionRows`, `depositedFiatValue`, `sumRewardsHeaderFiat`, and all parsing of `deposit.title`, `assetsStatus` and `rewardAssets` text.
- The fields added to the investment types: `IEarnInvestmentRowFacts`, `rewardsFiatValue`, and protocol `category` / `type`.

Other `useEarnPortfolio` consumers are unaffected.

## 7. Design mapping and copy

| Card part (Figma `30292-17820`) | Source                                                                                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Badge                           | `category`: Yield (`earn.yield`), Staked (`earn_category_staked__title`), Loans (`earn_loans`)                                                               |
| Name                            | `name`                                                                                                                                                        |
| Value                           | assets + rewards − debts                                                                                                                                      |
| Line under the header           | Health factor (`metrics.healthFactor`) for lending; `Est. unlock time: <date>` (`earn.unlockAt`) for unstaking                                                |
| Principal section               | Deposited (`earn.deposited`) when `active`, Claimable (`earn.claimable`) when `claimable`, Unstaking (no key yet) when `unstaking`; Supplied / Borrowed for `lending` |
| Rewards section                 | `rewards[]` (`wallet.defi_position_module_rewards`)                                                                                                           |
| Token row                       | Logo and symbol; fiat value over amount                                                                                                                       |
| Button                          | Manage when `active`, Claim when `claimable`, none when `unstaking`                                                                                           |

Copy:

- **Missing keys (Lokalise, OK-61377):**
  - `Unstaking`: the section title.
  - `Est. unlock time`: the label on the line under the header.
  - The example renders both from `EARN_POSITION_PENDING_COPY`. `earn.unlock_time` ("Unlock time") already exists if the design can drop "Est.".
- **zh collisions to raise with design:**
  - The badge (`earn.yield`), the Rewards section (`wallet.defi_position_module_rewards`) and the Rewards tab are all 收益. A Yield card with rewards shows 收益 twice.
  - A Loans card shows 借币 on its badge and 已存入 on its principal, while Yield cards call their principal 已认购.

## 8. Rewards → Claimable

- The protocol part lists the same positions with only their Rewards section. Card, row and total show the value of the rewards, never the principal.
- Claimable principal (a finished withdrawal) is a position on the DeFi Assets tab. It is never a reward.
- The ledger rewards (`POST /earn/v1/rewards/portfolio`) follow, as they do today.

## 9. What to change

Backend (earn service):

1. Add `POST /earn/v1/portfolio/positions`, returning §5.
2. Pendle: one position per market per network, with the PT amount, the PT price and `maturityAt`.
3. Withdrawals as their own positions, each with its own `state` and `unlockAt`: Lido requests, Everstake / Stakefish unbonds and withdrawable amounts, the Ethena cooldown, Babylon unbonding.
4. Structured `amount`, `price` and `value` on every token. No display strings.
5. Only incentive tokens in `rewards[]`.
6. No zero-balance positions.

Frontend (PR #13723):

1. Drive the DeFi Assets tab from the positions response through `buildEarnPortfolioView`, not from `useEarnPortfolio().investments`.
2. Adopt `EarnPositionCard` and `EarnPositionProtocolList`, or bring `mobile/` in line with them, and drop the pieces listed in §6.
3. Build Rewards → Claimable with `buildEarnClaimableRewardsView`.
4. Add the two Lokalise keys and remove `EARN_POSITION_PENDING_COPY`.
5. Keep `earnPositionModel.test.ts` as the acceptance spec.

## 10. Open questions

1. **Loans in v6.6.0:** are borrow positions (Morpho markets, Aave) in scope? The model and the fixture already cover them.
2. **Unknown unlock time:** the example leaves the line out. Should it show a placeholder instead?
3. **Matured PT:** the example keeps it `active` with Manage, and the user redeems on the detail page. Does the card need a "Matured" hint? Today that hint only exists inside `vaultName` (已到期).
4. **Header "Rewards":** does it count only claimable rewards (protocol + ledger), or pending rewards too?

## 11. Reference example (this branch)

Branch `example/earn-position-model` is local only and sits on top of the PR head (`e5b177b679`). It doesn't touch the PR's page.

Files under `packages/kit/src/views/Earn/pages/EarnPositions/positionModel/`:

| File                                                | What it is                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `earnPositionModel.types.ts`                        | The contract (§5)                                                                                    |
| `earnPositionModel.ts`                              | The view model, built on the wallet code                                                             |
| `earnPositionModel.fixtures.ts`                     | A mock response: part of the test wallet, plus the Lido and Loans cases from the design |
| `earnPositionModel.test.ts`                         | 12 tests covering the rules in §3–§8                                                                 |
| `EarnPositionCard.tsx`, `EarnPositionProtocolList.tsx` | The card (Figma `30292-17820`) and the protocol rows                                              |

The gallery story is `packages/kit/src/views/Developer/pages/Gallery/Components/stories/EarnPositionModelGallery.tsx`.

- **View it:** developer mode → Dev tab → Gallery → `EarnPositionModel`. On web the path is `/dev/component-EarnPositionModel`.
- **Run the tests:** `npx jest packages/kit/src/views/Earn/pages/EarnPositions/positionModel`.

What the story shows:

- **Lido:** 4 cards, one per holding.
  - The deposit has Manage.
  - The claimable withdrawal has Claim.
  - The two unstaking requests show their unlock times, earliest first.
- **Pendle:** one card per market, and one row per network.
- **Morpho on Ethereum:** a Loans card with a health factor, plus two vault cards. Morpho on Base is a separate row.
- **Everstake and Stakefish:** the claimable principal is its own card, never a reward.
- **Rewards → Claimable:** rewards only.
