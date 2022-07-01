const SEPERATOR = '--';

const IMPL_EVM = 'evm';
const COINTYPE_ETH = '60';

const IMPL_SOL = 'sol';
const COINTYPE_SOL = '501';

const IMPL_ALGO = 'algo';
const COINTYPE_ALGO = '283';

const IMPL_NEAR = 'near';
const COINTYPE_NEAR = '397';

const IMPL_STC = 'stc';
const COINTYPE_STC = '101010';

const IMPL_CFX = 'cfx';
const COINTYPE_CFX = '503';

const IMPL_BTC = 'btc';
const COINTYPE_BTC = '0';

const SUPPORTED_IMPLS = new Set([
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_CFX,
  IMPL_BTC,
  // IMPL_SOL,  // TODO: bigint issue
  // IMPL_ALGO,  // TODO: bigint issue
  IMPL_STC,
]);

const PRODUCTION_IMPLS = new Set([IMPL_EVM, IMPL_NEAR, IMPL_BTC, IMPL_STC]);

export const HISTORY_CONSTS = {
  GET_LOCAL_LIMIT: 100,
  FETCH_ON_CHAIN_LIMIT: 50,
  DISPLAY_TX_LIMIT: 50,
  REFRESH_DROPPED_TX_IN: 5 * 60 * 1000,
  SET_IS_FINAL_EXPIRED_IN: 24 * 60 * 60 * 1000,
  PENDING_QUEUE_MAX_LENGTH: 10,
};

function getSupportedImpls() {
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_IMPLS;
  }
  return SUPPORTED_IMPLS;
}

export {
  SEPERATOR,
  IMPL_EVM,
  COINTYPE_ETH,
  IMPL_SOL,
  COINTYPE_SOL,
  IMPL_ALGO,
  COINTYPE_ALGO,
  IMPL_NEAR,
  COINTYPE_NEAR,
  IMPL_STC,
  COINTYPE_STC,
  IMPL_CFX,
  COINTYPE_CFX,
  IMPL_BTC,
  COINTYPE_BTC,
  getSupportedImpls,
};
