import { ZCASH_SHIELDING_THRESHOLD_ZAT } from '@onekeyhq/shared/src/config/zcash';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ZCASH_CURRENT_SHIELDED_POOL } from '../constants';

// Every policy value the Zcash integration runs on, in one place.
//
// The runtime deliberately holds no defaults: it exposes capabilities and
// reports facts, and every decision that could reasonably go the other way is
// passed in. Static build policy lives here; account policy is captured by the
// host and passed explicitly with the transaction.
//
// Two kinds of value live here and they are NOT interchangeable:
//
//   - PRODUCT: a real choice. Changing it changes what users get, and that is
//     the point.
//   - FIXED: looks like a knob, is not. Changing it breaks privacy or
//     consensus. Each one says what breaks.
//
// One structural decision is not a constant and so is not here: the wallet
// database is one per network (`carrier.ts: walletDbName`, decision D14) —
// every account across every mnemonic shares it, because scanning is a single
// pass that trial-decrypts for all registered keys at once.

// ── 隐私姿态 ────────────────────────────────────────────────────────────

// Whether private sends may use transparent inputs is account state, not a
// build-wide policy constant. The host captures it on the encoded transaction
// and passes the same value to quotePczt and createPczt.

// PRODUCT. Pad the Orchard bundle to a fixed action count, hiding how many
// actions a transaction really has.
//
// Off: it makes the transaction larger and the fee higher, both visible to the
// user, while the anonymity gain is marginal for a wallet that already spends
// from a shielded pool.
export const PAD_ORCHARD_BUNDLE = false;

// ── 协议与隐私约束（看着像旋钮，不是） ──────────────────────────────────

// FIXED. ZIP-315's confirmation thresholds, matching
// `ConfirmationsPolicy::default()` upstream.
//
// Deviating makes transactions identifiable by wallet: spending at
// non-standard confirmation depths leaves a recognizable on-chain pattern. Lowering these
// trades the user's privacy for a shorter wait, and the user never sees the
// trade.
export const TRUSTED_CONFIRMATIONS = 3;
export const UNTRUSTED_CONFIRMATIONS = 10;

// PRODUCT. Whether zero-confirmation shielding outputs of our own may be
// spent immediately. A real switch: this one constant feeds BOTH the balance
// reads (wallet.ts) and the spend/shield selection (send.ts -> SendPolicy),
// so flipping it keeps "shown as spendable" and "selectable to spend" in
// lockstep -- the send paths used to hardcode `false` runtime-side, which
// made the two disagree the moment this changed.
//
// ZIP-315 recommends `true`; we do not follow that yet.
export const ALLOW_ZERO_CONF_SHIELDING = false;

// Reading balances at different thresholds than spending uses is how a wallet
// tells the user they have money and then refuses to send it. That bug was here:
// balances were read at 1 confirmation while sends require 3, so part of the
// "spendable" figure on screen could not actually be spent. All three values
// above must be the ones the send path uses, everywhere.

// FIXED. Where change goes when a transaction is otherwise fully transparent.
//
// Orchard has been a withdraw-only turnstile since NU6.3 (circuit soundness
// disclosure), so change cannot enter it and consensus rejects the attempt.
// Sapling is view-only here — the 50MB proving parameters are not shipped, so
// change sent there could never be spent again. Ironwood is the only live
// target; this is not a preference.
export const FALLBACK_CHANGE_POOL = ZCASH_CURRENT_SHIELDED_POOL;

// ── 阈值 ────────────────────────────────────────────────────────────────

// PRODUCT. Below this, shielding costs more in fees than it moves.
export const SHIELDING_THRESHOLD_ZAT = BigInt(ZCASH_SHIELDING_THRESHOLD_ZAT);

// ── 调度与资源 ──────────────────────────────────────────────────────────

// PRODUCT. How long a note reservation survives, in blocks past the proposal's
// target height.
//
// It has to cover the worst case between building a transaction and storing it:
// review screen, password prompt, proving (~19s measured), signing. Blocks are
// ~75s, so 10 is roughly 12 minutes. Upstream gives no recommended value, only
// "choose conservatively". Too short and the lock expires while the user is
// still on the confirmation screen, re-opening the double-spend race it exists
// to prevent; too long and a cancelled send freezes those notes.
export const LOCK_FOR_BLOCKS = 10;

// PRODUCT. Transparent transactions use the same bounded review window as
// private input reservations. The signer receives the exact expiry height;
// it never chooses a product default inside the Rust capability layer.
export const TRANSPARENT_TX_EXPIRY_DELTA = 10;

// FIXED. How long downloaded subtree roots stay trusted, in milliseconds.
//
// Roots are frozen history: a new one only appears when a commitment-tree
// shard fills (every few days on mainnet), yet re-downloading all ~1900 costs
// 7.4s on mainnet, measured. Once per open would almost always be enough; the
// window is insurance for a desktop app left running across a shard boundary.
export const SUBTREE_ROOTS_TTL_MS = 6 * 60 * 60 * 1000;

// PRODUCT. Blocks per scan call.
//
// One call is one bounded hold of the wallet lease: reads (balance, progress)
// queue behind it, so this bounds how stale the UI's numbers can get during a
// backfill -- at mainnet rates a 500-block call holds the lease for roughly
// 20-40s depending on block density.
//
// It no longer bounds UI jank on desktop: the scan runs in the Worker carrier
// there, and ext/mobile were isolated runtimes already. The per-call fixed
// costs (network round trips ~0.5-1s, scheduling gap) amortize across the
// batch, which is why bigger is faster.
// Native is the one carrier with a hard ceiling it cannot negotiate: the wasm
// runs inside a WKWebView/system-WebView CONTENT PROCESS, which iOS kills
// outright when it grows too large -- taking the app with it, with no recoverable
// error. 500 blocks is fine near the tip (~356 bytes each) but the 2022 spam
// region carries 49-113 KB per block, so one 8-batch call there asks for
// 200-450 MB of compact blocks. Desktop and the extension have the headroom;
// a phone does not.
//
// Lower means more round trips (the per-call network cost amortizes worse --
// see the note above), which is the trade this makes deliberately: finishing
// slowly beats dying.
export const BLOCKS_PER_BATCH = platformEnv.isNative ? 50 : 500;

// PRODUCT. Batches per `syncWallet` call. Bounds how long one call can hold the
// carrier before returning control, which is what lets the caller show progress
// and lets the user cancel.
export const BATCHES_PER_CALL = 8;

// PRODUCT. Wall-clock budget for one `syncWallet` pass, in milliseconds.
//
// A batch count alone cannot bound how long a pass runs: the cost of a batch
// depends on how dense the blocks are, which varies by chain and by era. This
// is the backstop that does not care -- once the budget is spent the pass
// returns, whatever it managed to scan, and the next poll continues.
export const SYNC_TIME_BUDGET_MS = 1500;

// PRODUCT. How long to yield between batches, in milliseconds.
//
// `await` alone is not enough: a promise that is already resolved continues in
// a microtask, which runs before the browser gets to paint or handle input. A
// macrotask (setTimeout) is what actually gives the frame back.
export const SCAN_YIELD_MS = 0;

// FIXED. The runtime's own per-call history cap.
//
// This mirrors a limit inside the runtime, so raising it here silently truncates
// instead of returning more. Paging is done on this side rather than raising it
// there: one call that materializes 20000 rows inside the wasm heap is exactly
// the kind of unbounded work the runtime refuses to do.
export const RUNTIME_HISTORY_PAGE = 500;
