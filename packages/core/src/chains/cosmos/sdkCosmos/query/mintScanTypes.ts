export interface ICosmosRelayerPaths {
  chain_id: string;
  paths: ICosmosPath[];
}

export interface ICosmosPath {
  channel_id: string;
  port_id: ECosmosPortID;
  channel_state: ECosmosChannelState;
  counter_party: {
    channel_id: string;
    port_id: string;
    channel_state: ECosmosChannelState;
  };
  auth: boolean;
  stats: {
    current: ICosmosCurrent;
    past: ICosmosCurrent;
  };
  created_at: Date | null;
}

export enum ECosmosChannelState {
  StateClosed = 'STATE_CLOSED',
  StateOpen = 'STATE_OPEN',
  StateTryopen = 'STATE_TRYOPEN',
}

export enum ECosmosPortID {
  Icahost = 'icahost',
  Transfer = 'transfer',
}

export interface ICosmosCurrent {
  tx_num: ICosmosTxNum;
  vol: ICosmosTxNum;
}

export interface ICosmosTxNum {
  transfer: number | null;
  receive: number | null;
}

export interface ICosmosCw20AssetInfo {
  id: number;
  chain: string;
  contract_address: string;
  denom: string;
  decimal: number;
  display: number;
  logo: string;
  default: boolean;
  coingecko_id: string;
}

export interface ICosmosContractsInfo {
  tx_hash: string;
  code_id: number;
  creator: string;
  contract_address: string;
  admin: string;
  label: string;
  funds: any[];
  messages: {
    name: string;
    symbol: string;
    decimals: number;
    initial_balances: {
      address: string;
      amount: string;
    }[];
    marketing: {
      marketing: string;
      description: string;
      logo: {
        url: string;
      };
      project: string;
    };
  };
  executed_count: number;
  permission: null;
  permitted_address: null;
  contract: string;
  version: string;
  instantiated_at: Date;
  last_executed_at: Date;
}

export interface ICosmosAssetInfo {
  chain: string;
  denom: string;
  type: ECosmosType;
  base_denom: string;
  base_type: ECosmosType;
  dp_denom: string;
  origin_chain: string;
  decimal: number;
  description?: string;
  image: string;
  coinGeckoId: string;
  path?: string;
  channel?: string;
  port?: string;
  counter_party?: {
    channel: string;
    port: string;
    denom: string;
  };
  contract?: string;
}

export enum ECosmosType {
  // eslint-disable-next-line spellcheck/spell-checker
  Erc20 = 'erc20',
  Native = 'native',
  Staking = 'staking',
  Ibc = 'ibc',
  Bridge = 'bridge',
}

export interface ICosmosTransaction {
  header: ICosmosHeader;
  data: ICosmosData;
}

export interface ICosmosData {
  height: string;
  txhash: string;
  codespace: string;
  code: number;
  data: string;
  info: string;
  gas_wanted: string;
  gas_used: string;
  tx: ICosmosTx;
  timestamp: string;
}

export interface ICosmosTx {
  '@type': string;
  body: ICosmosBody;
  auth_info: ICosmosAuthInfo;
  signatures: string[];
}

export interface ICosmosAuthInfo {
  signer_infos: ICosmosSignerInfo[];
  fee: ICosmosFee;
}

export interface ICosmosFee {
  amount: ICosmosAmount[];
  gas_limit: string;
  payer: string;
  granter: string;
}

export interface ICosmosAmount {
  denom: string;
  amount: string;
}

export interface ICosmosSignerInfo {
  public_key: ICosmosPublicKey;
  mode_info: ICosmosModeInfo;
  sequence: string;
}

export interface ICosmosModeInfo {
  single: ICosmosSingle;
}

export interface ICosmosSingle {
  mode: string;
}

export interface ICosmosPublicKey {
  '@type': string;
  key: string;
}

export interface ICosmosBody {
  messages: ICosmosMessage[];
  memo: string;
  timeout_height: string;
  extension_options: any[];
  non_critical_extension_options: any[];
}

export interface ICosmosMessage {
  '@type': string;
}

export interface ICosmosHeader {
  id: number;
  chain_id: string;
  block_id: number;
  timestamp: Date;
}
