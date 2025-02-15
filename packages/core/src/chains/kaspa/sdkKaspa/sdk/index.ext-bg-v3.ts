import appGlobals from '@onekeyhq/shared/src/appGlobals';

import type { IEnsureSDKReady, IGetKaspaApi, IKaspaSdk } from '../types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const addressFromScriptPublicKey = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.addressFromScriptPublicKey(...args);

const ScriptBuilder = async () =>
  appGlobals.$offscreenApiProxy.kaspaSdk.ScriptBuilder();

const Opcodes = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.Opcodes();

const NetworkType = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.NetworkType();

const XOnlyPublicKey = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.XOnlyPublicKey();

const Address = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.Address();

const getKaspaApi: IGetKaspaApi = async () =>
  Promise.resolve({
    addressFromScriptPublicKey,
    ScriptBuilder,
    Opcodes,
    NetworkType,
    XOnlyPublicKey,
    Address,
  });

const sdk: IKaspaSdk = { getKaspaApi, ensureSDKReady };
export default sdk;
