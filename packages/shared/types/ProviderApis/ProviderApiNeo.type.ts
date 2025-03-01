export const NeoDApiErrors = {
  MALFORMED_INPUT: {
    type: 'MALFORMED_INPUT',
    description: 'Please check your input',
    data: null,
  },
};

export interface IArgument {
  type:
    | 'String'
    | 'Boolean'
    | 'Hash160'
    | 'Hash256'
    | 'Integer'
    | 'ByteArray'
    | 'Array'
    | 'Address';
  value: any;
}

export interface IInvokeArguments {
  scriptHash: string;
  operation: string;
  args: IArgument[];
}

export interface ISigners {
  account: string;
  scopes: string;
  allowedContracts?: string[];
  allowedGroups?: string[];
}

export interface IInvokeParams {
  scriptHash: string;
  operation: string;
  args: IArgument[];
  fee?: string;
  extraSystemFee?: string;
  overrideSystemFee?: string;
  broadcastOverride?: boolean;
  signers: ISigners[];
}

export interface IInvokeMultipleParams {
  fee?: string;
  extraSystemFee?: string;
  overrideSystemFee?: string;
  invokeArgs?: IInvokeArguments[];
  broadcastOverride?: boolean;
  signers: ISigners[];
}

export interface IInvokeResponse {
  txid?: string;
  nodeURL?: string;
  signedTx?: string;
}

export interface ISignMessageV2Params {
  message: string;
  isJsonObject?: boolean;
}

export interface ISignMessageV2Response {
  publicKey: string;
  data: string;
  salt?: string;
  message: string;
}

export interface ISignMessageWithoutSaltV2Response {
  publicKey: string;
  data: string;
  message: string;
}
