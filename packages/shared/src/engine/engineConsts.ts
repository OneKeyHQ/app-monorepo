import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

import { getNetworkIdsMap } from '../config/networkIds';

const SEPERATOR = '--';
const INDEX_PLACEHOLDER = '$$INDEX$$';

const IMPL_EVM = 'evm';
const COINTYPE_ETH = '60';
const COINTYPE_ETC = '61'; // TODO new vault?

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
export const COINNAME_BTC = 'BTC';

const IMPL_TBTC = 'tbtc';
const COINTYPE_TBTC = '1';
export const COINNAME_TBTC = 'TEST';

const IMPL_TRON = 'tron';
const COINTYPE_TRON = '195';

const IMPL_APTOS = 'aptos';
const COINTYPE_APTOS = '637';

const IMPL_TON = 'ton';
const COINTYPE_TON = '607';

const IMPL_DOGE = 'doge';
const COINTYPE_DOGE = '3';
export const COINNAME_DOGE = 'DOGE';

const IMPL_LTC = 'ltc';
const COINTYPE_LTC = '2';
export const COINNAME_LTC = 'LTC';

const IMPL_NEURAI = 'neurai';
const COINTYPE_NEURAI = '1900';
export const COINNAME_NEURAI = 'NEURAI';

const IMPL_BCH = 'bch';
const COINTYPE_BCH = '145';
export const COINNAME_BCH = 'BCH';

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

const IMPL_XMR = 'xmr';
const COINTYPE_XMR = '128';

const IMPL_KASPA = 'kaspa';
const COINTYPE_KASPA = '111111';

const IMPL_NEXA = 'nexa';
const COINTYPE_NEXA = '29223';

const IMPL_LIGHTNING = 'lightning';
// To determine the coin type, we first assign numerical values to each letter based on their position in the alphabet.
// For example, "L" is assigned a value of 12, "I" is assigned a value of 9, "G" is assigned a value of 7, and so on.
// So, the coin type would be 8 + 12 + 9 + 7 + 8 + 20 + 14 + 9 + 14 + 7.
const COINTYPE_LIGHTNING = '81297820149147';

const IMPL_LIGHTNING_TESTNET = 'tlightning';
const COINTYPE_LIGHTNING_TESTNET = '81297820149140';

const IMPL_NOSTR = 'nostr';
const COINTYPE_NOSTR = '1237';

const IMPL_DNX = 'dynex';
const COINTYPE_DNX = '29538';

const IMPL_CKB = 'nervos';
const COINTYPE_CKB = '309';

const IMPL_SCDO = 'scdo';
const COINTYPE_SCDO = '541';

const IMPL_ALPH = 'alph';
const COINTYPE_ALPH = '1234';

const IMPL_BFC = 'bfc';
const COINTYPE_BFC = '728';

const IMPL_ALLNETWORKS = 'onekeyall';
const COINTYPE_ALLNETWORKS = '0000';

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
  IMPL_XMR,
  IMPL_KASPA,
  IMPL_NEXA,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  IMPL_NOSTR,
  IMPL_NEURAI,
  IMPL_DNX,
  IMPL_CKB,
  IMPL_ALPH,
  IMPL_ALLNETWORKS,
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
  IMPL_XMR,
  IMPL_KASPA,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  IMPL_NOSTR,
  IMPL_NEXA,
  IMPL_NEURAI,
  IMPL_DNX,
  IMPL_CKB,
  IMPL_ALPH,
  IMPL_ALLNETWORKS,
]);

export const HISTORY_CONSTS = {
  GET_LOCAL_LIMIT: 100,
  FETCH_ON_CHAIN_LIMIT: 50,
  DISPLAY_TX_LIMIT: 50,
  REFRESH_DROPPED_TX_IN: 5 * 60 * 1000,
  SET_IS_FINAL_EXPIRED_IN: 24 * 60 * 60 * 1000,
  PENDING_QUEUE_MAX_LENGTH: 10,
};

export enum EAppSocketEvents {
  'Notification' = 'notification',
}

export const getEnabledAccountDynamicNetworkIds = (): string[] => [
  getNetworkIdsMap().eth,
  getNetworkIdsMap().polygon,
  getNetworkIdsMap().arbitrum,
  getNetworkIdsMap().optimism,
];

// TODO move to networkUtils
export const getEnabledNFTNetworkIds = (): string[] => [
  getNetworkIdsMap().onekeyall,
  getNetworkIdsMap().eth,
  getNetworkIdsMap().optimism,
  getNetworkIdsMap().bsc,
  getNetworkIdsMap().polygon,
  getNetworkIdsMap().arbitrum,
  getNetworkIdsMap().avalanche,
  getNetworkIdsMap().sol,
];

function getSupportedImpls() {
  if (process.env.NODE_ENV === 'production') {
    return PRODUCTION_IMPLS;
  }
  return SUPPORTED_IMPLS;
}

export {
  COINTYPE_ADA,
  COINTYPE_ALGO,
  COINTYPE_ALLNETWORKS,
  COINTYPE_APTOS,
  COINTYPE_BCH,
  COINTYPE_BTC,
  COINTYPE_CFX,
  COINTYPE_COSMOS,
  COINTYPE_DOGE,
  COINTYPE_DOT,
  COINTYPE_ETC,
  COINTYPE_ETH,
  COINTYPE_FIL,
  COINTYPE_KASPA,
  COINTYPE_LIGHTNING,
  COINTYPE_LIGHTNING_TESTNET,
  COINTYPE_LTC,
  COINTYPE_NEAR,
  COINTYPE_NEXA,
  COINTYPE_SOL,
  COINTYPE_STC,
  COINTYPE_SUI,
  COINTYPE_TON,
  COINTYPE_TBTC,
  COINTYPE_TRON,
  COINTYPE_XMR,
  COINTYPE_NOSTR,
  COINTYPE_XRP,
  COINTYPE_NEURAI,
  COINTYPE_DNX,
  COINTYPE_CKB,
  COINTYPE_SCDO,
  COINTYPE_ALPH,
  COINTYPE_BFC,
  IMPL_ADA,
  IMPL_ALGO,
  IMPL_ALLNETWORKS,
  IMPL_APTOS,
  IMPL_BCH,
  IMPL_BTC,
  IMPL_CFX,
  IMPL_COSMOS,
  IMPL_DOGE,
  IMPL_DOT,
  IMPL_EVM,
  IMPL_FIL,
  IMPL_KASPA,
  IMPL_LIGHTNING,
  IMPL_LIGHTNING_TESTNET,
  IMPL_LTC,
  IMPL_NEAR,
  IMPL_NEXA,
  IMPL_SOL,
  IMPL_STC,
  IMPL_SUI,
  IMPL_TON,
  IMPL_TBTC,
  IMPL_TRON,
  IMPL_XMR,
  IMPL_NOSTR,
  IMPL_XRP,
  IMPL_NEURAI,
  IMPL_DNX,
  IMPL_CKB,
  IMPL_SCDO,
  IMPL_ALPH,
  IMPL_BFC,
  INDEX_PLACEHOLDER,
  SEPERATOR,
  getSupportedImpls,
};

// switch network default rpc to onekey rpc node
export const AUTO_SWITCH_DEFAULT_RPC_AT_VERSION = '3.21.0';

export const PRICE_EXPIRED_TIME = timerUtils.getTimeDurationMs({ minute: 15 });

export const ACCOUNT_DERIVATION_DB_MIGRATION_VERSION = '4.0.0';
export const FIX_COSMOS_TEMPLATE_DB_MIGRATION_VERSION = '4.2.0';

export const CHAINS_DISPLAYED_IN_DEV: string[] = [];

// If the token uses these symbols but it is not an official token,
// it will be marked as a risky token and the history containing these tokens can be hidden
export const UNIQUE_TOKEN_SYMBOLS: Record<string, Array<string>> = {
  [IMPL_EVM]: ['USDC', 'USDT'],
};
