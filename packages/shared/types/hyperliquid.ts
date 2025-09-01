/* eslint-disable spellcheck/spell-checker */
// eslint-disable-next-line spellcheck/spell-checker

export type IHyperLiquidEIP712Domain = {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
};

export type IHyperLiquidEIP712Type = {
  name: string;
  type: string;
};

export type IHyperLiquidMessageApproveAgent = {
  hyperliquidChain: string;
  signatureChainId: string;
  nonce: number;
  type: 'approveAgent';
  agentAddress: string;
  agentName: string;
};

// https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/utils/signing.py#L395
// eslint-disable-next-line spellcheck/spell-checker
/*
{"name": "hyperliquidChain", "type": "string"},
{"name": "maxFeeRate", "type": "string"},
{"name": "builder", "type": "address"},
{"name": "nonce", "type": "uint64"},
*/
export type IHyperLiquidMessageApproveBuilderFee = {
  // action = {"maxFeeRate": max_fee_rate, "builder": builder, "nonce": timestamp, "type": "approveBuilderFee"}
  // action["hyperliquidChain"] = "Mainnet" if is_mainnet else "Testnet"
  // action["signatureChainId"] = "0x66eee"
  // https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/utils/signing.py#L233
  hyperliquidChain: string;
  signatureChainId: string;
  nonce: number;
  type?: 'approveBuilderFee'; // approveBuilderFee
  builder: string;
  maxFeeRate: string;
};

export type IHyperLiquidTypedDataApproveAgent = {
  domain: IHyperLiquidEIP712Domain;
  message: IHyperLiquidMessageApproveAgent;
  primaryType: 'HyperliquidTransaction:ApproveAgent';
  types: {
    EIP712Domain: IHyperLiquidEIP712Type[];
    // https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/utils/signing.py#L385
    ['HyperliquidTransaction:ApproveAgent']: IHyperLiquidEIP712Type[];
  };
};

export type IHyperLiquidTypedDataApproveBuilderFee = {
  domain: IHyperLiquidEIP712Domain;
  message: IHyperLiquidMessageApproveBuilderFee;
  primaryType: 'HyperliquidTransaction:ApproveBuilderFee';
  types: {
    EIP712Domain: IHyperLiquidEIP712Type[];
    // https://github.com/hyperliquid-dex/hyperliquid-python-sdk/blob/master/hyperliquid/utils/signing.py#L400
    ['HyperliquidTransaction:ApproveBuilderFee']: IHyperLiquidEIP712Type[];
  };
};

export type IHyperLiquidSignatureRSV = {
  r: string;
  s: string;
  v: number;
};

export type IHyperLiquidUserBuilderFeeStatus = {
  isApprovedDone: boolean;
  canSetBuilderFee: boolean;
  currentMaxBuilderFee: number;
  expectMaxBuilderFee: number;
  expectBuilderAddress: string;
  accountValue: string | null;
  shouldModifyPlaceOrderPayload: boolean;
};
