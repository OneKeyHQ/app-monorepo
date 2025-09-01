// Security alert configuration for different blockchain types
// This config can be replaced by API calls in the future

export interface ISecurityConfig {
  warningKeys: {
    common: string[];
    solana: string[];
    sui: string[];
  };
  trustKeys: string[];
  taxKeys: string[];
  hideSecurityAlertKeys: string[];
}

// Default security configuration
export const DEFAULT_SECURITY_CONFIG: ISecurityConfig = {
  warningKeys: {
    common: [
      'is_honeypot',
      'is_proxy',
      'cannot_sell_all',
      'is_anti_whale',
      'is_blacklisted',
      'external_call',
      'hidden_owner',
      'is_mintable',
      'can_take_back_ownership',
      'owner_change_balance',
      'cannot_buy',
      'transfer_pausable',
    ],
    solana: [
      'is_balance_mutable_authority',
      'closable',
      'is_metadata_upgrade_authority',
      'freezable',
      'mintable',
      'non_transferable',
      'transfer_fee_upgradable',
      'transfer_hook_upgradable',
    ],
    sui: [
      'is_blacklisted',
      'is_contract_upgradeable',
      'is_metadata_modifiable',
      'is_mintable',
    ],
  },
  trustKeys: [
    'trusted_token',
    'is_trusted_token',
    'trust_list',
    'is_open_source',
  ],
  taxKeys: ['buy_tax', 'sell_tax', 'transfer_tax'],
  hideSecurityAlertKeys: ['trust_list'],
};

// Get security configuration (can be replaced by API call in the future)
export const getSecurityConfig = (): ISecurityConfig => {
  // Future: Replace with API call
  // return await fetchSecurityConfig();
  return DEFAULT_SECURITY_CONFIG;
};
