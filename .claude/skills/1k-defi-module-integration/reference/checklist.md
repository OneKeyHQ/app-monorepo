# DeFi Module Integration Checklist

Use this checklist to ensure complete integration of a new DeFi module or protocol.

---

## Phase 1: Planning

### General Requirements

- [ ] Determine integration scenario:
  - [ ] New protocol in Earn module
  - [ ] New protocol in Borrow module
  - [ ] Entirely new module
- [ ] Identify supported networks
- [ ] Identify supported tokens/assets
- [ ] Define operation types (Stake/Unstake/Claim, Supply/Withdraw/Borrow/Repay, or custom)
- [ ] Confirm backend API is ready

### Architecture Decisions

- [ ] State management approach:
  - [ ] Context (page-scoped) - recommended for Borrow-like modules
  - [ ] Jotai (global/persistent) - recommended for Earn-like modules
- [ ] Tab integration:
  - [ ] Integrate into existing Earn Tab
  - [ ] Create new Tab
- [ ] Determine which layers to implement:
  - [ ] **Home Page** (Required)
  - [ ] **Operation Modals** (Required)
  - [ ] **Detail Page** (Optional)
  - [ ] **Protocol List** (Optional - for multi-token)

---

## Phase 2: Home Page (Required)

### Provider/Context Setup

- [ ] Create Provider file (`YourModuleProvider.tsx`)
- [ ] Define context value type with:
  - [ ] Sync data (config, market)
  - [ ] Async data using `IAsyncData<T>` format
  - [ ] Data status enum
  - [ ] Pending transactions array
  - [ ] Refresh refs
- [ ] Export `useYourModuleContext` hook

### DataGate Implementation

- [ ] Create DataGate component (`YourModuleDataGate.tsx`)
- [ ] Implement data fetching with:
  - [ ] Caching (stale time, force refresh counter)
  - [ ] Polling (when view is active)
  - [ ] Focus revalidation
- [ ] Sync fetched data to Context using `IAsyncData` format
- [ ] Handle account changes (clear cache)

### PendingBridge (if receiving external pending state)

- [ ] Create PendingBridge component
- [ ] Sync external `pendingTxs` to Context
- [ ] Register refresh handler via callback

### Overview Component

- [ ] Display summary statistics:
  - [ ] Total value
  - [ ] APY / Health Factor (based on module type)
  - [ ] Rewards (if applicable)
- [ ] Add refresh button with loading state
- [ ] Add pending indicator (if pending transactions exist)
- [ ] Add history navigation

### Asset Cards/Tables

- [ ] Create card components for each asset category
- [ ] Implement desktop layout (table with headers)
- [ ] Implement mobile layout (compact rows)
- [ ] Add sorting functionality (desktop)
- [ ] Add filtering (e.g., hide zero balance)
- [ ] Handle row click navigation

### Responsive Design

- [ ] Desktop layout (side-by-side or table)
- [ ] Mobile layout (stacked or tabbed)
- [ ] Use `useMedia()` for breakpoint detection

---

## Phase 3: Operation Modals (Required)

### For Each Operation Type

- [ ] Create operation component (`UniversalYourOperation/index.tsx`)
- [ ] Implement amount input:
  - [ ] Use `StakingAmountInput` component
  - [ ] Add percentage selector (25%, 50%, 75%, 100%)
  - [ ] Handle max button
  - [ ] Validate decimal places
- [ ] Implement validation:
  - [ ] Amount > 0
  - [ ] Amount <= available balance
  - [ ] Protocol-specific checks
- [ ] Display transaction preview:
  - [ ] Current → After values
  - [ ] Fees
  - [ ] APY changes
- [ ] Handle confirmation:
  - [ ] Loading state
  - [ ] Success callback
  - [ ] Error handling

### Risk Warnings (if applicable)

- [ ] Implement liquidation risk dialog (for Borrow)
- [ ] Implement slashing risk warning (for Staking)
- [ ] Show warning before high-risk operations

### Token Selection (if multi-token)

- [ ] Implement token selector modal or popover
- [ ] Clear amount when token changes
- [ ] Update validation for new token

### Shared Validation Hook

- [ ] Create `useUniversalYourModuleAction` hook
- [ ] Implement debounced validation
- [ ] Return validation results and errors

### ManagePosition Modal

- [ ] Create modal page (`YourModuleManagePosition/index.tsx`)
- [ ] Implement tab switching (if multiple operations)
- [ ] Add header with navigation to details

---

## Phase 4: Detail Page (Optional)

### Page Structure

- [ ] Create detail page (`YourModuleDetails/index.tsx`)
- [ ] Add breadcrumb navigation
- [ ] Implement responsive layout:
  - [ ] Desktop: 65% details, 35% manage position
  - [ ] Mobile: Full-width with footer action

### Chart Section

- [ ] Implement APY history chart (for Earn)
- [ ] Implement interest rate model chart (for Borrow)
- [ ] Add time period selector
- [ ] Show high/low values

### Information Sections

- [ ] Protocol introduction
- [ ] Risk information
- [ ] Performance data
- [ ] FAQ section

### Share Functionality

- [ ] Generate share link
- [ ] Implement share button
- [ ] Handle deep link navigation

---

## Phase 5: Protocol List (Optional)

### List Page

- [ ] Create list page (`YourModuleProtocols/index.tsx`)
- [ ] Implement table with columns:
  - [ ] Protocol name
  - [ ] Network
  - [ ] TVL
  - [ ] APY/APR
- [ ] Add sorting functionality
- [ ] Add filtering (by network, asset type)

### Navigation

- [ ] Handle row click to detail page
- [ ] Pass correct params

---

## Phase 6: Pending State Handling

### Tag System

- [ ] Define tag format for your module
- [ ] Implement `buildYourModuleTag` function
- [ ] Implement `parseYourModuleTag` function
- [ ] Implement `isYourModuleTag` function

### Transaction Tracking

- [ ] Add tags to `stakingInfo` when creating transactions
- [ ] Extract pending info from tags in UI
- [ ] Disable actions when related transaction is pending

### Refresh on Completion

- [ ] Register refresh handler via `refreshDataRef`
- [ ] Call `requestRefresh('txSuccess')` in `onSuccess` callback

---

## Phase 7: Routing (Required)

### Route Definitions

- [ ] Create route enum in `packages/shared/src/routes/`
  - [ ] Define all route names
  - [ ] Define param types for each route
- [ ] Add to `EModalRoutes` enum (if new module)
- [ ] Update `IModalParamList` type

### Modal Router Configuration

- [ ] Create router config file (`YourModule/router/index.tsx`)
- [ ] Import components with `LazyLoad`
- [ ] Define router array with correct types
- [ ] Register in `packages/kit/src/routes/Modal/router.tsx`

### Tab Router Configuration (for desktop detail pages)

- [ ] Add routes to `ETabEarnRoutes` (or create new tab routes)
- [ ] Update `ITabEarnParamList` types
- [ ] Add to `packages/kit/src/routes/Tab/Earn/router.ts`
- [ ] Configure `headerShown` based on platform

### Share Link Routes

- [ ] Create share route variant (no accountId)
- [ ] Use `exact: true` for clean URLs
- [ ] Use `rewrite` with path params
- [ ] Use network name instead of networkId

### Navigation Utilities

- [ ] Create navigation helper file (`yourModuleUtils.ts`)
- [ ] Implement `pushToManagePosition` function
- [ ] Implement `pushToDetails` with desktop/mobile handling
- [ ] Implement `generateShareLink` function

### Deep Link Handling (if needed)

- [ ] Add deep link path to `deeplinkConsts.tsx`
- [ ] Create handler in `deeplink/index.ts`
- [ ] Test deep link navigation

---

## Phase 8: Testing

### Functional Testing

- [ ] Test all operation types with various amounts
- [ ] Test validation (invalid amounts, insufficient balance)
- [ ] Test risk warnings trigger correctly
- [ ] Test token selection (if applicable)

### Pending State Testing

- [ ] Verify pending indicator shows correctly
- [ ] Verify actions are disabled during pending
- [ ] Verify data refreshes after transaction completes

### Edge Cases

- [ ] Test with zero balance
- [ ] Test with very small amounts
- [ ] Test with maximum amounts
- [ ] Test account switching

### Responsive Testing

- [ ] Test desktop layout
- [ ] Test mobile layout
- [ ] Test tablet/mid-width layout

### Error Handling

- [ ] Test network errors
- [ ] Test API errors
- [ ] Test transaction failures

---

## Phase 8.5: i18n & Error Handling (Required)

### Internationalization

- [ ] All user-facing strings use `useIntl()` and `ETranslations`
- [ ] No hardcoded text in components
- [ ] New translation keys added to `ETranslations` enum
- [ ] Translations added to locale JSON files
- [ ] Number formatting uses `intl.formatNumber()`
- [ ] Date formatting uses `intl.formatDate()`

### Error Handling

- [ ] Amount validation implemented
  - [ ] Check for empty/invalid values
  - [ ] Check decimal places against token decimals
  - [ ] Check against available balance
- [ ] Use `useDebouncedCallback` for async validation
- [ ] Display validation alerts to user
- [ ] Handle API errors gracefully
  - [ ] `OneKeyServerApiError` - show user message
  - [ ] `OneKeyLocalError` - log and handle
  - [ ] Unknown errors - show generic message
- [ ] Transaction failure handling
  - [ ] Show error toast/alert
  - [ ] Don't mark pending as complete on failure

### Backend Service Integration

- [ ] Use `backgroundApiProxy.serviceStaking` for all API calls
- [ ] Implement proper loading states
- [ ] Handle empty/null responses
- [ ] Cache responses where appropriate

---

## Phase 9: Pre-Release

### Code Quality

- [ ] Run `yarn lint` - no errors
- [ ] Run `yarn tsc:only` - no TypeScript errors
- [ ] No `any` types without justification
- [ ] No `@ts-ignore` without justification

### Security

- [ ] No sensitive data logged
- [ ] Input validation at boundaries
- [ ] No command injection vulnerabilities

### Internationalization

- [ ] All user-facing strings use `ETranslations`
- [ ] No hardcoded text
- [ ] Translations added for new keys

### Performance

- [ ] No unnecessary re-renders
- [ ] Proper memoization (`useMemo`, `useCallback`, `memo`)
- [ ] Efficient polling (only when active)

### Documentation

- [ ] Update relevant documentation
- [ ] Add comments for complex logic

---

## Quick Reference: Required vs Optional

| Layer | Required | Notes |
|-------|----------|-------|
| Home Page | ✅ Yes | Entry point for the module |
| Provider/Context | ✅ Yes | State management |
| DataGate | ✅ Yes | Data orchestration |
| Operation Modals | ✅ Yes | Core functionality |
| Pending Handling | ✅ Yes | UX requirement |
| Routing | ✅ Yes | Navigation |
| Detail Page | ❌ Optional | For detailed info/charts |
| Protocol List | ❌ Optional | For multi-token support |
| Share Feature | ❌ Optional | For marketing/sharing |

---

## Common Issues Checklist

- [ ] Memory leak: Cleanup refs on unmount
- [ ] Stale closure: Use refs for values in callbacks
- [ ] Race condition: Check request staleness before updating state
- [ ] Infinite loop: Proper dependency arrays in useEffect
- [ ] Missing loading state: Show skeleton on initial load
- [ ] Missing error handling: Handle API failures gracefully
