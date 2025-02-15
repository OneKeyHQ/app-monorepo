import type { addressFromScriptPublicKey } from '@real_weatherstar/kaspa-wasm';

const getKaspaApi = async () => {
  const Loader = await import('@real_weatherstar/kaspa-wasm');

  await Loader.default();
  return {
    ScriptBuilder: () => Promise.resolve(Loader.ScriptBuilder),
    Opcodes: () => Promise.resolve(Loader.Opcodes),
    NetworkType: () => Promise.resolve(Loader.NetworkType),
    XOnlyPublicKey: () => Promise.resolve(Loader.XOnlyPublicKey),
    Address: () => Promise.resolve(Loader.Address),

    addressFromScriptPublicKey: (
      ...args: Parameters<typeof addressFromScriptPublicKey>
    ) => Promise.resolve(Loader.addressFromScriptPublicKey(...args)),
  };
};

export default {
  getKaspaApi,
};
