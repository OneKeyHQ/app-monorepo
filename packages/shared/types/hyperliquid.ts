/* eslint-disable spellcheck/spell-checker */
// eslint-disable-next-line spellcheck/spell-checker
/*
{
    "domain": {
        "name": "HyperliquidSignTransaction",
        "version": "1",
        "chainId": 56,
        "verifyingContract": "0x0000000000000000000000000000000000000000"
    },
    "message": {
        "hyperliquidChain": "Mainnet",
        "signatureChainId": "0x38",
        "agentAddress": "0xb136fc3722053244db201b66a5c436672c750dcf",
        "agentName": "",
        "nonce": 1754457047687,
        "type": "approveAgent"
    },
    "primaryType": "HyperliquidTransaction:ApproveAgent",
    "types": {
        "EIP712Domain": [
            {
                "name": "name",
                "type": "string"
            },
            {
                "name": "version",
                "type": "string"
            },
            {
                "name": "chainId",
                "type": "uint256"
            },
            {
                "name": "verifyingContract",
                "type": "address"
            }
        ],
        "HyperliquidTransaction:ApproveAgent": [
            {
                "name": "hyperliquidChain",
                "type": "string"
            },
            {
                "name": "agentAddress",
                "type": "address"
            },
            {
                "name": "agentName",
                "type": "string"
            },
            {
                "name": "nonce",
                "type": "uint64"
            }
        ]
    }
}
        */
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

/*
{
    "domain": {
        "name": "HyperliquidSignTransaction",
        "version": "1",
        "chainId": 42161,
        "verifyingContract": "0x0000000000000000000000000000000000000000"
    },
    "message": {
        "hyperliquidChain": "Mainnet",
        "maxFeeRate": "0.001%",
        "builder": "0x4ef880525383ab4e3d94b7689e3146bf899a296e",
        "nonce": 1754469395811,
        "signatureChainId": "0xa4b1"
    },
    "primaryType": "HyperliquidTransaction:ApproveBuilderFee",
    "types": {
        "EIP712Domain": [
            {
                "name": "name",
                "type": "string"
            },
            {
                "name": "version",
                "type": "string"
            },
            {
                "name": "chainId",
                "type": "uint256"
            },
            {
                "name": "verifyingContract",
                "type": "address"
            }
        ],
        "HyperliquidTransaction:ApproveBuilderFee": [
            {
                "name": "hyperliquidChain",
                "type": "string"
            },
            {
                "name": "maxFeeRate",
                "type": "string"
            },
            {
                "name": "builder",
                "type": "address"
            },
            {
                "name": "nonce",
                "type": "uint64"
            }
        ]
    }
}
    */

/*
{
    "domain": {
        "name": "HyperliquidSignTransaction",
        "version": "1",
        "chainId": 42161,
        "verifyingContract": "0x0000000000000000000000000000000000000000"
    },
    "message": {
        "type": "approveBuilderFee",
        "hyperliquidChain": "Mainnet",
        "maxFeeRate": "0.025%",
        "builder": "0x4ef880525383ab4e3d94b7689e3146bf899a296e",
        "nonce": 1754469592401,
        "signatureChainId": "0xa4b1"
    },
    "primaryType": "HyperliquidTransaction:ApproveBuilderFee",
    "types": {
        "EIP712Domain": [
            {
                "name": "name",
                "type": "string"
            },
            {
                "name": "version",
                "type": "string"
            },
            {
                "name": "chainId",
                "type": "uint256"
            },
            {
                "name": "verifyingContract",
                "type": "address"
            }
        ],
        "HyperliquidTransaction:ApproveBuilderFee": [
            {
                "name": "maxFeeRate",
                "type": "string"
            },
            {
                "name": "builder",
                "type": "address"
            },
            {
                "name": "hyperliquidChain",
                "type": "string"
            },
            {
                "name": "nonce",
                "type": "uint64"
            }
        ]
    }
}
    */
