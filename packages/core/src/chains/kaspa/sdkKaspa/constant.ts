export const DEFAULT_FEE = 1000;
export const CONFIRMATION_COUNT = 10;

export const MAX_UTXO_SIZE = 80;

export const DUST_AMOUNT = 20_000_000;
export const MAX_BLOCK_SIZE = 1_000_000;
export const MAX_ORPHAN_TX_MASS = 100_000;
export const SOMPI_PER_KASPA = 100_000_000;
// MaxSompi is the maximum transaction amount allowed in sompi.
export const MAX_SOMPI = 21_000_000 * SOMPI_PER_KASPA;
export const MINIMUM_RELAY_TRANSACTION_FEE = DEFAULT_FEE;

export const DEFAULT_FEE_RATE = 1;

// The KRC20 reveal tx is broadcast only AFTER the commit tx confirms, so the
// network's minimum relay fee rate may have risen since the commit was built
// (KRC20 mint/trade storms move it fast). The reveal MUST land — otherwise the
// commit's KAS stays locked in the P2SH output — so its fee rate is bumped by
// this multiplier over the freshly re-estimated network rate. The reveal input
// is a fixed 1.3 KAS, so even a multiplied fee is a tiny fraction of it.
export const KRC20_REVEAL_FEE_RATE_BUFFER = 2;

// export const DEFAULT_SEQNUMBER = 0xffffffffffffffffn;
export const DEFAULT_SEQNUMBER = 0;

export const BASE_KAS_TO_P2SH_ADDRESS = '1.3';
