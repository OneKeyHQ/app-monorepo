export const HYPER_LIQUID_ORIGIN = 'https://app.hyperliquid.xyz';
export const HYPER_LIQUID_WEBVIEW_TRADE_URL = `${HYPER_LIQUID_ORIGIN}/trade?isOneKeyBuiltInPerpView=true`;
export const HYPERLIQUID_AGENT_CREDENTIAL_PREFIX = 'hyperliquid-agent';
export enum EHyperLiquidAgentName {
  Official = '',
  Desktop = 'OneKey-Desktop',
  iOS = 'OneKey-iOS',
  Android = 'OneKey-Android',
  Web = 'OneKey-Web',
  Extension = 'OneKey-Extension',
}
export const HYPER_LIQUID_CUSTOM_LOCAL_STORAGE_V2_PRESET = {
  'hyperliquid.pending_referral_code': {
    value: `"1KGO"`, // 1KGO
    skipIfExists: false,
  },
};
