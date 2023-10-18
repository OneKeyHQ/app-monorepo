import type { Coin } from '../type';
import type { Any } from 'cosmjs-types/google/protobuf/any';

export enum MessageType {
  SEND = '/cosmos.bank.v1beta1.MsgSend',
  DELEGATE = '/cosmos.staking.v1beta1.MsgDelegate',
  UNDELEGATE = '/cosmos.staking.v1beta1.MsgUndelegate',
  REDELEGATE = '/cosmos.staking.v1beta1.MsgBeginRedelegate',
  CREATE_VALIDATOR = '/cosmos.staking.v1beta1.MsgCreateValidator',
  EDIT_VALIDATOR = '/cosmos.staking.v1beta1.MsgEditValidator',

  WITHDRAW_DELEGATOR_REWARD = '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward',
  WITHDRAW_VALIDATOR_COMMISSION = '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission',
  SET_WITHDRAW_ADDRESS = '/cosmos.distribution.v1beta1.MsgSetWithdrawAddress',
  VOTE = '/cosmos.gov.v1beta1.MsgVote',
  SUBMIT_PROPOSAL = '/cosmos.gov.v1beta1.MsgSubmitProposal',
  DEPOSIT = '/cosmos.gov.v1beta1.MsgDeposit',
  UNJAIL = '/cosmos.slashing.v1beta1.MsgUnjail',
  IBC_TRANSFER = '/ibc.applications.transfer.v1.MsgTransfer',
  GRANT = '/cosmos.authz.v1beta1.MsgGrant',
  REVOKE = '/cosmos.authz.v1beta1.MsgRevoke',
  INSTANTIATE_CONTRACT = '/cosmwasm.wasm.v1.MsgInstantiateContract',
  EXECUTE_CONTRACT = '/cosmwasm.wasm.v1.MsgExecuteContract',
  TERRA_EXECUTE_CONTRACT = '/terra.wasm.v1beta1.MsgExecuteContract',
}

export class UnknownMessage implements Any {
  protected readonly _typeUrl: string;

  protected readonly _value: Uint8Array;

  constructor(_typeUrl: string, _value: Uint8Array) {
    this._typeUrl = _typeUrl;
    this._value = _value;
  }

  get typeUrl(): string {
    return this._typeUrl;
  }

  get value(): Uint8Array {
    return this._value;
  }

  toJSON() {
    return {
      type_url: this._typeUrl,
      value: Buffer.from(this._value).toString('base64'),
    };
  }
}

// ======== RPC ========
export interface Message {
  '@type': string;
}

export interface SendMessage extends Message {
  readonly fromAddress: string;
  readonly toAddress: string;
  amount: Coin[];
}
