/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable spellcheck/spell-checker */
/* eslint-disable @typescript-eslint/no-unused-vars */
import { tx, u, wallet } from '@cityofzion/neon-core';
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { getNetworkIdsMap } from '@onekeyhq/shared/src/config/networkIds';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EMessageTypesCommon } from '@onekeyhq/shared/types/message';
import type {
  IArgument,
  IInvokeArguments,
  IInvokeMultipleParams,
  IInvokeParams,
  IInvokeReadMultiParams,
  IInvokeReadParams,
  IInvokeReadResponse,
  IInvokeResponse,
  ISignMessageV2Params,
  ISignMessageV2Response,
  ISigners,
  IVerifyMessageV2Params,
  IVerifyMessageV2Response,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiNeo.type';
import { NeoDApiErrors } from '@onekeyhq/shared/types/ProviderApis/ProviderApiNeo.type';

import { vaultFactory } from '../vaults/factory';
import { NEO_GAS_TOKEN_ADDRESS } from '../vaults/impls/neo/sdkNeo/constant';
import { verify } from '../vaults/impls/neo/sdkNeo/signMessage';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type INeoVault from '../vaults/impls/neo/Vault';
import type { ContractCall } from '@cityofzion/neon-core/lib/sc';
import type {
  TransactionJson,
  TransactionLike,
} from '@cityofzion/neon-core/lib/tx';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

const NODE_URL = 'http://seed1.neo.org:10332/';

@backgroundClass()
class ProviderApiNeoN3 extends ProviderApiBase {
  public providerName = IInjectedProviderNames.neo;

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = async ({ origin }: { origin: string }) => {
      const params = await this.neo_accounts({
        origin,
        scope: this.providerName,
      });
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: { address: params?.address ?? '' },
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    // throw new NotImplemented();
  }

  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    throw new NotImplemented();
  }

  private async neo_accounts(
    request: IJsBridgeMessagePayload,
  ): Promise<{ address: string; publicKey: string; isLedger: boolean } | null> {
    const accountsInfo =
      await this.backgroundApi.serviceDApp.dAppGetConnectedAccountsInfo(
        request,
      );
    if (!accountsInfo) {
      return null;
    }
    const account = accountsInfo?.[0]?.account;
    return {
      address: account.address,
      publicKey: account.pub ?? '',
      isLedger: true,
    };
  }

  private async getAccountOrConnect(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const account = await this.neo_accounts(request);
    if (account) {
      return account;
    }
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.neo_accounts(request);
  }

  /** Common Method */
  @providerApiMethod()
  async getAccount(request: IJsBridgeMessagePayload) {
    return this.getAccountOrConnect(request);
  }

  @providerApiMethod()
  async getPublicKey(request: IJsBridgeMessagePayload) {
    return this.getAccountOrConnect(request);
  }

  @providerApiMethod()
  async getNetworks() {
    return Promise.resolve({
      networks: ['N3MainNet'],
      chainId: 3,
      defaultNetwork: 'N3MainNet',
    });
  }

  /** Read Method */
  @providerApiMethod()
  async getProvider() {
    return Promise.resolve({
      name: 'OneKey',
      website: 'https://onekey.so/',
      version: process.env.VERSION,
      compatibility: [],
    });
  }

  private _fetchBalanceDataCached = memoizee(
    async (accountId: string, networkId: string, address: string) => {
      const vault = (await vaultFactory.getVault({
        networkId,
        accountId,
      })) as INeoVault;

      const balance = await vault.fetchTokenList({
        accountId,
        requestApiParams: {
          accountAddress: address,
          networkId,
          contractList: [],
          hiddenTokens: [],
        },
        flag: 'home-token-list',
      });

      const result: {
        [address: string]: {
          contract: string;
          symbol: string;
          amount: string;
        }[];
      } = {
        [address]: [],
      };
      if (balance?.data?.data?.tokens) {
        const { tokens } = balance.data.data;
        const { map: tokenMap, data: tokenData } = tokens;

        tokenData.forEach((token) => {
          const contractAddress = token.address;

          const key = token.$key;
          const tokenInfo = tokenMap[key];

          if (tokenInfo && tokenInfo.balance) {
            result[address].push({
              contract: contractAddress,
              symbol: token.symbol,
              amount: tokenInfo.balanceParsed ?? '0',
            });
          }
        });
      }
      return result;
    },
    {
      promise: true,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 15 }),
    },
  );

  @providerApiMethod()
  async getBalance(request: IJsBridgeMessagePayload) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];
    if (!accountId || !networkId || !address) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    return this._fetchBalanceDataCached(accountId, networkId, address);
  }

  @providerApiMethod()
  async getStorage(
    request: IJsBridgeMessagePayload,
    params?: {
      scriptHash: string;
      key: string;
    },
  ): Promise<{ result: string }> {
    if (!params?.scriptHash || !params?.key || !request.origin) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Invalid params`,
      });
    }
    const result = await this.backgroundApi.serviceDApp.proxyRPCCall({
      skipParseResponse: true,
      networkId: getNetworkIdsMap().neon3,
      request: {
        method: 'getstorage',
        params: [params.scriptHash, hexUtils.utf8StringToHexString(params.key)],
      },
      origin: request.origin,
    });
    const r = result[0];
    // @ts-expect-error
    if (r?.error) {
      return {
        // @ts-expect-error
        data: null,
        // @ts-expect-error
        description: r.error,
        type: 'RPC_ERROR',
      };
    }
    console.log('result: ===>>>:', result);
    // @ts-expect-error
    return { result: r?.result ?? '' };
  }

  private async _processInvokeReadArgs(
    args: IArgument[],
  ): Promise<IArgument[]> {
    return args.map((item) => {
      if (!item) {
        return item;
      }

      if (item.type === 'Address') {
        return {
          type: 'Hash160',
          value: wallet.getScriptHashFromAddress(item.value),
        };
      }

      if (item.type === 'Boolean' && typeof item.value === 'string') {
        const lowerValue = item.value.toLowerCase();
        if (lowerValue === 'true') {
          return {
            type: 'Boolean',
            value: true,
          };
        }
        if (lowerValue === 'false') {
          return {
            type: 'Boolean',
            value: false,
          };
        }
        throw web3Errors.provider.custom({
          code: 4002,
          message: `Invalid Boolean value: ${item.value}`,
        });
      }

      return item;
    });
  }

  private async _executeInvokeRead(
    request: IJsBridgeMessagePayload,
    scriptHash: string,
    operation: string,
    args: IArgument[],
    signers: ISigners[],
  ): Promise<IInvokeReadResponse> {
    const formattedSigners = signers.map((signer) => ({
      account: signer.account,
      scopes: signer.scopes,
      allowedcontracts: signer.allowedContracts || undefined,
      allowedgroups: signer.allowedGroups || undefined,
    }));

    const processedArgs = await this._processInvokeReadArgs(args);

    const response = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: getNetworkIdsMap().neon3,
      request: {
        method: 'invokefunction',
        params: [scriptHash, operation, processedArgs, formattedSigners],
      },
      origin: request.origin || '',
      skipParseResponse: true,
    });

    const resultObj = response[0] as { result: IInvokeReadResponse };
    const rpcResult = resultObj.result;

    return {
      script: rpcResult.script || '',
      state: rpcResult.state || '',
      gas_consumed: rpcResult.gas_consumed || '0',
      stack: rpcResult.stack || [],
    };
  }

  @providerApiMethod()
  async invokeRead(
    request: IJsBridgeMessagePayload,
    params: IInvokeReadParams,
  ): Promise<IInvokeReadResponse> {
    defaultLogger.discovery.dapp.dappRequest({ request });

    if (
      !params?.signers ||
      !Array.isArray(params.signers) ||
      !params.scriptHash ||
      !params.operation
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    if (
      params.signers.some(
        (signer) => signer.account === undefined || signer.scopes === undefined,
      )
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    try {
      return await this._executeInvokeRead(
        request,
        params.scriptHash,
        params.operation,
        params.args || [],
        params.signers,
      );
    } catch (error) {
      console.error('invokeRead error:', error);
      throw web3Errors.provider.custom({
        code: 4003,
        message: `Error invoking read method: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
    }
  }

  @providerApiMethod()
  async invokeReadMulti(
    request: IJsBridgeMessagePayload,
    params: IInvokeReadMultiParams,
  ): Promise<IInvokeReadResponse[]> {
    if (
      !params?.signers ||
      !Array.isArray(params.signers) ||
      !params.invokeReadArgs
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    if (
      params.signers.some(
        (signer) => signer.account === undefined || signer.scopes === undefined,
      )
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    if (
      !Array.isArray(params.invokeReadArgs) ||
      params.invokeReadArgs.length === 0
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    try {
      return await Promise.all(
        params.invokeReadArgs.map((item) =>
          this._executeInvokeRead(
            request,
            item.scriptHash,
            item.operation,
            item.args || [],
            params.signers,
          ),
        ),
      );
    } catch (error) {
      console.error('invokeReadMulti error:', error);
      throw web3Errors.provider.custom({
        code: 4003,
        message: `Error invoking read methods: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      });
    }
  }

  @providerApiMethod()
  async verifyMessage(request: IJsBridgeMessagePayload) {
    throw new NotImplemented();
  }

  @providerApiMethod()
  async verifyMessageV2(
    request: IJsBridgeMessagePayload,
    params: IVerifyMessageV2Params,
  ): Promise<IVerifyMessageV2Response> {
    const parameterHexString = Buffer.from(params.message).toString('hex');
    const lengthHex = u.num2VarInt(parameterHexString.length / 2);
    const concatenatedString = lengthHex + parameterHexString;
    const messageHex = `000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000${concatenatedString}`;
    const signHex = u.num2hexstring(0, 4, true) + u.sha256(messageHex);
    const result = await verify(signHex, params.data, params.publicKey);
    return {
      result,
    };
  }

  @providerApiMethod()
  async getBlock(
    request: IJsBridgeMessagePayload,
    params: { blockHeight: boolean },
  ) {
    const response = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: getNetworkIdsMap().neon3,
      request: {
        method: 'getblock',
        params: [params.blockHeight, 1],
      },
      origin: request.origin || '',
      skipParseResponse: true,
    });
    // @ts-expect-error
    return response[0]?.result ?? response[0]?.error;
  }

  @providerApiMethod()
  async getTransaction(
    request: IJsBridgeMessagePayload,
    params: { txid: string },
  ) {
    const response = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: getNetworkIdsMap().neon3,
      request: {
        method: 'getrawtransaction',
        params: [params.txid, true],
      },
      origin: request.origin || '',
      skipParseResponse: true,
    });
    // @ts-expect-error
    return response[0]?.result ?? response[0]?.error;
  }

  @providerApiMethod()
  async getApplicationLog(
    request: IJsBridgeMessagePayload,
    params: { txid: string },
  ) {
    const response = await this.backgroundApi.serviceDApp.proxyRPCCall({
      networkId: getNetworkIdsMap().neon3,
      request: {
        method: 'getapplicationlog',
        params: [params.txid],
      },
      origin: request.origin || '',
      skipParseResponse: true,
    });
    // @ts-expect-error
    return response[0]?.result ?? response[0]?.error;
  }

  @providerApiMethod()
  async pickAddress(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const account = await this.neo_accounts(request);
    if (account) {
      if (request.origin) {
        await this.backgroundApi.serviceDApp.disconnectWebsite({
          origin: request.origin,
          storageType: 'injectedProvider',
          entry: 'Browser',
        });
      }
    }
    await timerUtils.wait(500);
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.neo_accounts(request);
  }

  @providerApiMethod()
  async AddressToScriptHash(
    request: IJsBridgeMessagePayload,
    params: { address: string },
  ) {
    return Promise.resolve(wallet.getScriptHashFromAddress(params.address));
  }

  @providerApiMethod()
  async ScriptHashToAddress(
    request: IJsBridgeMessagePayload,
    params: { scriptHash: string },
  ) {
    return Promise.resolve(wallet.getAddressFromScriptHash(params.scriptHash));
  }

  /** Write Method */
  @providerApiMethod()
  async switchWalletNetwork(request: IJsBridgeMessagePayload) {
    throw new NotImplemented();
  }

  @providerApiMethod()
  async switchWalletAccount(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const account = await this.neo_accounts(request);
    if (account) {
      if (request.origin) {
        await this.backgroundApi.serviceDApp.disconnectWebsite({
          origin: request.origin,
          storageType: 'injectedProvider',
          entry: 'Browser',
        });
      }
    }
    await timerUtils.wait(500);
    await this.backgroundApi.serviceDApp.openConnectionModal(request);
    return this.neo_accounts(request);
  }

  @providerApiMethod()
  async send(
    request: IJsBridgeMessagePayload,
    params: {
      fromAddress: string;
      toAddress: string;
      asset: string;
      amount: string;
      fee?: string;
      broadcastOverride?: boolean;
    },
  ) {
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const scriptHash = wallet.getScriptHashFromAddress(params.fromAddress);
    const inputs = {
      scriptHash,
      fromAccountAddress: params.fromAddress,
      toAccountAddress: params.toAddress,
      tokenScriptHash:
        params.asset === 'GAS' ? NEO_GAS_TOKEN_ADDRESS : params.asset,
      amountToTransfer: params.amount,
      systemFee: '0',
      networkFee: '0',
    };

    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as INeoVault;

    const transaction = await vault.buildTransferTransaction({
      fromAddress: inputs.fromAccountAddress,
      toAddress: inputs.toAccountAddress,
      tokenScriptHash: inputs.tokenScriptHash,
      amount: inputs.amountToTransfer,
      systemFee: inputs.systemFee,
      networkFee: inputs.networkFee,
    });

    const signOnly = !!params.broadcastOverride;
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: transaction.toJson(),
        accountId,
        networkId,
        signOnly,
      });

    if (signOnly) {
      return {
        txid: result.txid,
        nodeURL: NODE_URL,
      };
    }
    return {
      txid: result.txid,
      signedTx: Buffer.from(result.rawTx, 'base64').toString('hex'),
    };
  }

  private async signInvokeTx(params: {
    request: IJsBridgeMessagePayload;
    invokeArgs: IInvokeArguments[];
    signers: ISigners[];
    fee?: string;
    extraSystemFee?: string;
    overrideSystemFee?: string;
    broadcastOverride?: boolean;
  }): Promise<IInvokeResponse> {
    const {
      request,
      invokeArgs,
      signers,
      fee,
      extraSystemFee,
      overrideSystemFee,
      broadcastOverride,
    } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    const vault = (await vaultFactory.getVault({
      networkId,
      accountId,
    })) as INeoVault;

    const processedInvokeArgs = await Promise.all(
      invokeArgs.map((item) => vault.createInvokeInputs(item)),
    );
    const encodedTx = await vault.createNeo3InvokeTx({
      invokeArgs: processedInvokeArgs as ContractCall[],
      signers,
      networkFee: fee ?? '0',
      systemFee: extraSystemFee ?? '0',
      overrideSystemFee,
    });

    const signOnly = !!broadcastOverride;
    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx,
        accountId,
        networkId,
        signOnly,
      });

    if (signOnly) {
      return {
        txid: result.txid,
        nodeURL: NODE_URL,
      };
    }
    return {
      txid: result.txid,
      signedTx: Buffer.from(result.rawTx, 'base64').toString('hex'),
    };
  }

  @providerApiMethod()
  async invoke(
    request: IJsBridgeMessagePayload,
    params: IInvokeParams,
  ): Promise<IInvokeResponse> {
    defaultLogger.discovery.dapp.dappRequest({ request });
    if (
      !params.signers ||
      !Array.isArray(params.signers) ||
      !params.scriptHash ||
      !params.operation
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    if (
      params.signers.some(
        (signer) => signer.account === undefined || signer.scopes === undefined,
      )
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    // Convert single invoke to the format expected by handleInvokeOperation
    const invokeArgs: IInvokeArguments[] = [
      {
        scriptHash: params.scriptHash,
        operation: params.operation,
        args: params.args || [],
      },
    ];

    return this.signInvokeTx({
      request,
      invokeArgs,
      signers: params.signers,
      fee: params.fee,
      extraSystemFee: params.extraSystemFee,
      overrideSystemFee: params.overrideSystemFee,
      broadcastOverride: params.broadcastOverride,
    });
  }

  @providerApiMethod()
  async invokeMultiple(
    request: IJsBridgeMessagePayload,
    params: IInvokeMultipleParams,
  ): Promise<IInvokeResponse> {
    defaultLogger.discovery.dapp.dappRequest({ request });
    if (
      !params.signers ||
      !Array.isArray(params.signers) ||
      !params.invokeArgs
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    if (
      params.signers.some(
        (signer) => signer.account === undefined || signer.scopes === undefined,
      )
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    if (!Array.isArray(params.invokeArgs) || params.invokeArgs.length === 0) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    if (
      params.invokeArgs.some(
        (arg) =>
          !arg.scriptHash ||
          arg.scriptHash === '' ||
          !arg.operation ||
          arg.operation === '',
      )
    ) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    return this.signInvokeTx({
      request,
      invokeArgs: params.invokeArgs,
      signers: params.signers,
      fee: params.fee,
      extraSystemFee: params.extraSystemFee,
      overrideSystemFee: params.overrideSystemFee,
      broadcastOverride: params.broadcastOverride,
    });
  }

  @providerApiMethod()
  async signTransaction(
    request: IJsBridgeMessagePayload,
    params: {
      transaction: TransactionLike;
    },
  ): Promise<TransactionJson> {
    defaultLogger.discovery.dapp.dappRequest({ request });
    const { transaction } = params;
    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];

    if (!networkId || !accountId) {
      throw web3Errors.provider.custom({
        code: 4002,
        message: `Can not get account`,
      });
    }

    let finalTransaction: tx.Transaction;
    if (
      transaction.script &&
      typeof transaction.script === 'string' &&
      hexUtils.isHexString(transaction.script)
    ) {
      transaction.script = Buffer.from(transaction.script, 'hex').toString(
        'base64',
      );
    }

    try {
      finalTransaction = tx.Transaction.fromJson(
        transaction as unknown as TransactionJson,
      );
    } catch (error) {
      try {
        finalTransaction = new tx.Transaction(transaction);
      } catch (err) {
        throw web3Errors.provider.custom({
          code: 40_003,
          message: `Invalid transaction`,
        });
      }
    }

    const result =
      await this.backgroundApi.serviceDApp.openSignAndSendTransactionModal({
        request,
        encodedTx: finalTransaction.toJson(),
        accountId,
        networkId,
        signOnly: true,
      });

    const rawTx = Buffer.from(result.rawTx, 'base64').toString('hex');
    const t = tx.Transaction.deserialize(rawTx);
    return t.toJson();
  }

  @providerApiMethod()
  async signMessage(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    throw new NotImplemented();
  }

  @providerApiMethod()
  async signMessageWithoutSalt(request: IJsBridgeMessagePayload) {
    defaultLogger.discovery.dapp.dappRequest({ request });
    throw new NotImplemented();
  }

  private async _signMessageV2(
    request: IJsBridgeMessagePayload,
    params: ISignMessageV2Params,
    hasSalt: boolean,
  ): Promise<ISignMessageV2Response> {
    defaultLogger.discovery.dapp.dappRequest({ request });
    if (!params.message) {
      return Promise.reject(NeoDApiErrors.MALFORMED_INPUT);
    }

    const accountsInfo = await this.getAccountsInfo(request);
    const { accountInfo: { accountId, networkId, address } = {} } =
      accountsInfo[0];
    const resultStr = await this.backgroundApi.serviceDApp.openSignMessageModal(
      {
        request,
        accountId: accountId ?? '',
        networkId: networkId ?? '',
        unsignedMessage: {
          type: EMessageTypesCommon.SIMPLE_SIGN,
          message: params.message,
          payload: {
            hasSalt,
          },
        },
      },
    );

    const result = JSON.parse(resultStr as string) as {
      signature: string;
      publicKey: string;
      salt?: string;
    };

    return {
      message: params.message,
      data: result.signature,
      publicKey: result.publicKey,
      salt: result.salt,
    };
  }

  @providerApiMethod()
  async signMessageV2(
    request: IJsBridgeMessagePayload,
    params: ISignMessageV2Params,
  ): Promise<ISignMessageV2Response> {
    return this._signMessageV2(request, params, true);
  }

  @providerApiMethod()
  async signMessageWithoutSaltV2(
    request: IJsBridgeMessagePayload,
    params: ISignMessageV2Params,
  ): Promise<ISignMessageV2Response> {
    return this._signMessageV2(request, params, false);
  }
}

export default ProviderApiNeoN3;
