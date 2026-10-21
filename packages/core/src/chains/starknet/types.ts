import type {
  EStrk20PrivateTxKind,
  IStrk20Warning,
} from '@onekeyhq/shared/types/starknetPrivacy';

export type IStarknetResourceBoundsItem = {
  max_amount: string;
  max_price_per_unit: string;
};

export type IStarknetResourceBounds = {
  l1_gas: IStarknetResourceBoundsItem;
  l2_gas: IStarknetResourceBoundsItem;
  l1_data_gas: IStarknetResourceBoundsItem;
};

export type IStarknetDataAvailabilityMode = 'L1';

export type IStarknetCall = {
  contractAddress: string;
  entrypoint: string;
  calldata: string[];
};

export type IStarknetSignature = [string, string];

// Accounts are contracts: a fresh one must be deployed before its first invoke
export type IStarknetDeployAccountParams = {
  classHash: string;
  constructorCalldata: string[];
  addressSalt: string;
  nonce: string;
  resourceBounds: IStarknetResourceBounds;
};

// Invoke v3. Numerics stay hex strings: encodedTx crosses the bg/main boundary
export type IEncodedTxStarknet = {
  chainId: string;
  from: string;
  version: '0x3';
  nonce: string;
  calls: IStarknetCall[];
  resourceBounds: IStarknetResourceBounds;
  tip: string;
  paymasterData: string[];
  accountDeploymentData: string[];
  nonceDataAvailabilityMode: IStarknetDataAvailabilityMode;
  feeDataAvailabilityMode: IStarknetDataAvailabilityMode;
  deployAccount?: IStarknetDeployAccountParams;
  /**
   * Present only on a STRK20 private transfer. One nullable block rather than
   * loose optional fields, so the ordinary path is provably untouched: every
   * privacy branch keys on `privacy` being set.
   */
  privacy?: IEncodedTxStarknetPrivacy;
};

export type IEncodedTxStarknetPrivacy = {
  poolAddress: string;
  kind: EStrk20PrivateTxKind;
  /** Committed into the invoke hash; omitting them yields a rejected signature. */
  proofFacts: string[];
  /** Rides beside the invoke on addInvokeTransaction; never hashed. */
  proof: string;
  tokenAddress?: string;
  /** Base units, decimal string. */
  amount?: string;
  recipient?: string;
  /** Pool fee read from chain at build time, STRK base units, decimal string. */
  protocolFee?: string;
  /** Finalized block the proof was built against, never a block tag. */
  provingBlockId: number;
  /** Wall clock at build time; a deposit attestation is only valid 300s. */
  builtAt: number;
  warnings?: IStrk20Warning[];
};

/**
 * Payload for the one signature the privacy SDK asks for. The sender is the
 * POOL, not the account: the pool validates the account's signature on-chain
 * through SNIP-6 `is_valid_signature`, so any "sender == my address" assertion
 * here would be wrong.
 */
export type IStrk20ProofInvocationPayload = {
  poolAddress: string;
  version: '0x3';
  calls: IStarknetCall[];
  chainId: string;
  nonce: string;
  accountDeploymentData: string[];
  nonceDataAvailabilityMode: IStarknetDataAvailabilityMode;
  feeDataAvailabilityMode: IStarknetDataAvailabilityMode;
  resourceBounds: IStarknetResourceBounds;
  tip: string;
  paymasterData: string[];
};

export type IStarknetSignedInvoke = {
  type: 'INVOKE';
  version: '0x3';
  sender_address: string;
  calldata: string[];
  signature: IStarknetSignature;
  nonce: string;
  resource_bounds: IStarknetResourceBounds;
  tip: string;
  paymaster_data: string[];
  account_deployment_data: string[];
  nonce_data_availability_mode: IStarknetDataAvailabilityMode;
  fee_data_availability_mode: IStarknetDataAvailabilityMode;
  /** STRK20 only. Hashed into the invoke, so it must match what was signed. */
  proof_facts?: string[];
};

export type IStarknetSignedDeployAccount = {
  type: 'DEPLOY_ACCOUNT';
  version: '0x3';
  class_hash: string;
  contract_address_salt: string;
  constructor_calldata: string[];
  signature: IStarknetSignature;
  nonce: string;
  resource_bounds: IStarknetResourceBounds;
  tip: string;
  paymaster_data: string[];
  nonce_data_availability_mode: IStarknetDataAvailabilityMode;
  fee_data_availability_mode: IStarknetDataAvailabilityMode;
};

// Carried in ISignedTxPro.rawTx; RPC-cased so kit-bg can broadcast it as-is
export type IStarknetRawTx = {
  invoke: IStarknetSignedInvoke;
  invokeTxHash: string;
  deployAccount?: IStarknetSignedDeployAccount;
  deployAccountTxHash?: string;
  /** STRK20 only. Sits beside the invoke in BROADCASTED_INVOKE_TXN, not in it. */
  proof?: string;
};

export interface IDecodedTxExtraStarknet {
  // Set only when this tx also deploys the account. Fee is a decimal string in FRI.
  deployAccountFee?: string;
  // tx hash of the counterfactual DEPLOY_ACCOUNT broadcast alongside the invoke
  deployAccountTxId?: string;
  /**
   * STRK20 intent, copied out of `encodedTx.privacy` by `buildDecodedTx`. The
   * confirm screen reads this rather than the encodedTx, and it deliberately
   * omits `proof`, `proofFacts`, `provingBlockId` and `builtAt`: none of those
   * are display data.
   */
  privacy?: IDecodedTxPrivacyStarknet;
}

export type IDecodedTxPrivacyStarknet = {
  kind: EStrk20PrivateTxKind;
  poolAddress: string;
  tokenAddress?: string;
  /** Base units, decimal string — same unit as IStrk20PrivateBalances.byToken. */
  amount?: string;
  recipient?: string;
  /** STRK base units, decimal string. */
  protocolFee?: string;
  warnings?: IStrk20Warning[];
};
