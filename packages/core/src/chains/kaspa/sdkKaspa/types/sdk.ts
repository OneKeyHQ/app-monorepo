import type {
  Address,
  Encoding,
  NetworkType,
  Opcodes,
  PrivateKey,
  Resolver,
  RpcClient,
  ScriptBuilder,
  Transaction,
  XOnlyPublicKey,
  addressFromScriptPublicKey,
  calculateTransactionFee,
  calculateTransactionMass,
  createTransaction,
  createTransactions,
  kaspaToSompi,
} from '@onekeyfe/kaspa-wasm';

export type IKaspaSdkApi = {
  ScriptBuilder: () => Promise<typeof ScriptBuilder>;
  Opcodes: () => Promise<typeof Opcodes>;
  NetworkType: () => Promise<typeof NetworkType>;
  XOnlyPublicKey: () => Promise<typeof XOnlyPublicKey>;
  Address: () => Promise<typeof Address>;
  PrivateKey: () => Promise<typeof PrivateKey>;
  RpcClient: () => Promise<typeof RpcClient>;
  Encoding: () => Promise<typeof Encoding>;
  Resolver: () => Promise<typeof Resolver>;
  Transaction: () => Promise<typeof Transaction>;

  addressFromScriptPublicKey: (
    ...args: Parameters<typeof addressFromScriptPublicKey>
  ) => Promise<ReturnType<typeof addressFromScriptPublicKey>>;

  createTransaction: (
    ...args: Parameters<typeof createTransaction>
  ) => Promise<ReturnType<typeof createTransaction>>;

  createTransactions: (
    ...args: Parameters<typeof createTransactions>
  ) => ReturnType<typeof createTransactions>;

  calculateTransactionFee: (
    ...args: Parameters<typeof calculateTransactionFee>
  ) => Promise<ReturnType<typeof calculateTransactionFee>>;

  calculateTransactionMass: (
    ...args: Parameters<typeof calculateTransactionMass>
  ) => Promise<ReturnType<typeof calculateTransactionMass>>;

  kaspaToSompi: (
    ...args: Parameters<typeof kaspaToSompi>
  ) => Promise<ReturnType<typeof kaspaToSompi>>;
};

export type IGetKaspaApi = () => Promise<IKaspaSdkApi>;

export type IEnsureSDKReady = () => Promise<boolean>;

export interface IKaspaSdk {
  getKaspaApi: IGetKaspaApi;
  ensureSDKReady: IEnsureSDKReady;
}
