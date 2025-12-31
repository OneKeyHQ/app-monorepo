/* eslint-disable spellcheck/spell-checker */
import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { presetNetworksMap } from '../config/presetNetworks';
import numberUtils from '../utils/numberUtils';
import timerUtils from '../utils/timerUtils';

export const HYPER_LIQUID_ORIGIN = 'https://app.hyperliquid.xyz';
export const HYPER_LIQUID_WEBVIEW_TRADE_URL = `${HYPER_LIQUID_ORIGIN}/trade?isOneKeyBuiltInPerpView=true`;

export const PERPS_ROUTE_PATH = '/perps';
export const HYPERLIQUID_AGENT_CREDENTIAL_PREFIX = 'hyperliquid-agent';
export const HYPERLIQUID_REFERRAL_CODE = '1KGO';
export const HYPERLIQUID_AGENT_TTL_DEFAULT = timerUtils.getTimeDurationMs({
  month: 1,
});
export enum EHyperLiquidAgentName {
  Official = '',
  OneKeyAgent1 = 'OneKeyAgent1',
  OneKeyAgent2 = 'OneKeyAgent2',
  OneKeyAgent3 = 'OneKeyAgent3',
  // Desktop = 'OneKey-Desktop',
  // iOS = 'OneKey-iOS',
  // Android = 'OneKey-Android',
  // Web = 'OneKey-Web',
  // Extension = 'OneKey-Extension',
}
export const HYPER_LIQUID_CUSTOM_LOCAL_STORAGE_V2_PRESET = {
  'hyperliquid.pending_referral_code': {
    value: `"${HYPERLIQUID_REFERRAL_CODE}"`, // 1KGO
    skipIfExists: false,
  },
};

export const FALLBACK_BUILDER_ADDRESS =
  '0x9b12E858dA780a96876E3018780CF0D83359b0bb' as IHex;

export const FALLBACK_MAX_BUILDER_FEE = 40;

export const PERPS_EMPTY_ADDRESS =
  '0x0000000000000000000000000000000000000000' as IHex;

// 'id': 'evm--42161',
export const PERPS_NETWORK_ID: string = presetNetworksMap.arbitrum.id;
export const PERPS_ETH_NETWORK_ID: string = presetNetworksMap.eth.id;
// 'chainId': '42161',
export const PERPS_EVM_CHAIN_ID_NUM: string =
  presetNetworksMap.arbitrum.chainId;
// '0xa4b1'
export const PERPS_EVM_CHAIN_ID_HEX: `0x${string}` = numberUtils.numberToHex(
  PERPS_EVM_CHAIN_ID_NUM,
  {
    prefix0x: true,
  },
) as `0x${string}`;

export const PERPS_USER_FILLS_TIME_RANGE = timerUtils.getTimeDurationMs({
  day: 15,
});

export const PERPS_HISTORY_FILLS_URL = 'https://hypurrscan.io/address/';

/**
 * Filtered transaction types in account ledger history
 *
 * These types are not displayed in the Account tab because:
 * - spotTransfer: Spot account transfers, not relevant to Perp account balance
 * - vaultDeposit/vaultWithdraw/vaultDistribution: Vault operations, not direct user actions
 * - vaultLeaderCommission: Vault leader commission, automatic distribution
 * - spotGenesis: System initialization, not user operations
 * - cStakingTransfer: C-Staking transfers, not Perp account operations
 */
export const PERPS_FILTERED_LEDGER_TYPES = new Set<string>([
  'spotTransfer',
  'vaultDistribution',
  'vaultWithdraw',
  'vaultDeposit',
  'spotGenesis',
  'cStakingTransfer',
  'vaultLeaderCommission',
  'rewardsClaim',
]);

// Disable wallet binding on perps page
export const DISABLE_PERPS_WALLET_BIND = false;
