// eslint-disable-next-line max-classes-per-file
import { deserialize, serialize } from 'borsh';

import { sha256 } from '@onekeyhq/engine/src/secret/hash';

import { Assignable, Enum } from './enums';
import { PublicKey } from './key_pair';

import type { KeyType } from './key_pair';

export class FunctionCallPermission extends Assignable {
  allowance?: string;

  receiverId!: string;

  methodNames!: string[];
}

export class FullAccessPermission extends Assignable {}

export class AccessKeyPermission extends Enum {
  functionCall!: FunctionCallPermission;

  fullAccess!: FullAccessPermission;
}

export class AccessKey extends Assignable {
  nonce!: number;

  permission!: AccessKeyPermission;
}

export function fullAccessKey(): AccessKey {
  return new AccessKey({
    nonce: 0,
    permission: new AccessKeyPermission({
      fullAccess: new FullAccessPermission({}),
    }),
  });
}

export function functionCallAccessKey(
  receiverId: string,
  methodNames: string[],
  allowance?: string,
): AccessKey {
  return new AccessKey({
    nonce: 0,
    permission: new AccessKeyPermission({
      functionCall: new FunctionCallPermission({
        receiverId,
        allowance,
        methodNames,
      }),
    }),
  });
}

export class IAction extends Assignable {}

export class CreateAccount extends IAction {}
export class DeployContract extends IAction {
  code!: Uint8Array;
}
export class FunctionCall extends IAction {
  methodName!: string;

  args!: Uint8Array;

  gas!: string;

  deposit!: string;
}
export class Transfer extends IAction {
  deposit!: string;
}
export class Stake extends IAction {
  stake!: string;

  publicKey!: PublicKey;
}
export class AddKey extends IAction {
  publicKey!: PublicKey;

  accessKey!: AccessKey;
}
export class DeleteKey extends IAction {
  publicKey!: PublicKey;
}
export class DeleteAccount extends IAction {
  beneficiaryId!: string;
}

/**
 * Contains a list of the valid transaction Actions available with this API
 * @see {@link https://nomicon.io/RuntimeSpec/Actions.html | Actions Spec}
 */
export class Action extends Enum {
  createAccount!: CreateAccount;

  deployContract!: DeployContract;

  functionCall!: FunctionCall;

  transfer!: Transfer;

  stake!: Stake;

  addKey!: AddKey;

  deleteKey!: DeleteKey;

  deleteAccount!: DeleteAccount;
}

export function createAccount(): Action {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return new Action({ createAccount: new CreateAccount({}) });
}

export function deployContract(code: Uint8Array): Action {
  // eslint-disable-next-line @typescript-eslint/no-use-before-define
  return new Action({ deployContract: new DeployContract({ code }) });
}

export function stringifyJsonOrBytes(args: any): Buffer {
  const isUint8Array =
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    args.byteLength !== undefined && args.byteLength === args.length;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return isUint8Array ? args : Buffer.from(JSON.stringify(args));
}

/**
 * Constructs {@link Action} instance representing contract method call.
 *
 * @param methodName the name of the method to call
 * @param args arguments to pass to method. Can be either plain JS object which gets serialized as JSON automatically
 *  or `Uint8Array` instance which represents bytes passed as is.
 * @param gas max amount of gas that method call can use
 * @param deposit amount of NEAR (in yoctoNEAR) to send together with the call
 * @param stringify Convert input arguments into bytes array.
 */
export function functionCall(
  methodName: string,
  args: Uint8Array | object,
  gas: string,
  deposit: string,
  stringify = stringifyJsonOrBytes,
): Action {
  return new Action({
    functionCall: new FunctionCall({
      methodName,
      args: stringify(args),
      gas,
      deposit,
    }),
  });
}

export function transfer(deposit: string): Action {
  return new Action({ transfer: new Transfer({ deposit }) });
}

// eslint-disable-next-line @typescript-eslint/no-shadow
export function stake(stake: string, publicKey: PublicKey): Action {
  return new Action({ stake: new Stake({ stake, publicKey }) });
}

export function addKey(publicKey: PublicKey, accessKey: AccessKey): Action {
  return new Action({ addKey: new AddKey({ publicKey, accessKey }) });
}

export function deleteKey(publicKey: PublicKey): Action {
  return new Action({ deleteKey: new DeleteKey({ publicKey }) });
}

export function deleteAccount(beneficiaryId: string): Action {
  return new Action({ deleteAccount: new DeleteAccount({ beneficiaryId }) });
}

export class Signature extends Assignable {
  keyType!: KeyType;

  data!: Uint8Array;
}

export class Transaction extends Assignable {
  signerId!: string;

  publicKey!: PublicKey;

  nonce!: number;

  receiverId!: string;

  actions!: Action[];

  blockHash!: Uint8Array;

  static decode(bytes: Buffer): Transaction {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return deserialize(SCHEMA, Transaction, bytes);
  }

  encode(): Uint8Array {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return serialize(SCHEMA, this);
  }
}

export class SignedTransaction extends Assignable {
  transaction!: Transaction;

  signature!: Signature;

  static decode(bytes: Buffer): SignedTransaction {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return deserialize(SCHEMA, SignedTransaction, bytes);
  }

  encode(): Uint8Array {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return serialize(SCHEMA, this);
  }
}

// eslint-disable-next-line @typescript-eslint/ban-types
export const SCHEMA = new Map<Function, any>([
  [
    Signature,
    {
      kind: 'struct',
      fields: [
        ['keyType', 'u8'],
        ['data', [64]],
      ],
    },
  ],
  [
    SignedTransaction,
    {
      kind: 'struct',
      fields: [
        ['transaction', Transaction],
        ['signature', Signature],
      ],
    },
  ],
  [
    Transaction,
    {
      kind: 'struct',
      fields: [
        ['signerId', 'string'],
        ['publicKey', PublicKey],
        ['nonce', 'u64'],
        ['receiverId', 'string'],
        ['blockHash', [32]],
        ['actions', [Action]],
      ],
    },
  ],
  [
    PublicKey,
    {
      kind: 'struct',
      fields: [
        ['keyType', 'u8'],
        ['data', [32]],
      ],
    },
  ],
  [
    AccessKey,
    {
      kind: 'struct',
      fields: [
        ['nonce', 'u64'],
        ['permission', AccessKeyPermission],
      ],
    },
  ],
  [
    AccessKeyPermission,
    {
      kind: 'enum',
      field: 'enum',
      values: [
        ['functionCall', FunctionCallPermission],
        ['fullAccess', FullAccessPermission],
      ],
    },
  ],
  [
    FunctionCallPermission,
    {
      kind: 'struct',
      fields: [
        ['allowance', { kind: 'option', type: 'u128' }],
        ['receiverId', 'string'],
        ['methodNames', ['string']],
      ],
    },
  ],
  [FullAccessPermission, { kind: 'struct', fields: [] }],
  [
    Action,
    {
      kind: 'enum',
      field: 'enum',
      values: [
        ['createAccount', CreateAccount],
        ['deployContract', DeployContract],
        ['functionCall', FunctionCall],
        ['transfer', Transfer],
        ['stake', Stake],
        ['addKey', AddKey],
        ['deleteKey', DeleteKey],
        ['deleteAccount', DeleteAccount],
      ],
    },
  ],
  [CreateAccount, { kind: 'struct', fields: [] }],
  [DeployContract, { kind: 'struct', fields: [['code', ['u8']]] }],
  [
    FunctionCall,
    {
      kind: 'struct',
      fields: [
        ['methodName', 'string'],
        ['args', ['u8']],
        ['gas', 'u64'],
        ['deposit', 'u128'],
      ],
    },
  ],
  [Transfer, { kind: 'struct', fields: [['deposit', 'u128']] }],
  [
    Stake,
    {
      kind: 'struct',
      fields: [
        ['stake', 'u128'],
        ['publicKey', PublicKey],
      ],
    },
  ],
  [
    AddKey,
    {
      kind: 'struct',
      fields: [
        ['publicKey', PublicKey],
        ['accessKey', AccessKey],
      ],
    },
  ],
  [DeleteKey, { kind: 'struct', fields: [['publicKey', PublicKey]] }],
  [DeleteAccount, { kind: 'struct', fields: [['beneficiaryId', 'string']] }],
]);

export function createTransaction(
  signerId: string,
  publicKey: PublicKey,
  receiverId: string,
  nonce: number,
  actions: Action[],
  blockHash: Uint8Array,
): Transaction {
  return new Transaction({
    signerId,
    publicKey,
    nonce,
    receiverId,
    actions,
    blockHash,
  });
}

/**
 * Signs a given transaction from an account with given keys, applied to the given network
 * @param transaction The Transaction object to sign
 * @param sign The {Sign} function that assists with signing keys
 */
export async function signTransactionObject(
  transaction: Transaction,
  sign: (digest: Uint8Array) => Promise<Uint8Array>,
): Promise<[Uint8Array, SignedTransaction]> {
  const message = serialize(SCHEMA, transaction);
  const hash = new Uint8Array(sha256(Buffer.from(message)));
  const sig = await sign(hash);
  const signedTx = new SignedTransaction({
    transaction,
    signature: new Signature({
      keyType: transaction.publicKey.keyType,
      data: sig,
    }),
  });
  return [hash, signedTx];
}
