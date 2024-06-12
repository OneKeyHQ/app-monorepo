import type { ICosmosCoin } from '../../types';

export interface ICosmosMsgOpts {
  readonly send: {
    readonly native: ICosmosMsgOpt;
  };
  readonly ibcTransfer: ICosmosMsgOpt;
  readonly delegate: ICosmosMsgOpt;
  readonly undelegate: ICosmosMsgOpt;
  readonly redelegate: ICosmosMsgOpt;
  // The gas multiplication per rewards.
  readonly withdrawRewards: ICosmosMsgOpt;
  readonly govVote: ICosmosMsgOpt;
  readonly executeWasm: ICosmosMsgOpt;
}

export const defaultAminoMsgOpts: ICosmosMsgOpts = {
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

export interface ICosmosMsgOpt {
  readonly type: string;
  readonly gas: number;
}

export interface ICosmosStdMsg {
  type: string;
  value: any;
}

export interface ICosmosStdPublickey {
  readonly type: string;
  readonly value: any;
}

export interface ICosmosStdFee {
  amount: ICosmosCoin[];
  gas: string;
}

export interface ICosmosStdSignature {
  readonly pub_key: ICosmosStdPublickey;
  readonly signature: string;
}

export interface ICosmosStdSignDoc {
  readonly chain_id: string;
  readonly account_number: string;
  readonly sequence: string;
  fee: ICosmosStdFee;
  readonly msgs: ICosmosStdMsg[];
  readonly memo: string;
}

export interface ICosmosAminoSignTx extends ICosmosStdSignDoc {
  readonly signatures: ICosmosStdSignature[];
}

export interface ICosmosStdTx {
  readonly msg: readonly ICosmosStdMsg[];
  readonly fee: ICosmosStdFee;
  readonly signatures: readonly ICosmosStdSignature[];
  readonly memo: string | undefined;
}
