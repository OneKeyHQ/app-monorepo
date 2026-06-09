# Swap Cold-Start Frame Checklist

Use this checklist for Swap, Bridge, Limit, token selector, default-token,
Wallet handoff, skeleton, blank-screen, or icon-flicker regressions. The goal is
to validate visible first-frame behavior and state transitions, not only the
final settled screen.

## Invocation Examples

Use the skill directly and name the subset:

```text
$1k-trade-swap-market 只跑 Swap 冷启动逐帧自测：Desktop + iOS，覆盖 All Networks、ETH、BTC->ETH、BTC Bridge、Home BTC 兑换入口，不改代码，输出每个 case 的首帧/稳定帧结论。
```

For a narrow run:

```text
$1k-trade-swap-market 使用 references/swap-cold-start-frame-checklist.md，只验证 SWAP-AN-001 和 SWAP-FAST-TAP-001，逐帧检查 skeleton、白屏、network icon 和 token icon 是否闪烁。
```

## Runtime Evidence

Before testing, prove the target runtimes are live and belong to the current
checkout.

- Desktop: verify the dev server and Electron CDP ports, then capture frames
  through the browser/DevTools target.
- iOS: verify the simulator, Metro, and React Native inspector targets, then
  capture simulator screenshots during navigation.
- Android: include it when the change touches native mobile behavior or the user
  explicitly requests Android.

Prefer `iPhone 17 Pro` for iOS simulator runs on this machine family when it is
available. If native startup fails with a red screen, rebuild and reinstall the
current app before recording product behavior.

## Frame Capture Rules

For each case, capture the first 1-3 seconds after the triggering action.
Record both the first visible frame and the settled frame.

Track these fields per frame:

- active tab: Swap, Bridge, or Limit
- From and To token symbols
- From and To network labels and icons
- Select Token count
- skeleton/loading/blank-screen count
- visible token and network image count
- icon completeness, such as empty image, broken image, or natural size zero
- transition count for token symbol, network label, and icon source
- time from trigger to stable frame

Do not mark a cold-start or flicker fix verified if only the final settled frame
was inspected.

## Test Matrix

| ID | Path | Expected result |
| --- | --- | --- |
| SWAP-AN-001 | Cold start -> Home switch to All Networks -> enter Swap | Network icon and token icon do not flicker; no long Select Token skeleton. |
| SWAP-SINGLE-001 | Select ETH network -> first entry to Swap | Expected ETH pair is brought in, for example ETH -> USDC, and the first frames are stable. |
| SWAP-BTC-ETH-001 | Cold start on BTC -> switch Home network to ETH -> first entry to Swap | ETH default token is brought in; the form does not stay at Select Token. |
| SWAP-PRESERVE-001 | After ETH default pair is initialized -> switch Home to Solana or another network -> re-enter Swap | Existing Swap tokens are preserved; Home network sync does not clear them. |
| BRIDGE-BTC-001 | Cold start on BTC -> enter Swap area | BTC entry lands in Bridge when the entry is bridge-only; it does not remain on ordinary Swap by accident. |
| HOME-BTC-001 | Wallet Home under All Networks -> click the BTC row swap button | Stay on Swap tab, but From and To both display Select Token because BTC is unsupported for ordinary Swap. |
| LIMIT-TRON-001 | Home select Tron -> Trade Limit -> choose a token from the Limit network selector | Stay on Limit tab; unsupported tokens show Select Token; no forced Swap tab and no infinite skeleton. |
| LIMIT-STABLE-001 | Enter Limit on a supported network | Supported default tokens render normally, and later unrelated network switches do not clear initialized Limit state. |
| SWAP-FAST-TAP-001 | Cold start -> immediately tap Trade/Swap | No long blank white screen; a meaningful cached UI or bounded skeleton is visible quickly. |
| TOKEN-SWITCH-001 | Switch From/To tokens repeatedly on single-network and All Networks contexts | Token and network icons do not flicker or fall back to Select Token during valid switches. |
| TAB-STABILITY-001 | Move among Swap, Bridge, and Limit, then change Home network and return | Unsupported token handling never causes an unintended tab switch; initialized selections are not reset by unrelated sync. |

## Required Assertions

For every run, report:

1. Platforms tested.
2. Runtime proof, such as active port, inspector target, simulator, or browser
   target.
3. Case IDs covered.
4. First-frame state and settled state for each case.
5. Whether skeleton, blank screen, icon flicker, token clearing, or tab switching
   occurred.
6. Any unsupported-token behavior and whether it showed Select Token without
   changing tabs.

## Failure Triage

If a case fails, identify the state owner before changing code:

- route params or entry source for tab selection
- Swap atoms for selected tokens and token loading
- Home/account selector sync for account or network propagation
- imported token payload for Wallet, Market, Earn, Buy, or token-list handoffs
- provider capability checks for unsupported Swap, Bridge, or Limit routes
- cold-start cache or snapshot pre-read for first-frame display

Fix the owner that performs the wrong transition. Do not hide flicker by adding
generic delays or by forcing a settled final state after the bad frame has
already appeared.
