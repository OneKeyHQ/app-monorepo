import type {
  Address,
  NetworkType,
  Opcodes,
  ScriptBuilder,
  XOnlyPublicKey,
  addressFromScriptPublicKey,
} from '@real_weatherstar/kaspa-wasm';

export type IKaspaSdkApi = {
  ScriptBuilder: () => Promise<typeof ScriptBuilder>;
  Opcodes: () => Promise<typeof Opcodes>;
  NetworkType: () => Promise<typeof NetworkType>;
  XOnlyPublicKey: () => Promise<typeof XOnlyPublicKey>;
  Address: () => Promise<typeof Address>;

  addressFromScriptPublicKey: (
    ...args: Parameters<typeof addressFromScriptPublicKey>
  ) => Promise<ReturnType<typeof addressFromScriptPublicKey>>;
};

export type IGetKaspaApi = () => Promise<IKaspaSdkApi>;

export type IEnsureSDKReady = () => Promise<boolean>;

export interface IKaspaSdk {
  getKaspaApi: IGetKaspaApi;
  ensureSDKReady: IEnsureSDKReady;
}
