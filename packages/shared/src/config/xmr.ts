/** Monero chain constants shared across core, kit-bg, and kit. */

/** Monero targets one block every two minutes. */
export const XMR_TARGET_BLOCK_SECONDS = 120;

// Block 1, not genesis: genesis holds no wallet funds and the batched fetch cannot start at height 0.
export const XMR_EARLIEST_SCAN_HEIGHT = 1;
export const XMR_EARLIEST_SCAN_TIMESTAMP_MS = Date.UTC(2014, 3, 18);

/**
 * Consensus lock on every output: ten confirmations. Not our policy -- the
 * network rejects a transaction using a younger output as a ring member.
 */
export const XMR_OUTPUT_LOCK_BLOCKS = 10;

export const XMR_DECIMALS = 12;

/** How far behind the tip we start warning the user; block count is not portable between chains, only elapsed time is. */
export const XMR_TIP_LAG_WARNING_BLOCKS = 30;

/**
 * Ceiling on concurrently scanning accounts; trial decryption runs
 * single-threaded per viewing key per block. Raise only with a real
 * on-device measurement, never an estimate.
 */
export const XMR_MAX_ENABLED_ACCOUNTS = 2;

/**
 * Sending is refused with this many blocks or more left to scan: an
 * unscanned block may already spend the outputs a send would pick.
 */
export const XMR_SEND_MAX_BLOCKS_LEFT = 100;

/**
 * Ring size, including the real spend; current consensus value, pinned in
 * the runtime too (`spend::RING_LEN`) since asking the node would let a
 * lying node weaken the ring.
 */
export const XMR_RING_SIZE = 16;

/**
 * The node this build ships with. Must be HTTPS and send CORS headers: every
 * carrier is a browser context, and the extension declares no host permission
 * for it.
 */
export const XMR_BUILT_IN_NODE_URLS: string[] = [
  'https://xmr-node.cakewallet.com:18081',
];

/** Fee tier used when the user has not chosen one; `normal` is monerod's own default. */
export const XMR_DEFAULT_FEE_PRIORITY = 'normal';

/**
 * How many history rows to read from the runtime in one go. `ServiceHistory`
 * treats this as the complete set and deletes rows it no longer reports, so
 * a partial page would silently drop older transactions.
 */
export const XMR_HISTORY_PAGE_SIZE = 500;

/**
 * How a Monero scheduler turn is composed (see localWallet/syncTurn.ts): the
 * runtime sizes each `get_blocks.bin` step itself, between 10 and 1000
 * blocks. The turn budget caps new steps so Monero does not starve Zcash;
 * the watchdog only catches a turn that is actually stuck.
 */
export const XMR_SYNC_STEP_BLOCKS = 1000;
export const XMR_SYNC_EXPECTED_STEP_MS = 10_000;
export const XMR_SYNC_TURN_BUDGET_MS = 30_000;
export const XMR_SYNC_WATCHDOG_MS = 10 * 60 * 1000;
