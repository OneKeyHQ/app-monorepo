---
name: 1k-defi-module-integration
description: Interactive guide for integrating new DeFi modules or protocols into OneKey. Use when adding new DeFi features like staking protocols, lending markets, or entirely new DeFi modules. Triggers on DeFi, protocol, integration, Earn, Borrow, staking, lending, supply, borrow, withdraw, repay, claim, new module, Pendle, Aave, Compound.
---

# DeFi Module Integration Guide

This skill provides interactive guidance for integrating new DeFi modules or protocols into OneKey.

## Quick Start

Before starting, determine your integration scenario:

| Scenario | Description | Guide |
|----------|-------------|-------|
| **New Protocol in Earn** | Adding a staking/yield protocol (e.g., Lido, Rocket Pool) | [earn-module-guide.md](reference/earn-module-guide.md) |
| **New Protocol in Borrow** | Adding a lending market (e.g., Aave, Compound) | [borrow-module-guide.md](reference/borrow-module-guide.md) |
| **Entirely New Module** | Creating a new DeFi category (e.g., Pendle, GMX) | [new-module-guide.md](reference/new-module-guide.md) |

---

## Integration Layers

Each DeFi module consists of 4 layers. **Home** and **Modal** are required; **Details** and **List** are optional.

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: HOME PAGE (Required)                              │
│  - Overview data (total value, APY, health factor)          │
│  - Asset cards/tables                                       │
│  - Pending transaction tracking                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: OPERATION MODALS (Required)                       │
│  - Earn: Stake, Unstake, Claim (2-3 types)                  │
│  - Borrow: Supply, Withdraw, Borrow, Repay (4 types)        │
│  - Amount input, validation, risk warnings                  │
├─────────────────────────────────────────────────────────────┤
│  Layer 3: DETAILS PAGE (Optional)                           │
│  - Charts (APY history, interest rate model)                │
│  - Detailed protocol information                            │
│  - Share functionality                                      │
├─────────────────────────────────────────────────────────────┤
│  Layer 4: PROTOCOL LIST (Optional, for multi-token)         │
│  - List of available protocols/assets                       │
│  - Filtering and sorting                                    │
│  - Navigation to details                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Scenario Identification

### When to ask the user

Ask for clarification when:
1. The protocol type is ambiguous (could be Earn or Borrow)
2. The operation types are not standard
3. Special UI/UX requirements are mentioned
4. The protocol has unique features not covered by existing patterns

### Scenario characteristics

**Earn Protocol** (Staking/Yield):
- Operations: Stake, Unstake, Claim
- Data: APY, staked amount, rewards
- Examples: Lido, Rocket Pool, Babylon

**Borrow Protocol** (Lending):
- Operations: Supply, Withdraw, Borrow, Repay
- Data: Health factor, collateral, debt, APY
- Examples: Aave, Compound, Morpho
- Advanced features: Repay with Collateral (swap-based repayment)
- See: [borrow-module-guide.md - Repay with Collateral](reference/borrow-module-guide.md#repay-with-collateral-pattern)

**New Module**:
- Operations differ significantly from Earn/Borrow
- Requires independent Tab or unique UI
- Examples: Pendle (PT/YT), GMX (perpetuals)

**Time-Based Protocol** (Fixed-rate yield):
- Operations: Buy, Sell, Redeem (conditional on maturity)
- Data: Maturity date, implied APY, underlying asset, discount rate
- Special features: Maturity status, conditional operations, multi-variant assets
- Examples: Pendle PT
- Integration: As sub-module of Earn Tab (Fixed-rate category)
- See: [earn-module-guide.md - Time-Based Protocols](reference/earn-module-guide.md#time-based-protocols-eg-pendle-pt)

---

## Key Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Integration type | Earn / Borrow / New Module | Ask user |
| Tab placement | Existing Earn Tab / New Tab | Earn Tab |
| Operation count | 2-3 (Earn) / 4 (Borrow) / Custom | Based on type |
| Risk warnings | Liquidation / Slashing / None | Based on type |
| Token selection | Single / Multiple | Single |
| Charts | APY history / Interest model / None | Based on type |
| Share feature | Yes / No | Yes |
| Multi-token list | Yes / No | Based on token count |
| **Time-based features** | Maturity date / Conditional ops / None | Based on protocol |
| **Multi-variant assets** | Group by underlying / Flat list | Based on protocol |
| **Operation tabs** | Single op / Tab switching (Buy/Sell/Redeem) | Based on protocol |
| **Repay with collateral** | Wallet balance only / With collateral option | Based on protocol |
| **Dual amount input** | Single input / Bidirectional sync | Based on operation |
| **Slippage settings** | Not needed / Auto / Custom | Based on swap involvement |

### State Management Decision

When integrating a new DeFi module, analyze the state requirements and ask the user:

| State Type | Recommendation | Examples |
|------------|----------------|----------|
| **Needs Persistence** (across page navigation) | Use Jotai atoms | Portfolio data, user preferences, cached investments |
| **Page-scoped** (no persistence needed) | Use React Context | Current operation state, form data, temporary UI state |

**When using this skill, you should:**
1. Analyze the state requirements of the new module
2. Ask the user whether the state needs to persist across page navigation
3. Recommend Jotai for persistent state, Context for page-scoped state

**Example question to ask:**
> "Does this module's data need to persist when the user navigates away and returns? For example:
> - If yes (like portfolio data that should be cached): Use Jotai atoms
> - If no (like form state that resets on page exit): Use React Context"

---

## Quick Reference

### Key File Paths

| Module | Path |
|--------|------|
| Earn | `packages/kit/src/views/Earn/` |
| Borrow | `packages/kit/src/views/Borrow/` |
| Staking (shared) | `packages/kit/src/views/Staking/` |
| Routes | `packages/shared/src/routes/` |
| Modal Router | `packages/kit/src/routes/Modal/router.tsx` |
| Tab Router | `packages/kit/src/routes/Tab/router.ts` |

### Common Components

| Component | Location | Usage |
|-----------|----------|-------|
| `StakingAmountInput` | `Staking/components/` | Amount input with validation |
| `StakingFormWrapper` | `Staking/components/` | Form layout wrapper |
| `EarnText` | `Staking/components/ProtocolDetails/` | Styled text with color support |
| `EarnTooltip` | `Staking/components/ProtocolDetails/` | Info tooltips |
| `PendingIndicator` | `Staking/components/StakingActivityIndicator/` | Pending tx indicator |
| `ManagePositionContent` | `Staking/pages/ManagePosition/` | Shared manage position UI |
| `ManagePosition` | `Borrow/components/ManagePosition/` | **Unified Borrow operation component (Supply/Withdraw/Borrow/Repay)** |

### State Management Patterns

| Pattern | Use Case | Reference |
|---------|----------|-----------|
| `IAsyncData<T>` | Unified async data format | [state-management-guide.md](reference/state-management-guide.md) |
| `DataGate` | Data orchestration | [state-management-guide.md](reference/state-management-guide.md) |
| `PendingBridge` | External pending state | [state-management-guide.md](reference/state-management-guide.md) |
| Tag System | Pending tx identification | [state-management-guide.md](reference/state-management-guide.md) |

---

## Workflow

### Step 1: Identify Scenario
- Determine if it's Earn, Borrow, or New Module
- Read the corresponding guide

### Step 2: Plan Layers
- Decide which layers to implement (Home + Modal required)
- Identify optional layers needed

### Step 3: Implement Layer by Layer
- Follow the guide for each layer
- Use the checklist to verify completion

### Step 4: Test and Verify
- Test all operation types
- Verify pending state handling
- Check responsive layout

---

## Related Skills

This skill works best when combined with these other OneKey skills:

| Skill | Use For |
|-------|---------|
| `1k-i18n` | Adding translations, using `ETranslations`, `useIntl()` |
| `1k-coding-patterns` | React patterns, error handling, TypeScript best practices |
| `1k-cross-platform` | Platform-specific code, `platformEnv` checks |
| `page-and-route` | Route configuration, deep links, navigation |

---

## i18n Quick Reference

All user-facing strings must use internationalization. See `1k-i18n` skill for full details.

**Basic Usage:**
```typescript
import { useIntl } from 'react-intl';
import { ETranslations } from '@onekeyhq/shared/src/locale';

function MyComponent() {
  const intl = useIntl();

  return (
    <Text>
      {intl.formatMessage({ id: ETranslations.defi_net_worth })}
    </Text>
  );
}
```

**Common DeFi Translation Keys:**
- `ETranslations.defi_net_worth` - "Net Worth"
- `ETranslations.defi_net_apy` - "Net APY"
- `ETranslations.defi_health_factor` - "Health Factor"
- `ETranslations.defi_platform_bonus` - "Platform Bonus"
- `ETranslations.defi_claimable_rewards` - "Claimable Rewards"
- `ETranslations.global_history` - "History"

**Adding New Keys:**
1. Add key to `ETranslations` enum in `packages/shared/src/locale/enum.ts`
2. Add translations in locale JSON files
3. Never hardcode user-facing strings

---

## Reference Documents

| Document | Content |
|----------|---------|
| [earn-module-guide.md](reference/earn-module-guide.md) | Earn module architecture, files, operations |
| [borrow-module-guide.md](reference/borrow-module-guide.md) | Borrow module architecture, 4 operations, health factor |
| [new-module-guide.md](reference/new-module-guide.md) | Creating new modules, Provider design |
| [routing-guide.md](reference/routing-guide.md) | Modal routes, Tab routes, navigation utilities, deep links |
| [state-management-guide.md](reference/state-management-guide.md) | IAsyncData, Pending, Tag system, refresh strategies |
| [checklist.md](reference/checklist.md) | Integration checklist with required/optional markers |
