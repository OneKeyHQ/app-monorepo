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
  denom_units: DenomUnit[];
  type_asset?: string;
  base: string;
  name: string;
  display: string;
  symbol: string;
  logo_URIs: LogoUrIs;
  coingecko_id?: string;
  traces?: Trace[];
}

export interface Trace {
  type: string;
  counterparty: Counterparty;
  chain: Chain;
}

export interface Chain {
  channel_id: string;
  path: string;
}

export interface Counterparty {
  chain_name: string;
  base_denom: string;
  channel_id: string;
}

export interface DenomUnit {
  denom: string;
  exponent: number;
}

export interface LogoUrIs {
  png: string;
  svg: string;
}

export enum Type {
  Erc20 = 'erc20',
  Native = 'native',
  Staking = 'staking',
  Ibc = 'ibc',
  Bridge = 'bridge',
}

export interface Transaction {
  header: Header;
  data: Data;
}

export interface Data {
  height: string;
  txhash: string;
  codespace: string;
  code: number;
  data: string;
  info: string;
  gas_wanted: string;
  gas_used: string;
  tx: Tx;
  timestamp: string;
}

export interface Tx {
  '@type': string;
  body: Body;
  auth_info: AuthInfo;
  signatures: string[];
}

export interface AuthInfo {
  signer_infos: SignerInfo[];
  fee: Fee;
}

export interface Fee {
  amount: Amount[];
  gas_limit: string;
  payer: string;
  granter: string;
}

export interface Amount {
  denom: string;
  amount: string;
}

export interface SignerInfo {
  public_key: PublicKey;
  mode_info: ModeInfo;
  sequence: string;
}

export interface ModeInfo {
  single: Single;
}

export interface Single {
  mode: string;
}

export interface PublicKey {
  '@type': string;
  key: string;
}

export interface Body {
  messages: Message[];
  memo: string;
  timeout_height: string;
  extension_options: any[];
  non_critical_extension_options: any[];
}

export interface Message {
  '@type': string;
}

export interface Header {
  id: number;
  chain_id: string;
  block_id: number;
  timestamp: Date;
}
