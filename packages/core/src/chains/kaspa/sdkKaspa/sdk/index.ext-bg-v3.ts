import appGlobals from '@onekeyhq/shared/src/appGlobals';

import type { IEnsureSDKReady, IGetKaspaApi, IKaspaSdk } from '../types';

const ensureSDKReady: IEnsureSDKReady = async () => Promise.resolve(true);

const addressFromScriptPublicKey = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.addressFromScriptPublicKey(...args);

const createTransaction = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.createTransaction(...args);

const createTransactions = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.createTransactions(...args);

const calculateTransactionFee = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.calculateTransactionFee(...args);

const calculateTransactionMass = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.calculateTransactionMass(...args);

const kaspaToSompi = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.kaspaToSompi(...args);

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

const PrivateKey = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.PrivateKey();

const RpcClient = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.RpcClient();

const Encoding = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.Encoding();

const Resolver = async (...args: any[]) =>
  appGlobals.$offscreenApiProxy.kaspaSdk.Resolver();

const getKaspaApi: IGetKaspaApi = async () =>
  Promise.resolve({
    addressFromScriptPublicKey,
    ScriptBuilder,
    Opcodes,
    NetworkType,
    XOnlyPublicKey,
    Address,
    PrivateKey,
    kaspaToSompi,
    createTransaction,
    createTransactions,
    calculateTransactionFee,
    calculateTransactionMass,
    RpcClient,
    Encoding,
    Resolver,
  });

const sdk: IKaspaSdk = { getKaspaApi, ensureSDKReady };
export default sdk;
