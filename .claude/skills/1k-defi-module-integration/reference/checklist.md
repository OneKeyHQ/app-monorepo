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

### For Borrow Module (Using ManagePosition Component)

The `ManagePosition` component is a unified component that handles all 4 borrow operations. Use it instead of creating separate operation components.

- [ ] Import `ManagePosition` from `@onekeyhq/kit/src/views/Borrow/components/ManagePosition`
- [ ] Set correct `action` prop: `'supply' | 'withdraw' | 'borrow' | 'repay'`
- [ ] Pass `onConfirm` callback with `IManagePositionConfirmParams` type:
  ```typescript
  onConfirm={async ({ amount, withdrawAll, repayAll }) => {
    // Handle the action
  }}
  ```
- [ ] Set `isInModalContext` prop correctly (true for modals)
- [ ] For Supply action:
  - [ ] Pass `balance` as wallet balance
  - [ ] Pass `maxBalance` for max supply limit (if applicable)
- [ ] For Withdraw action:
  - [ ] Pass `balance` as supplied balance
  - [ ] Pass `selectableAssets` and `onTokenSelect` for multi-asset
  - [ ] Handle `withdrawAll` flag in callback
- [ ] For Borrow action:
  - [ ] Pass `balance` as available to borrow
  - [ ] Liquidation risk dialog is handled internally
- [ ] For Repay action:
  - [ ] Pass `balance` as wallet balance
  - [ ] Pass `maxBalance` as debt balance (for repay all calculation)
  - [ ] Pass `selectableAssets` and `onTokenSelect` for multi-asset
  - [ ] Handle `repayAll` flag in callback

### For Other Modules (Custom Operation Components)

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

- [ ] Implement liquidation risk dialog (for Borrow - handled by ManagePosition)
- [ ] Implement slashing risk warning (for Staking)
- [ ] Show warning before high-risk operations

### Token Selection (if multi-token)

- [ ] For Borrow Supply/Borrow: Uses navigation mode (full-screen token selection)
- [ ] For Borrow Withdraw/Repay: Uses popover mode (inline asset selector)
- [ ] For other modules: Implement token selector modal or popover
- [ ] Clear amount when token changes
- [ ] Update validation for new token

### Shared Validation Hook

- [ ] For Borrow: Use `useUniversalBorrowAction` hook (already integrated in ManagePosition)
- [ ] For other modules: Create `useUniversalYourModuleAction` hook
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

## Phase 7.5: Protocol-Specific Features (Optional)

Use this phase for protocols with unique characteristics that require additional UI patterns.

### Time-Based Protocols (e.g., Pendle PT)

For protocols with maturity dates, expiration, or time-locked operations:

- [ ] Define maturity status enum (`Active`, `MaturingSoon`, `Matured`)
- [ ] Implement `getMaturityStatus(timestamp)` helper function
- [ ] Maturity date display implemented:
  - [ ] Format: "15 Jan 2026"
  - [ ] Days remaining: "21 days left"
  - [ ] Status badge with appropriate color
- [ ] Conditional operation logic implemented:
  - [ ] Define `IOperationAvailability` type
  - [ ] Implement availability check for each operation
  - [ ] Disable buttons with reason when unavailable
  - [ ] Show "Available after [date]" message
- [ ] Countdown/timer UI components (if real-time updates needed)

### Protocol Detail Page Customization

For protocols requiring custom detail page sections:

- [ ] Extended position type defined (e.g., `IPendlePosition extends IEarnPortfolioInvestment`)
- [ ] Custom ManageContent component created:
  - [ ] File: `Staking/pages/ManagePosition/components/YourProtocolManageContent.tsx`
  - [ ] Registered in `ManagePositionContent.tsx` router
- [ ] Custom detail sections added:
  - [ ] Underlying Asset section (if applicable)
  - [ ] Maturity/Expiration info section (if applicable)
  - [ ] APY comparison section (Fixed vs Variable)
  - [ ] Yield preview chart (if applicable)

### Multi-Variant Assets (e.g., same asset with different maturities)

For protocols where one underlying asset has multiple variants:

- [ ] Grouping logic implemented:
  - [ ] `groupByUnderlying()` function
  - [ ] Sort variants within each group
- [ ] Filter by variant implemented:
  - [ ] Filter UI (popover or inline)
  - [ ] Filter state management
  - [ ] Clear filter option
- [ ] Sort options added:
  - [ ] By maturity date (asc/desc)
  - [ ] By APY (desc)
  - [ ] By TVL (desc)
- [ ] Grouped list UI:
  - [ ] Accordion/expandable groups
  - [ ] Variant count badge
  - [ ] Individual variant rows

### Operation Tab Pattern (Buy/Sell/Redeem)

For protocols with multiple operation types in a single modal:

- [ ] Tab switching implemented:
  - [ ] SegmentControl or Tab component
  - [ ] Tab state management
  - [ ] Conditional tab availability (e.g., Redeem only after maturity)
- [ ] Input/Output display pattern:
  - [ ] "You pay" section with token and amount
  - [ ] Arrow indicator
  - [ ] "You receive" section with token and amount
  - [ ] Exchange rate display
- [ ] Step indicator implemented:
  - [ ] Step badges (1, 2, ...)
  - [ ] Step labels (Approve, Swap, etc.)
  - [ ] Step status (pending, active, completed)
- [ ] Percentage quick select (25%, 50%, 75%, 100%)

### Earn Category Tabs (if adding new category)

For protocols that belong to a new Earn category:

- [ ] New category tab added to EarnMainTabs:
  - [ ] Tab key defined
  - [ ] Tab label with i18n
  - [ ] Tab content component
- [ ] Category filter logic:
  - [ ] Filter investments by category
  - [ ] Update Overview stats for category
- [ ] Category-specific empty state

---

## Phase 7.6: Borrow-Specific Features (Optional)

Use this phase for Borrow module features that require additional UI patterns.

### Repay with Collateral

For implementing the "Repay with Collateral" feature:

- [ ] Repay source toggle implemented:
  - [ ] SegmentControl with "From wallet balance" / "With Collateral" options
  - [ ] State reset logic when switching source
  - [ ] Conditional rendering based on selected source
- [ ] Dual amount input implemented:
  - [ ] Repay amount input (debt token)
  - [ ] Using amount input (collateral token)
  - [ ] Bidirectional sync with debounce
  - [ ] Active input tracking
  - [ ] Loading state during calculation
- [ ] Collateral selector implemented:
  - [ ] Popover with available collateral assets
  - [ ] Display collateral balance + USD value
  - [ ] Amount recalculation on collateral change
- [ ] Swap-related UI implemented:
  - [ ] Exchange rate display (e.g., "1 SOL = 100.01 USDC")
  - [ ] Price impact display with color coding
  - [ ] Slippage settings (Auto / Custom)
- [ ] Position change preview:
  - [ ] Health factor change (current → after)
  - [ ] My borrow change (current → after)
  - [ ] Remaining collateral display
- [ ] Backend integration:
  - [ ] `getRepayWithCollateralQuote()` API call
  - [ ] Quote refresh on input change
  - [ ] Transaction building with slippage

### New Lending Protocol Integration

For adding a new lending protocol (e.g., AAVE, Compound):

- [ ] Protocol types defined:
  - [ ] Protocol-specific market type
  - [ ] Protocol-specific reserve type
  - [ ] Protocol feature flags
  - [ ] Provider added to `EBorrowProvider` enum
- [ ] Backend service extended:
  - [ ] `get{Protocol}Markets()` implemented
  - [ ] `get{Protocol}Reserves()` implemented
  - [ ] `get{Protocol}HealthFactor()` implemented (if applicable)
  - [ ] Protocol-specific action methods implemented
  - [ ] `getBorrowReserves()` updated to handle new provider
- [ ] Protocol-specific UI (if needed):
  - [ ] Custom components for unique features (e.g., E-Mode selector)
  - [ ] ManagePosition extended for protocol differences
  - [ ] Protocol-specific info sections added
- [ ] Tag system updated:
  - [ ] `buildBorrowTag()` handles protocol-specific actions
  - [ ] `parseBorrowTag()` handles new tag formats
- [ ] Testing completed:
  - [ ] All 4 basic operations tested
  - [ ] Protocol-specific features tested
  - [ ] Health factor calculation verified
  - [ ] Rewards claiming tested
  - [ ] Error handling tested

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

- [ ] Run `yarn lint:staged` on staged files - no errors
- [ ] Run `yarn tsc:staged` on staged files - no TypeScript errors
- [ ] Run `yarn lint` for comprehensive check (~1 minute) - no errors
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
