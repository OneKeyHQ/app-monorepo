type IDecodedSTCPayload = {
  ScriptFunction: {
    func: {
      address: string;
      module: string;
      functionName: string;
    };
    args: Array<string>;
    // eslint-disable-next-line camelcase
    ty_args: Array<{
      Struct: { name: string; module: string; address: string };
    }>;
  };
};

type IDecodedTokenTransferPayload = {
  tokenAddress: string;
  to: string;
  amountValue: string;
};
type IDecodedOtherTxPayload = { name: string; params: any };
type IDecodedPayload =
  | { type: 'tokenTransfer'; payload: IDecodedTokenTransferPayload }
  | { type: 'other'; payload: IDecodedOtherTxPayload };
