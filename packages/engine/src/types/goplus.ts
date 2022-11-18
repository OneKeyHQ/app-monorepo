export interface GoPlusReturnType<T> {
  code: number;
  message: string;
  result: T;
}

export type GoPlusSupportChains = {
  id: string;
  name: string;
};

export type GoPlusDex = {
  name: string;
  liquidity: string;
  pair: string;
};

export type GoPlusHolder = {
  address: string;
  tag: string;
  is_contract: number;
  balance: string;
  percent: string;
  is_locked: number;
};

export type GoPlusLpHolder = {
  address: string;
  tag: string;
  is_contract: number;
  balance: string;
  percent: string;
  is_locked: number;
};

export interface GoPlusTokenSecurity {
  buy_tax: string;
  can_take_back_ownership: string;
  cannot_buy: string;
  cannot_sell_all: string;
  creator_address: string;
  creator_balance: string;
  creator_percent: string;
  dex: GoPlusDex[];
  external_call: string;
  hidden_owner: string;
  holder_count: string;
  holders: GoPlusHolder[];
  is_anti_whale: string;
  is_blacklisted: string;
  is_honeypot: string;
  is_in_dex: string;
  is_mintable: string;
  is_open_source: string;
  is_proxy: string;
  is_whitelisted: string;
  lp_holder_count: string;
  lp_holders: GoPlusLpHolder[];
  lp_total_supply: string;
  is_true_token: string;
  is_airdrop_scam: string;
  owner_address: string;
  owner_balance: string;
  owner_change_balance: string;
  owner_percent: string;
  personal_slippage_modifiable: string;
  selfdestruct: string;
  sell_tax: string;
  slippage_modifiable: string;
  token_name: string;
  token_symbol: string;
  total_supply: string;
  trading_cooldown: string;
  transfer_pausable: string;
  trust_list: string;
}

export interface GoPlusAddressSecurity {
  blacklist_doubt: string;
  honeypot_related_address: string;
  data_source: string;
  contract_address: string;
  phishing_activities: string;
  blackmail_activities: string;
  stealing_attack: string;
  fake_kyc: string;
  malicious_mining_activities: string;
  darkweb_transactions: string;
  cybercrime: string;
  money_laundering: string;
  financial_crime: string;
  mixer: string;
  sanctioned: string;
}

export interface GoPlusTokenApprovalSecurity {
  token_address: string;
  chain_id: string;
  token_name: string;
  token_symbol: string;
  decimals: number;
  balance: string;
  is_open_source: number;
  malicious_address: number;
  malicious_behavior: any[];
  approved_list: Approvedlist[];
}

interface Approvedlist {
  approved_contract: string;
  approved_amount: string;
  approved_time: number;
  hash: string;
  address_info: Addressinfo;
}

interface Addressinfo {
  contract_name?: string | string;
  tag?: (null | string)[];
  creator_address?: string;
  is_contract: number;
  doubt_list: number;
  malicious_behavior: string[];
  deployed_time?: number;
  trust_list: number;
  is_open_source: number;
}

export interface GoPlusNFT1155ApprovalSecurity {
  nft_address: string;
  chain_id: string;
  nft_name: string;
  nft_symbol: string;
  is_open_source: number;
  is_verified: number;
  malicious_address: number;
  malicious_behavior: string[];
  approved_list: NFT1155Approvedlist[];
}

interface NFT1155Approvedlist {
  approved_contract: string;
  approved_time: number;
  hash: string;
  address_info: NFT1155Approvedlist;
}

export interface GoPlusNFT721ApprovalSecurity {
  nft_address: string;
  chain_id: string;
  nft_name: string;
  nft_symbol: string;
  is_open_source: number;
  is_verified: number;
  malicious_address: number;
  malicious_behavior: string[];
  approved_list: NFT721Approvedlist[];
}

interface NFT721Approvedlist {
  approved_contract: string;
  approved_for_all: number;
  approved_token_id?: any;
  approved_time: number;
  hash: string;
  address_info: Addressinfo;
}

export interface GoPlusNFTSecurity {
  nft_address: string;
  traded_volume_24h: number;
  total_volume: number;
  nft_proxy: number;
  restricted_approval: number;
  highest_price: number;
  transfer_without_approval?: any;
  discord_url: string;
  nft_open_source: number;
  privileged_minting: Privilegedminting;
  nft_owner_number: number;
  trust_list: number;
  lowest_price_24h: number;
  average_price_24h: number;
  nft_erc: string;
  creator_address: string;
  medium_url: string;
  malicious_nft_contract: number;
  privileged_burn: Privilegedminting;
  twitter_url: string;
  nft_description: string;
  nft_symbol: string;
  self_destruct: Privilegedminting;
  owner_address: string;
  nft_verified?: any;
  same_nfts?: any;
  batch_minting?: any;
  nft_items: number;
  oversupply_minting?: any;
  nft_name: string;
  github_url?: any;
  website_url: string;
  telegram_url: string;
  sales_24h: number;
  create_block_number: number;
}

interface Privilegedminting {
  owner_address?: string;
  value: number;
  owner_type?: any;
}

export enum GoPlusSupportApis {
  token_security = 'token_security',
  address_security = 'address_security',
  approval_security = 'approval_security',
  token_approval_security = 'token_approval_security',
  nft721_approval_security = 'nft721_approval_security',
  nft1155_approval_security = 'nft1155_approval_security',
  input_decode = 'input_decode',
  nft_security = 'nft_security',
}

export interface GoPlusDappSecurity {
  chainId: string;
  phishing: GoPlusPhishing;
  dappSecurity: DappSecurity;
}

interface DappSecurity {
  project_name: string;
  url: string;
  is_audit: number;
  audit_info: Auditinfo[];
  contracts_security: ContractSecurity[];
}
interface Auditinfo {
  audit_time: string;
  audit_link: string;
  audit_firm: string;
}
export interface GoPlusPhishing {
  phishing_site: number;
  website_contract_security: Websitecontractsecurity[];
}
interface Websitecontractsecurity {
  contract: string;
  standard?: string;
  is_contract: number;
  is_open_source: number;
  nft_risk?: Nftrisk;
  address_risk: any[];
}
interface Nftrisk {
  nft_open_source: number;
  privileged_minting: Privilegedminting;
  oversupply_minting?: any;
  nft_proxy: number;
  restricted_approval: number;
  transfer_without_approval: Privilegedminting;
  privileged_burn: Privilegedminting;
  self_destruct: Privilegedminting;
}

interface ContractSecurity {
  chain_id: number;
  contracts: GoPlusDappContract[];
}

export interface GoPlusDappContract {
  contract_address: string;
  is_open_source: number;
  creator_address: string;
  malicious_contract: number;
  malicious_behavior: any[];
  deployment_time: number;
  malicious_creator: number;
  malicious_creator_behavior: any[];
}

export interface GoPlusApproval {
  token_address: string;
  chain_id: string;
  token_name: string;
  token_symbol: string;
  decimals: number;
  balance: string;
  is_open_source: number;
  malicious_address: number;
  malicious_behavior: string[];
  approved_list: Approvedlist[];
}

interface Approvedlist {
  approved_contract: string;
  approved_amount: string;
  approved_time: number;
  hash: string;
  address_info: Addressinfo;
  approved_for_all?: number;
  approved_token_id?: any;
}

export interface GoPlusNFTApproval {
  nft_address: string;
  chain_id: string;
  nft_name: string;
  nft_symbol: string;
  is_open_source: number;
  is_verified: number;
  malicious_address: number;
  malicious_behavior: string[];
  approved_list: Approvedlist[];
}
