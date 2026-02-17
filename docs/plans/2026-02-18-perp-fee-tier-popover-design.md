# Perp Fee Tier Popover Design

## Overview

Add a "Fee Tier" popover button below the trading button in the perp order panel. On hover (desktop) or tap (mobile), it displays the user's current fee breakdown and a competitive comparison showing OneKey has the lowest fees.

## Location

In `PerpTradingPanel.tsx`, below `TradingButtonGroup` / `PerpTradingButton` (Method A). Implemented as an independent component, not inside `PerpTradingForm`.

## Trigger

A text button with `%` icon: **"% Fee Tier"** (手续费等级). Desktop: hover to show popover. Mobile: tap to show bottom sheet.

## Popover Content

### Section 1 — Your Fees

Display the user's current fee rates based on their Hyperliquid fee tier and staking tier.

| Item | Value |
|---|---|
| Builder Fee (OneKey) | 0.000% |
| Hyperliquid Fee (Taker) | 0.030% |
| Hyperliquid Fee (Maker) | 0.004% |
| **Total Taker Fee** | **0.030%** |
| **Total Maker Fee** | **0.004%** |

Tags:
- **Fee Tier 3** — 14-day volume >$100M
- **Gold** Staking Tier — 10,000 HYPE staked, 20% discount

### Section 2 — Wallet Fee Comparison

Competitive comparison table with wallet icons, sorted by Builder Fee ascending:

| Wallet | Builder Fee | Total Taker | Total Maker |
|---|---|---|---|
| **OneKey** | 0.000% | 0.030% | 0.004% |
| Dreamcash | 0.045% | 0.075% | 0.049% |
| Phantom | 0.050% | 0.080% | 0.054% |
| Infinex | 0.050% | 0.080% | 0.054% |
| Liquid | 0.050% | 0.080% | 0.054% |
| Rainbow | 0.050% | 0.080% | 0.054% |
| MetaMask | 0.100% | 0.130% | 0.104% |

OneKey row highlighted. Footer text: **"OneKey 0 Builder Fee — lowest fees across all wallets"**

## Fee Structure

Perp fees consist of two parts:
1. **Builder Fee** — charged by the wallet/aggregator (OneKey: 0%)
2. **Hyperliquid Fee** — charged by Hyperliquid, based on fee tier and staking tier

### Hyperliquid Fee Tiers (14-day rolling volume)

| Tier | Volume | Taker | Maker |
|---|---|---|---|
| 0 | $0 | 0.045% | 0.015% |
| 1 | >$5M | 0.040% | 0.012% |
| 2 | >$25M | 0.035% | 0.008% |
| 3 | >$100M | 0.030% | 0.004% |
| 4 | >$500M | 0.028% | 0.000% |
| 5 | >$2B | 0.026% | 0.000% |
| 6 | >$7B | 0.024% | 0.000% |

### HYPE Staking Tiers (discount on Hyperliquid fees)

| Tier | HYPE Staked | Discount |
|---|---|---|
| Wood | >10 | 5% |
| Bronze | >100 | 10% |
| Silver | >1,000 | 15% |
| Gold | >10,000 | 20% |
| Platinum | >100,000 | 30% |
| Diamond | >500,000 | 40% |

## Implementation Details

### Component Structure

- New component: `PerpFeeTierPopover` (independent from `PerpTradingForm`)
- Placed in `PerpTradingPanel.tsx` after the trading button
- Desktop: `Popover` component with hover trigger
- Mobile: `Popover` component with sheet mode (tap trigger)

### Data Source

- Demo phase: hardcoded values (Fee Tier 3, Gold staking, >100M volume)
- Future: integrate with Hyperliquid `userFees` API via existing `ServiceHyperliquid`

### Wallet Icons

Static assets for competitor wallet icons (OneKey, Phantom, MetaMask, Infinex, Dreamcash, Liquid, Rainbow).

### Key Files

- `packages/kit/src/views/Perp/components/TradingPanel/PerpTradingPanel.tsx` — integration point
- `packages/kit/src/views/Perp/components/TradingPanel/components/PerpFeeTierPopover.tsx` — new component
- `packages/components/src/actions/Popover/index.tsx` — existing Popover component to use
