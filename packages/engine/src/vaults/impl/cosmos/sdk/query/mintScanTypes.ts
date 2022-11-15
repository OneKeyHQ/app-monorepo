export interface RelayerPaths {
  chain_id: string;
  paths: Path[];
}

export interface Path {
  channel_id: string;
  port_id: PortID;
  channel_state: ChannelState;
  counter_party: {
    channel_id: string;
    port_id: string;
    channel_state: ChannelState;
  };
  auth: boolean;
  stats: {
    current: Current;
    past: Current;
  };
  created_at: Date | null;
}

export enum ChannelState {
  StateClosed = 'STATE_CLOSED',
  StateOpen = 'STATE_OPEN',
  StateTryopen = 'STATE_TRYOPEN',
}

export enum PortID {
  Icahost = 'icahost',
  Transfer = 'transfer',
}

export interface Current {
  tx_num: TxNum;
  vol: TxNum;
}

export interface TxNum {
  transfer: number | null;
  receive: number | null;
}

export interface Cw20AssetInfo {
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

export interface ContractsInfo {
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

export interface AssetInfo {
  chain: string;
  denom: string;
  type: Type;
  base_denom: string;
  base_type: Type;
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

export enum Type {
  Erc20 = 'erc20',
  Native = 'native',
  Staking = 'staking',
  Ibc = 'ibc',
  Bridge = 'bridge',
}
