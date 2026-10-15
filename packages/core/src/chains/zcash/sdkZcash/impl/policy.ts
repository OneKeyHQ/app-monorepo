import { ZCASH_SHIELDING_THRESHOLD_ZAT } from '@onekeyhq/shared/src/config/zcash';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ZCASH_CURRENT_SHIELDED_POOL } from '../constants';

// PRODUCT = a real policy choice; FIXED = breaks consensus or privacy if changed.

// Whether private sends use transparent inputs is account state, passed
// explicitly to quotePczt/createPczt, not a constant here.

// PRODUCT. Pads a one-action bundle to two actions; unpadded, a one-action
// bundle marks the sender.
export const PAD_ORCHARD_BUNDLE = true;

// FIXED. ZIP-315 confirmation depths (matches upstream
// ConfirmationsPolicy::default); non-standard depths make spends identifiable by wallet.
export const TRUSTED_CONFIRMATIONS = 3;
export const UNTRUSTED_CONFIRMATIONS = 10;

// PRODUCT. Whether our own zero-conf outputs may spend immediately; must stay
// in lockstep with spend selection (send.ts) or the UI shows funds that sends then reject.
export const ALLOW_ZERO_CONF_SHIELDING = false;

// FIXED. Orchard is withdraw-only since NU6.3 (consensus rejects change into
// it); Sapling is view-only (no proving params) here, so Ironwood is the only option.
export const FALLBACK_CHANGE_POOL = ZCASH_CURRENT_SHIELDED_POOL;

// PRODUCT. Below this, shielding costs more in fees than it moves.
export const SHIELDING_THRESHOLD_ZAT = BigInt(ZCASH_SHIELDING_THRESHOLD_ZAT);

// FIXED. Note-reservation lock, in blocks past target height; must outlive
// upstream's 40-block tx expiry.
// If the app dies after broadcast but before recording it, this lock alone prevents a double spend.
const ZCASH_TX_EXPIRY_DELTA = 40;
export const LOCK_FOR_BLOCKS = ZCASH_TX_EXPIRY_DELTA + 1;

// PRODUCT. Expiry of host-built transparent txs; the signer always receives
// the exact height, never picks a default itself.
export const TRANSPARENT_TX_EXPIRY_DELTA = 10;

// FIXED. Subtree roots only change when a shard fills (every few days on
// mainnet); this TTL just covers a long-running desktop session.
export const SUBTREE_ROOTS_TTL_MS = 6 * 60 * 60 * 1000;

// PRODUCT. One call holds the wallet lease (stales UI reads during backfill);
// native/web-embed use a smaller batch since decoded blocks amplify mobile WebView memory.
export const BLOCKS_PER_BATCH =
  platformEnv.isNative || platformEnv.isWebEmbed ? 50 : 500;

// PRODUCT. Batches per syncWallet call; bounds how long one call holds the
// carrier before returning control (progress/cancel).
export const BATCHES_PER_CALL = 8;

// PRODUCT. Wall-clock backstop for one syncWallet pass, since a batch count
// alone can't bound cost (density varies); the pass returns early and the next poll continues.
export const SYNC_TIME_BUDGET_MS = 1500;

// A resolved-promise await continues in a microtask (before paint/input);
// setTimeout(0) is what actually yields to the event loop.
export const SCAN_YIELD_MS = 0;

// FIXED. Mirrors the runtime's own per-call cap; raising this value here
// would just silently truncate instead of returning more.
export const RUNTIME_HISTORY_PAGE = 500;
