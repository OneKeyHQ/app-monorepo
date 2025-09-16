import type { IHex } from '@onekeyhq/shared/types/hyperliquid/sdk';

import { getNetworkIdsMap } from '../config/networkIds';

export const HYPER_LIQUID_ORIGIN = 'https://app.hyperliquid.xyz';
export const HYPER_LIQUID_WEBVIEW_TRADE_URL = `${HYPER_LIQUID_ORIGIN}/trade?isOneKeyBuiltInPerpView=true`;
export const HYPERLIQUID_AGENT_CREDENTIAL_PREFIX = 'hyperliquid-agent';
export const HYPERLIQUID_REFERRAL_CODE = '1KGO';
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

export const PERPS_CHAIN_ID = getNetworkIdsMap().arbitrum;
