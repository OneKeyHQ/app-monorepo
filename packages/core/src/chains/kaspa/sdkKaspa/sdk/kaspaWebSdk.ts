import type {
  addressFromScriptPublicKey,
  calculateTransactionFee,
  calculateTransactionMass,
  createTransaction,
  createTransactions,
  kaspaToSompi,
} from '@onekeyfe/kaspa-wasm';

const getKaspaApi = async () => {
  const Loader = await import('@onekeyfe/kaspa-wasm');

  await Loader.default();
  return {
    ScriptBuilder: () => Promise.resolve(Loader.ScriptBuilder),
    Opcodes: () => Promise.resolve(Loader.Opcodes),
    NetworkType: () => Promise.resolve(Loader.NetworkType),
    XOnlyPublicKey: () => Promise.resolve(Loader.XOnlyPublicKey),
    Address: () => Promise.resolve(Loader.Address),
    PrivateKey: () => Promise.resolve(Loader.PrivateKey),
    Transaction: () => Promise.resolve(Loader.Transaction),

    RpcClient: () => Promise.resolve(Loader.RpcClient),
    Encoding: () => Promise.resolve(Loader.Encoding),
    Resolver: () => Promise.resolve(Loader.Resolver),

    createTransaction: (...args: Parameters<typeof createTransaction>) =>
      Promise.resolve(Loader.createTransaction(...args)),

    createTransactions: (...args: Parameters<typeof createTransactions>) =>
      Loader.createTransactions(...args),

    addressFromScriptPublicKey: (
      ...args: Parameters<typeof addressFromScriptPublicKey>
    ) => Promise.resolve(Loader.addressFromScriptPublicKey(...args)),

    calculateTransactionFee: (
      ...args: Parameters<typeof calculateTransactionFee>
    ) => Promise.resolve(Loader.calculateTransactionFee(...args)),

    calculateTransactionMass: (
      ...args: Parameters<typeof calculateTransactionMass>
    ) => Promise.resolve(Loader.calculateTransactionMass(...args)),

    kaspaToSompi: (...args: Parameters<typeof kaspaToSompi>) =>
      Promise.resolve(Loader.kaspaToSompi(...args)),
  };
};

export default {
  getKaspaApi,
};
