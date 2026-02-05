# Remove Perps Tab from EarnReward Page

## Overview

Remove the Perp (contract) tab from the `EarnReward` page, keeping only the DeFi tab UI structure. Delete the unused `PerpsRecordsTab` related code since a standalone `PerpsReward` page now handles contract rewards.

## Background

- The `EarnReward` page currently has two tabs: **Earn (DeFi)** and **Perp (Contract)**
- A new standalone `PerpsReward` page (`pages/PerpsReward/`) has been created for contract rewards
- The Perp tab in `EarnReward` is no longer needed
- Keep the single-tab UI structure for potential future expansion

## Files to Delete (4 files)

```
packages/kit/src/views/ReferFriends/pages/EarnReward/components/PerpsRecordsTab/
├── index.tsx
├── hooks/usePerpsRecords.ts
└── components/
    ├── RecordsAccordionList.tsx
    └── TradingVolumeSummaryCard.tsx
```

## Files to Modify (3 files)

### 1. `components/index.ts`
- Remove `PerpsRecordsTab` export

### 2. `RewardTypeTabs.tsx`
- Remove `perpsLabel` and `perpsContent` props
- Only render single Earn tab

### 3. `EarnReward/index.tsx`
- Remove `PerpsRecordsTab` import
- Remove `activeRewardTab` state and `handleRewardTabChange`
- Simplify export logic (always export `Onchain` type)
- Simplify `RewardTypeTabs` props

## Error Handling

1. **Export functionality**: Fix to `Onchain` type only
2. **Type cleanup**: Keep `EExportTab.Perp` enum as it's used by standalone PerpsReward page
3. **Backward compatibility**: Not needed, this is UI-level simplification

## Testing Strategy

### Manual Testing Checklist

1. **EarnReward page**
   - [ ] Only one DeFi tab is displayed
   - [ ] DeFi data loads and displays correctly
   - [ ] Filter functionality works
   - [ ] Export functionality works (Onchain type)

2. **Standalone PerpsReward page**
   - [ ] Not affected, works normally

3. **Build verification**
   - [ ] `yarn lint:staged` passes
   - [ ] `yarn tsc:staged` passes
