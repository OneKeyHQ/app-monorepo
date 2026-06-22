# Swap Cold-Start Frame Checklist

Use this checklist for Swap, the merged `Swap & Bridge` entry, internal Bridge
semantics, Limit, Stock, token selector, default-token, Wallet handoff,
skeleton, blank-screen, or icon-flicker regressions. The goal is to validate
visible first-frame behavior and state transitions, not only the final settled
screen.

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
- Reload proof: after starting or restarting a runtime, trigger one reload and
  verify the same target reconnects. For desktop, the Electron CDP target must
  still list `OneKey` at `http://localhost:3001/`. For iOS, Metro must still
  report `packager-status:running`, React Native inspector must list
  `so.onekey.wallet (<simulator name>)`, and a post-reload screenshot must not
  show a red screen, white screen, or unresolved `Select Token` first-frame
  placeholder.

Prefer `iPhone 17 Pro` for iOS simulator runs on this machine family when it is
available. If native startup fails with a red screen, rebuild and reinstall the
current app before recording product behavior.

## Frame Capture Rules

For each case, capture the first 1-3 seconds after the triggering action.
Record both the first visible frame and the settled frame.

Track these fields per frame:

- visible tab: Swap & Bridge, Limit, or Stock
- internal/effective semantic type: Swap, Bridge, Limit, or Stock
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

| ID                             | Path                                                                                                                                                                            | Expected result                                                                                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SWAP-AN-001                    | Cold start -> Home switch to All Networks -> enter Swap                                                                                                                         | First visible Swap frame initializes ordinary Swap ETH -> USDC; it must not first expose Select Token, a stale Bridge semantic/default pair, or a concrete-network stale pair. Network icon and token icon do not flicker. |
| SWAP-AN-PERSISTED-001          | Home is already on All Networks -> kill/restart app -> enter Swap                                                                                                               | First visible Swap frame initializes ordinary Swap ETH -> USDC from the pre-read Home snapshot; it must not wait for a later account-sync pass or show Select Token first.                                                 |
| SWAP-SINGLE-001                | Select ETH network -> first entry to Swap                                                                                                                                       | Expected ETH pair is brought in, for example ETH -> USDC, and the first frames are stable.                                                                                                                                 |
| SWAP-BTC-ETH-001               | Cold start on BTC -> switch Home network to ETH -> first entry to Swap                                                                                                          | ETH default token is brought in; the form does not stay at Select Token.                                                                                                                                                   |
| SWAP-PRESERVE-001              | After ETH default pair is initialized -> switch Home to Solana or another network -> re-enter Swap                                                                              | Existing Swap tokens are preserved; Home network sync does not clear them.                                                                                                                                                 |
| SWAP-PRESERVE-BTC-001          | After Swap is initialized with a BTC-involved pair -> switch Home to ETH/Solana/another single network -> re-enter Swap                                                         | Existing Swap tokens are preserved even if the Home account derive type changes; Home network sync does not rewrite the pair.                                                                                              |
| SWAP-PRESERVE-RACE-001         | Cold start -> enter Swap and see default tokens -> immediately return Home, switch networks, and re-enter Swap before another restart                                           | Root/provider listeners must wait for latest Home storage before marking selected tokens initially synced, then preserve the initialized Swap pair after that first sync completes.                                        |
| BRIDGE-BTC-001                 | Cold start on BTC -> enter Swap area                                                                                                                                            | BTC entry lands on the visible `Swap & Bridge` tab with internal/effective Bridge semantics and cross-chain defaults; it does not initialize an ordinary same-network Swap pair by accident.                               |
| HOME-BTC-001                   | Wallet Home under All Networks -> click the BTC row swap button                                                                                                                 | Stay on Swap tab, but From and To both display Select Token because BTC is unsupported for ordinary Swap.                                                                                                                  |
| LIMIT-TRON-001                 | Home select Tron -> Trade Limit -> choose a token from the Limit network selector                                                                                               | Stay on Limit tab; unsupported tokens show Select Token; no forced Swap tab and no infinite skeleton.                                                                                                                      |
| LIMIT-STABLE-001               | Enter Limit on a supported network                                                                                                                                              | Supported default tokens render normally, and later unrelated network switches do not clear initialized Limit state.                                                                                                       |
| STOCK-COLD-START-001           | Enter Stock -> select a stock token and pay token -> kill/restart app -> enter Trade                                                                                            | The first visible frame stays on Stock with Stock semantic context and the same stock/pay selection. Ordinary Swap default pairs and Bridge defaults must not overwrite Stock state.                                       |
| STOCK-DEFAULT-OWNER-001        | Cold start directly into Stock without a cached stock selection                                                                                                                 | Stock channel/provider owns stock default selection. The shared Swap default-token initializer must not synthesize an ordinary ETH/USDC or Bridge pair for Stock before the Stock provider resolves its token.             |
| SWAP-FAST-TAP-001              | Cold start -> immediately tap Trade/Swap                                                                                                                                        | No long blank white screen; a meaningful cached UI or bounded skeleton is visible quickly.                                                                                                                                 |
| SWAP-PERPS-CACHE-001           | Cold start with both Perps and Swap cold-start snapshots present -> enter Perps first -> enter Swap                                                                             | Perps settles to a usable trading view, then Swap opens to a meaningful cached/default UI without a white screen or duplicate root-provider crash.                                                                         |
| SWAP-IOS-KILL-BTC-001          | iOS cold start -> Home switch to Tron -> enter Swap and wait for Tron tokens -> Home switch to Bitcoin -> kill app without entering Swap -> cold start -> wait 5s -> enter Swap | Swap must discard the stale Tron selected-token cache and initialize the Bitcoin Bridge pair under the visible `Swap & Bridge` tab; the first visible Swap frame must not show the old Tron pair.                          |
| SWAP-ALLNETWORK-BTC-BRIDGE-001 | Select BTC network -> enter Swap and initialize the BTC Bridge pair -> switch Home to All Networks -> cold start -> enter Swap                                                  | All Networks must discard the stale BTC Bridge selected-token cache and initialize the ordinary Swap ETH -> USDC pair; the first visible Swap frame must not keep stale Bridge semantics/defaults or BTC token.            |
| TOKEN-SWITCH-001               | Switch From/To tokens repeatedly on single-network and All Networks contexts                                                                                                    | Token and network icons do not flicker or fall back to Select Token during valid switches.                                                                                                                                 |
| TAB-STABILITY-001              | Move between visible `Swap & Bridge` and Limit while switching ordinary same-network and cross-chain token pairs, then change Home network and return                           | Unsupported token handling never causes an unintended visible tab switch or semantic type drift; initialized selections are not reset by unrelated sync.                                                                   |
| RUNTIME-RELOAD-001             | Start desktop and iOS -> verify ports/targets -> trigger Reload -> verify targets and capture the first post-reload frame                                                       | Desktop and iOS are genuinely running from the current checkout; reload does not leave Metro/CDP disconnected, red screen, white screen, or a stale Select Token first frame.                                              |

## Required Assertions

For every run, report:

1. Platforms tested.
2. Runtime proof, such as active port, inspector target, simulator, or browser
   target.
3. Case IDs covered.
4. First-frame visible tab, internal/effective semantic type, selected tokens,
   and settled state for each case.
5. Whether skeleton, blank screen, icon flicker, token clearing, or tab switching
   occurred.
6. Any unsupported-token behavior and whether it showed Select Token without
   changing tabs.
7. For preserve cases, the exact pre-switch pair and post-switch pair, plus the
   Home network switched from/to.
8. For `SWAP-PERPS-CACHE-001`, whether both cold-start snapshots were present
   and whether any duplicate provider, red screen, LogBox, or white-screen state
   appeared while moving Perps -> Swap.
9. For `SWAP-IOS-KILL-BTC-001`, the pre-kill Swap pair, the Home network at
   kill time, the post-restart first-frame pair, and whether the stale
   selected-token cache was cleared before Bitcoin Bridge defaults rendered
   under `Swap & Bridge`.
10. For `SWAP-ALLNETWORK-BTC-BRIDGE-001`, the pre-restart BTC Bridge pair, the
    Home network at restart time, the first All Networks Swap pair, and whether
    stale Bridge semantics/defaults or BTC token appeared.
11. For `RUNTIME-RELOAD-001`, the exact listener ports, Electron CDP target,
    Metro status, React Native inspector target, simulator name, and first
    post-reload screenshot result.
12. For `SWAP-AN-PERSISTED-001`, whether the Swap root provider was mounted
    from the All Networks Home snapshot before entering Swap, the first-frame
    pair, and whether any delayed Select Token placeholder appeared.
13. For `SWAP-PRESERVE-RACE-001`, the initialized pair, the network switched
    from/to, whether the initial selected-token synced flag was already committed,
    and whether any root/provider listener rewrote or cleared the pair.
14. For `STOCK-COLD-START-001` and `STOCK-DEFAULT-OWNER-001`, whether the
    persisted context keeps `swapType=Stock`, whether the visible tab remains
    Stock, whether shared Swap default-token sync was skipped, and whether the
    Stock channel/provider performed the first stock/pay-token write.

## Failure Triage

If a case fails, identify the state owner before changing code:

- route params or entry source for visible tab selection vs internal semantic
  type
- Swap atoms for selected tokens and token loading
- Home/account selector sync for account or network propagation
- imported token payload for Wallet, Market, Earn, Buy, or token-list handoffs
- provider capability checks for unsupported Swap, Bridge, or Limit routes
- cold-start cache or snapshot pre-read for first-frame display
- channel ownership for Stock or future protocols that share Swap atoms but
  need their own default-token and market-status state

Fix the owner that performs the wrong transition. Do not hide flicker by adding
generic delays or by forcing a settled final state after the bad frame has
already appeared.
