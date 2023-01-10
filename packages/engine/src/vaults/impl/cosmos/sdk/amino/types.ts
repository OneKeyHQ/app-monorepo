import type { Coin } from '../../type';

export interface CosmosMsgOpts {
  readonly send: {
    readonly native: MsgOpt;
  };
  readonly ibcTransfer: MsgOpt;
  readonly delegate: MsgOpt;
  readonly undelegate: MsgOpt;
  readonly redelegate: MsgOpt;
  // The gas multiplication per rewards.
  readonly withdrawRewards: MsgOpt;
  readonly govVote: MsgOpt;
  readonly executeWasm: MsgOpt;
}

export const defaultAminoMsgOpts: CosmosMsgOpts = {
  send: {
    native: {
      type: 'cosmos-sdk/MsgSend',
      gas: 80000,
    },
  },
  ibcTransfer: {
    type: 'cosmos-sdk/MsgTransfer',
    gas: 450000,
  },
  delegate: {
    type: 'cosmos-sdk/MsgDelegate',
    gas: 250000,
  },
  undelegate: {
    type: 'cosmos-sdk/MsgUndelegate',
    gas: 250000,
  },
  redelegate: {
    type: 'cosmos-sdk/MsgBeginRedelegate',
    gas: 250000,
  },
  // The gas multiplication per rewards.
  withdrawRewards: {
    type: 'cosmos-sdk/MsgWithdrawDelegationReward',
    gas: 140000,
  },
  govVote: {
    type: 'cosmos-sdk/MsgVote',
    gas: 250000,
  },
  executeWasm: {
    type: 'wasm/MsgExecuteContract',
    gas: 250000,
  },
};

export interface MsgOpt {
  readonly type: string;
  readonly gas: number;
}

export interface StdMsg {
  type: string;
  value: any;
}

export interface StdPublickey {
  readonly type: string;
  readonly value: any;
}

export interface StdFee {
  amount: Coin[];
  gas: string;
}

export interface StdSignature {
  readonly pub_key: StdPublickey;
  readonly signature: string;
}

export interface StdSignDoc {
  readonly chain_id: string;
  readonly account_number: string;
  readonly sequence: string;
  fee: StdFee;
  readonly msgs: StdMsg[];
  readonly memo: string;
}

export interface AminoSignTx extends StdSignDoc {
  readonly signatures: StdSignature[];
}

export interface StdTx {
  readonly msg: readonly StdMsg[];
  readonly fee: StdFee;
  readonly signatures: readonly StdSignature[];
  readonly memo: string | undefined;
}
