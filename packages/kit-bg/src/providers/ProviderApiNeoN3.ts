/* eslint-disable @typescript-eslint/no-unused-vars */
import { web3Errors } from '@onekeyfe/cross-inpage-provider-errors';
import { IInjectedProviderNames } from '@onekeyfe/cross-inpage-provider-types';

import {
  backgroundClass,
  providerApiMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  IInvokeArguments,
  IInvokeMultipleParams,
  IInvokeParams,
  IInvokeResponse,
  ISigners,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiNeo.type';
import { NeoDApiErrors } from '@onekeyhq/shared/types/ProviderApis/ProviderApiNeo.type';

import { vaultFactory } from '../vaults/factory';

import ProviderApiBase from './ProviderApiBase';

import type { IProviderBaseBackgroundNotifyInfo } from './ProviderApiBase';
import type INeoVault from '../vaults/impls/neo/Vault';
import type { ContractCall } from '@cityofzion/neon-core/lib/sc';
import type { IJsBridgeMessagePayload } from '@onekeyfe/cross-inpage-provider-types';

const NODE_URL = 'http://seed1.neo.org:10332/';

@backgroundClass()
class ProviderApiNeoN3 extends ProviderApiBase {
  // @ts-expect-error
  public providerName = 'neo';

  public override notifyDappAccountsChanged(
    info: IProviderBaseBackgroundNotifyInfo,
  ): void {
    const data = () => {
      const result = {
        method: 'wallet_events_accountChanged',
        params: {
          accounts: { address: '' },
        },
      };
      return result;
    };
    info.send(data, info.targetOrigin);
  }

  public override notifyDappChainChanged(): void {
    throw new NotImplemented();
  }

  public async rpcCall(request: IJsBridgeMessagePayload): Promise<any> {
    throw new NotImplemented();
  }

  // Provider API
  @providerApiMethod()
  async getProvider() {
    return Promise.resolve({
      name: 'OneKey',
      website: 'https://onekey.so/',
      version: '5.7.0',
      compatibility: [],
    });
  }

  @providerApiMethod()
  async getNetworks() {
    return Promise.resolve({
      networks: ['N3MainNet'],
      chainId: 3,
      defaultNetwork: 'N3MainNet',
    });
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

  @providerApiMethod()
  async getAccount(request: IJsBridgeMessagePayload) {
    return this.getAccountOrConnect(request);
  }

  @providerApiMethod()
  async getPublicKey(request: IJsBridgeMessagePayload) {
    return this.getAccountOrConnect(request);
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

    // const signOnly = !!broadcastOverride;
    const signOnly = true;
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
    console.log('invokeMultiple ====>>>>: ', request);

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
}

export default ProviderApiNeoN3;
