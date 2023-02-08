import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { OnekeyNetwork } from '../config/networkIds';

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

const IMPL_TBTC = 'tbtc';
const COINTYPE_TBTC = '1';

const IMPL_TRON = 'tron';
const COINTYPE_TRON = '195';

const IMPL_APTOS = 'aptos';
const COINTYPE_APTOS = '637';

const IMPL_DOGE = 'doge';
const COINTYPE_DOGE = '3';

const IMPL_LTC = 'ltc';
const COINTYPE_LTC = '2';

const IMPL_BCH = 'bch';
const COINTYPE_BCH = '145';

const IMPL_XRP = 'xrp';
const COINTYPE_XRP = '144';

const IMPL_COSMOS = 'cosmos';
const COINTYPE_COSMOS = '118';

const IMPL_ADA = 'ada';
const COINTYPE_ADA = '1815';

const IMPL_SUI = 'sui';
const COINTYPE_SUI = '784';

const IMPL_FIL = 'fil';
const COINTYPE_FIL = '461';

const IMPL_DOT = 'dot';
const COINTYPE_DOT = '354';

const SUPPORTED_IMPLS = new Set([
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_CFX,
  IMPL_BTC,
  IMPL_TBTC,
  IMPL_SOL,
  IMPL_STC,
  IMPL_TRON,
  IMPL_APTOS,
  IMPL_DOGE,
  IMPL_LTC,
  IMPL_BCH,
  IMPL_ALGO,
  IMPL_XRP,
  IMPL_COSMOS,
  IMPL_ADA,
  IMPL_SUI,
  IMPL_FIL,
  IMPL_DOT,
]);

const PRODUCTION_IMPLS = new Set([
  IMPL_EVM,
  IMPL_NEAR,
  IMPL_CFX,
  IMPL_BTC,
  IMPL_TBTC,
  IMPL_SOL,
  IMPL_STC,
  IMPL_TRON,
  IMPL_APTOS,
  IMPL_DOGE,
  IMPL_LTC,
  IMPL_BCH,
  IMPL_ALGO,
  IMPL_XRP,
  IMPL_COSMOS,
  IMPL_ADA,
  IMPL_SUI,
  IMPL_FIL,
  IMPL_DOT,
]);

export const HISTORY_CONSTS = {
  GET_LOCAL_LIMIT: 100,
  FETCH_ON_CHAIN_LIMIT: 50,
  DISPLAY_TX_LIMIT: 50,
  REFRESH_DROPPED_TX_IN: 5 * 60 * 1000,
  SET_IS_FINAL_EXPIRED_IN: 24 * 60 * 60 * 1000,
  PENDING_QUEUE_MAX_LENGTH: 10,
};

export enum SocketEvents {
  'Notification' = 'notification',
}

export const enabledAccountDynamicNetworkIds: string[] = [
  OnekeyNetwork.eth,
  OnekeyNetwork.polygon,
  OnekeyNetwork.arbitrum,
  OnekeyNetwork.optimism,
];

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
  IMPL_TBTC,
  COINTYPE_TBTC,
  IMPL_TRON,
  COINTYPE_TRON,
  IMPL_APTOS,
  COINTYPE_APTOS,
  IMPL_DOGE,
  COINTYPE_DOGE,
  IMPL_LTC,
  COINTYPE_LTC,
  IMPL_BCH,
  COINTYPE_BCH,
  IMPL_XRP,
  COINTYPE_XRP,
  IMPL_COSMOS,
  COINTYPE_COSMOS,
  IMPL_ADA,
  COINTYPE_ADA,
  IMPL_SUI,
  COINTYPE_SUI,
  IMPL_FIL,
  COINTYPE_FIL,
  IMPL_DOT,
  COINTYPE_DOT,
  getSupportedImpls,
};

// switch network default rpc to onekey rpc node
export const AUTO_SWITCH_DEFAULT_RPC_AT_VERSION = '3.21.0';

export const PRICE_EXPIRED_TIME = getTimeDurationMs({ minute: 15 });
