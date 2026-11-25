import {
  CallData,
  EDataAvailabilityMode,
  ec,
  hash,
  num,
  stark,
  transaction,
  typedData,
  validateAndParseAddress,
} from 'starknet';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { EAddressEncodings } from '@onekeyhq/shared/src/types/address';

import { BaseBip32KeyDeriver } from '../../../secret/bip32';
import { secp256k1 } from '../../../secret/curves';

import {
  normalizeStarknetChainId,
  tryNormalizeStarknetChainId,
} from './chainId';

import type {
  IStarknetCall,
  IStarknetResourceBounds,
  IStarknetResourceBoundsItem,
  IStarknetSignature,
} from '../types';
import type { ResourceBoundsBN, constants } from 'starknet';

// OpenZeppelin account v1.0.0, the OZ class OneKey firmware signs for; declared
// on mainnet and Sepolia, constructor takes one public_key felt
export const OPENZEPPELIN_ACCOUNT_CLASS_HASH =
  '0x5b4b537eaa2399e3aa99c4e2e0208ebd6c71bc1467938cd52c798c601e43564';

// Argent account v0.4.0, the class Argent X / Ready deploys for new accounts;
// constructor(owner: Signer, guardian: Option<Signer>)
export const ARGENT_ACCOUNT_CLASS_HASH =
  '0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f';

// OKX Wallet derives the account address from its proxy and initializer.
export const OKX_PROXY_CLASS_HASH =
  '0x3530cc4759d78042f1b543bf797f5f3d647cde0388c33734cf91b7f7b9314a9';
const OKX_IMPLEMENTATION_CLASS_HASH =
  '0x309c042d3729173c7f2f91a34f04d8c509c1b292d334679ef1aabf8da0899cc';

export type IStarknetAccountContract = 'argent' | 'openZeppelin' | 'okx';

// The default derive type carries no encoding and is the Argent account
export function getAccountContractByEncoding(
  addressEncoding: EAddressEncodings | undefined,
): IStarknetAccountContract {
  if (addressEncoding === EAddressEncodings.STARKNET_OZ) {
    return 'openZeppelin';
  }
  if (addressEncoding === EAddressEncodings.STARKNET_OKX) {
    return 'okx';
  }
  return 'argent';
}

// Argent X and OKX derive the Ethereum account key first and seed BIP32 with it
export const ARGENT_SEED_KEY_PATH = "m/44'/60'/0'/0/0";

/** OpenZeppelin accounts are Cairo 1 contracts, so __execute__ uses the v1 calldata layout. */
const CAIRO_VERSION = '1';

export type IStarknetTypedData = Parameters<typeof typedData.getMessageHash>[0];

export function toStarknetChainId(chainId: string): constants.StarknetChainId {
  return normalizeStarknetChainId(chainId) as constants.StarknetChainId;
}

export function isSameStarknetChainId(a: string, b: string): boolean {
  const normalizedA = tryNormalizeStarknetChainId(a);
  const normalizedB = tryNormalizeStarknetChainId(b);
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}

// JSON-RPC felts are 0x-hex with no leading zeros, but starknet.js calldata
// builders emit decimals; convert before anything leaves for the RPC.
export function toFelt(value: string): string {
  return num.toHex(value);
}

export function toFeltArray(values: string[]): string[] {
  return values.map(toFelt);
}

export function toRpcResourceBounds(
  bounds: IStarknetResourceBounds,
): IStarknetResourceBounds {
  const toItem = (item: IStarknetResourceBoundsItem) => ({
    max_amount: toFelt(item.max_amount),
    max_price_per_unit: toFelt(item.max_price_per_unit),
  });
  return {
    l1_gas: toItem(bounds.l1_gas),
    l2_gas: toItem(bounds.l2_gas),
    l1_data_gas: toItem(bounds.l1_data_gas),
  };
}

const MAX_U64 = (1n << 64n) - 1n;
const MAX_U128 = (1n << 128n) - 1n;

export function toResourceBoundsBN(
  bounds: IStarknetResourceBounds,
): ResourceBoundsBN {
  const toItem = (item: { max_amount: string; max_price_per_unit: string }) => {
    const maxAmount = BigInt(item.max_amount);
    const maxPricePerUnit = BigInt(item.max_price_per_unit);
    if (maxAmount < 0n || maxAmount > MAX_U64) {
      throw new OneKeyLocalError(
        `Invalid Starknet resource bound max_amount: ${item.max_amount}`,
      );
    }
    if (maxPricePerUnit < 0n || maxPricePerUnit > MAX_U128) {
      throw new OneKeyLocalError(
        `Invalid Starknet resource bound max_price_per_unit: ${item.max_price_per_unit}`,
      );
    }
    return {
      max_amount: maxAmount,
      max_price_per_unit: maxPricePerUnit,
    };
  };
  return {
    l1_gas: toItem(bounds.l1_gas),
    l2_gas: toItem(bounds.l2_gas),
    l1_data_gas: toItem(bounds.l1_data_gas),
  };
}

export function toDataAvailabilityMode(mode: 'L1') {
  // stark.intDAM maps the RPC string form to the felt used inside the tx hash
  return stark.intDAM(EDataAvailabilityMode[mode]);
}

export function normalizeAddress(address: string): string {
  // 0x + 64 lowercase hex
  return validateAndParseAddress(address);
}

// Argent X convention: grind the secp256k1 child key into the Stark curve order
export function grindStarkPrivateKey(secp256k1PrivateKey: Buffer): string {
  return normalizeStarkPrivateKey(ec.starkCurve.grindKey(secp256k1PrivateKey));
}

const argentSeedDeriver = new BaseBip32KeyDeriver(
  Buffer.from('Bitcoin seed'),
  secp256k1,
);

function parseBip32Path(path: string): number[] {
  const [root, ...segments] = path.split('/');
  if (root !== 'm') {
    throw new OneKeyLocalError(`Invalid derivation path: ${path}`);
  }
  return segments.map((segment) => {
    const hardened = segment.endsWith("'");
    const digits = hardened ? segment.slice(0, -1) : segment;
    if (!/^\d+$/.test(digits) || Number(digits) >= 2 ** 31) {
      throw new OneKeyLocalError(`Invalid derivation path: ${path}`);
    }
    return hardened ? Number(digits) + 2 ** 31 : Number(digits);
  });
}

function deriveFromEthereumSeed(seed: Buffer, path: string): string {
  let node = argentSeedDeriver.generateMasterKeyFromSeed(seed);
  for (const index of parseBip32Path(path)) {
    node = argentSeedDeriver.CKDPriv(node, index);
  }
  return grindStarkPrivateKey(node.key);
}

/**
 * Argent X Stark key: BIP32 seeded with the Ethereum account key, then the
 * child at `path` is ground. Argent passes that key through num.toHex, so
 * leading zero bytes are dropped from the seed; keep that or 1 in 256 wallets
 * derive a different key.
 */
export function deriveArgentStarkPrivateKey(
  ethereumPrivateKey: Buffer,
  path: string,
): string {
  let start = 0;
  while (
    start < ethereumPrivateKey.length - 1 &&
    ethereumPrivateKey[start] === 0
  ) {
    start += 1;
  }
  return deriveFromEthereumSeed(ethereumPrivateKey.subarray(start), path);
}

// OKX Wallet: the Argent X scheme, but the seed is the full 32-byte key
export function deriveOkxStarkPrivateKey(
  ethereumPrivateKey: Buffer,
  path: string,
): string {
  return deriveFromEthereumSeed(ethereumPrivateKey, path);
}

// Stark felts are often short or odd-length; pad to 64 hex before any byte parsing
export function normalizeStarkPrivateKey(privateKey: string | Buffer): string {
  if (Buffer.isBuffer(privateKey) && privateKey.length !== 32) {
    // stored key material is always 32 bytes; a short buffer means truncation
    throw new OneKeyLocalError(
      `Invalid Stark private key length: ${privateKey.length}`,
    );
  }
  const raw = Buffer.isBuffer(privateKey)
    ? privateKey.toString('hex')
    : privateKey.replace(/^0x/i, '');
  if (!/^[0-9a-fA-F]{1,64}$/.test(raw)) {
    throw new OneKeyLocalError('Invalid Stark private key');
  }
  const padded = raw.toLowerCase().padStart(64, '0');
  const value = BigInt(`0x${padded}`);
  if (value < BigInt(1) || value >= ec.starkCurve.CURVE.n) {
    throw new OneKeyLocalError(
      'Invalid Stark private key: out of range [1, Stark curve order)',
    );
  }
  return `0x${padded}`;
}

export function getStarkPublicKey(starkPrivateKey: string): string {
  // x-coordinate of the Stark public key, leading zeros stripped
  return ec.starkCurve.getStarkKey(starkPrivateKey);
}

export function getAccountDeployParams(
  publicKey: string,
  accountContract: IStarknetAccountContract,
): {
  classHash: string;
  constructorCalldata: string[];
  addressSalt: string;
  contractAddress: string;
} {
  const salt = toFelt(publicKey);
  let classHash: string;
  let constructorCalldata: string[];
  if (accountContract === 'argent') {
    classHash = ARGENT_ACCOUNT_CLASS_HASH;
    // Signer::Starknet is variant 0, Option::None (no guardian) is variant 1
    constructorCalldata = toFeltArray(['0', salt, '1']);
  } else if (accountContract === 'okx') {
    classHash = OKX_PROXY_CLASS_HASH;
    constructorCalldata = toFeltArray(
      CallData.compile({
        implementation: OKX_IMPLEMENTATION_CLASS_HASH,
        selector: hash.getSelectorFromName('initialize'),
        calldata: [salt, '0'], // signer and guardian
      }),
    );
  } else {
    classHash = OPENZEPPELIN_ACCOUNT_CLASS_HASH;
    // hex felts recompile to the same values, so the address is unchanged
    constructorCalldata = toFeltArray(CallData.compile({ publicKey: salt }));
  }
  const contractAddress = normalizeAddress(
    hash.calculateContractAddressFromHash(
      salt,
      classHash,
      constructorCalldata,
      0,
    ),
  );
  return {
    classHash,
    constructorCalldata,
    addressSalt: salt,
    contractAddress,
  };
}

export function getAddressFromStarkPublicKey(
  publicKey: string,
  accountContract: IStarknetAccountContract,
): string {
  return getAccountDeployParams(publicKey, accountContract).contractAddress;
}

export function buildExecuteCalldata(calls: IStarknetCall[]): string[] {
  return transaction.getExecuteCalldata(calls, CAIRO_VERSION);
}

export function calculateInvokeTxHash(params: {
  senderAddress: string;
  version: '0x3';
  calls: IStarknetCall[];
  chainId: string;
  nonce: string;
  accountDeploymentData: string[];
  nonceDataAvailabilityMode: 'L1';
  feeDataAvailabilityMode: 'L1';
  resourceBounds: IStarknetResourceBounds;
  tip: string;
  paymasterData: string[];
  /**
   * STRK20 proof facts. starknet.js folds a poseidon hash of these into the
   * invoke hash, so an empty or absent list leaves the hash untouched while a
   * populated one must be passed or the sequencer rejects the signature.
   */
  proofFacts?: string[];
}): { txHash: string; compiledCalldata: string[] } {
  const compiledCalldata = buildExecuteCalldata(params.calls);
  const txHash = hash.calculateInvokeTransactionHash({
    senderAddress: params.senderAddress,
    version: params.version,
    compiledCalldata,
    chainId: toStarknetChainId(params.chainId),
    nonce: params.nonce,
    accountDeploymentData: params.accountDeploymentData,
    nonceDataAvailabilityMode: toDataAvailabilityMode(
      params.nonceDataAvailabilityMode,
    ),
    feeDataAvailabilityMode: toDataAvailabilityMode(
      params.feeDataAvailabilityMode,
    ),
    resourceBounds: toResourceBoundsBN(params.resourceBounds),
    tip: params.tip,
    paymasterData: params.paymasterData,
    proofFacts: params.proofFacts,
  });
  return { txHash, compiledCalldata };
}

export function calculateDeployAccountTxHash(params: {
  contractAddress: string;
  classHash: string;
  constructorCalldata: string[];
  addressSalt: string;
  version: '0x3';
  chainId: string;
  nonce: string;
  nonceDataAvailabilityMode: 'L1';
  feeDataAvailabilityMode: 'L1';
  resourceBounds: IStarknetResourceBounds;
  tip: string;
  paymasterData: string[];
}): string {
  return hash.calculateDeployAccountTransactionHash({
    contractAddress: params.contractAddress,
    classHash: params.classHash,
    compiledConstructorCalldata: CallData.compile(params.constructorCalldata),
    salt: params.addressSalt,
    version: params.version,
    chainId: toStarknetChainId(params.chainId),
    nonce: params.nonce,
    nonceDataAvailabilityMode: toDataAvailabilityMode(
      params.nonceDataAvailabilityMode,
    ),
    feeDataAvailabilityMode: toDataAvailabilityMode(
      params.feeDataAvailabilityMode,
    ),
    resourceBounds: toResourceBoundsBN(params.resourceBounds),
    tip: params.tip,
    paymasterData: params.paymasterData,
  });
}

export function signHash(
  messageHash: string,
  starkPrivateKey: string,
): IStarknetSignature {
  const signature = ec.starkCurve.sign(messageHash, starkPrivateKey);
  return [num.toHex(signature.r), num.toHex(signature.s)];
}

export function parseTypedData(message: string): IStarknetTypedData {
  let parsed: unknown;
  try {
    parsed = JSON.parse(message);
  } catch (_error) {
    throw new OneKeyLocalError('Invalid Starknet typed data: not valid JSON');
  }
  if (!typedData.validateTypedData(parsed)) {
    throw new OneKeyLocalError(
      'Invalid Starknet typed data: does not match the SNIP-12 schema',
    );
  }
  return parsed;
}

export function getTypedDataMessageHash(params: {
  message: string;
  address: string;
}): string {
  return typedData.getMessageHash(
    parseTypedData(params.message),
    params.address,
  );
}

/**
 * OKX Cairo 1 account `is_valid_signature(hash, sig)` wraps `hash` in a
 * SNIP-12 rev-0 TypedData before verifying the Stark signature.
 */
export function getOkxSignatureMessageHash(params: {
  hash: string;
  chainId: string;
  address: string;
}): string {
  return typedData.getMessageHash(
    {
      types: {
        StarkNetDomain: [
          { name: 'name', type: 'felt' },
          { name: 'version', type: 'felt' },
          { name: 'chainId', type: 'felt' },
        ],
        SignatureMessage: [{ name: 'message', type: 'felt' }],
      },
      primaryType: 'SignatureMessage',
      domain: {
        name: 'account.signature_message',
        version: '1',
        chainId: params.chainId,
      },
      message: {
        message: params.hash,
      },
    },
    params.address,
  );
}

export default {
  ARGENT_ACCOUNT_CLASS_HASH,
  ARGENT_SEED_KEY_PATH,
  OKX_PROXY_CLASS_HASH,
  OPENZEPPELIN_ACCOUNT_CLASS_HASH,
  buildExecuteCalldata,
  calculateDeployAccountTxHash,
  calculateInvokeTxHash,
  deriveArgentStarkPrivateKey,
  deriveOkxStarkPrivateKey,
  getAccountContractByEncoding,
  getAccountDeployParams,
  getAddressFromStarkPublicKey,
  getOkxSignatureMessageHash,
  getStarkPublicKey,
  getTypedDataMessageHash,
  grindStarkPrivateKey,
  isSameStarknetChainId,
  normalizeAddress,
  normalizeStarkPrivateKey,
  parseTypedData,
  signHash,
  toFelt,
  toFeltArray,
  toResourceBoundsBN,
  toRpcResourceBounds,
  toStarknetChainId,
};
