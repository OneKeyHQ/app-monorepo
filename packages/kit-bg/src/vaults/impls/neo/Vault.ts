/* eslint-disable @typescript-eslint/no-unused-vars */
import { rpc, sc, tx, u, wallet } from '@cityofzion/neon-core';
import { ContractParam } from '@cityofzion/neon-core/lib/sc';
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import type { IEncodedTxNeoN3 } from '@onekeyhq/core/src/chains/neo/types';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type {
  IMeasureRpcStatusParams,
  IMeasureRpcStatusResult,
} from '@onekeyhq/shared/types/customRpc';
import type {
  IArgument,
  IInvokeArguments,
} from '@onekeyhq/shared/types/ProviderApis/ProviderApiNeo.type';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
  type IDecodedTx,
  type IDecodedTxAction,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionByCustomRpcParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type { ContractCall } from '@cityofzion/neon-core/lib/sc';
import type { SignerLike } from '@cityofzion/neon-core/lib/tx';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined, // KeyringQr,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    const { address } = account;
    return Promise.resolve({
      networkId,
      normalizedAddress: address,
      displayAddress: address,
      address,
      baseAddress: address,
      isValid: true,
      allowEmptyAddress: false,
    });
  }

  private async buildTransferInputs({
    transferInfo,
  }: {
    transferInfo: ITransferInfo;
  }) {
    const { to, amount, tokenInfo } = transferInfo;

    if (
      !tokenInfo ||
      typeof tokenInfo.decimals !== 'number' ||
      tokenInfo.decimals < 0
    ) {
      throw new OneKeyInternalError('Token decimals is required');
    }
    const dbAccount = await this.getAccount();
    const scriptHash = wallet.getScriptHashFromAddress(dbAccount.address);
    const amountValue = new BigNumber(amount)
      .shiftedBy(tokenInfo.decimals)
      .toFixed();

    return {
      scriptHash,
      fromAccountAddress: dbAccount.address,
      toAccountAddress: to,
      tokenScriptHash: tokenInfo.address,
      amountToTransfer: amountValue,
      systemFee: new BigNumber(0).toFixed(),
      networkFee: new BigNumber(0).toFixed(),
    };
  }

  async buildTransferTransaction({
    fromAddress,
    toAddress,
    tokenScriptHash,
    amount,
    systemFee = '0',
    networkFee = '0',
  }: {
    fromAddress: string;
    toAddress: string;
    tokenScriptHash: string;
    amount: string;
    systemFee?: string;
    networkFee?: string;
  }) {
    const scriptHash = wallet.getScriptHashFromAddress(fromAddress);

    const script = sc.createScript({
      scriptHash: tokenScriptHash,
      operation: 'transfer',
      args: [
        sc.ContractParam.hash160(fromAddress),
        sc.ContractParam.hash160(toAddress),
        sc.ContractParam.integer(amount),
        sc.ContractParam.any(null),
      ],
    });

    const currentHeight = await this.getBlockCount();

    return new tx.Transaction({
      signers: [
        {
          account: scriptHash,
          scopes: tx.WitnessScope.CalledByEntry,
        },
      ],
      validUntilBlock: currentHeight + 100,
      systemFee,
      networkFee,
      script,
    });
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxNeoN3> {
    const { transfersInfo } = params;
    if (!transfersInfo || isEmpty(transfersInfo)) {
      throw new OneKeyInternalError('transfersInfo is required');
    }
    if (transfersInfo.length > 1) {
      throw new OneKeyInternalError('Batch transfer is not supported');
    }
    const transferInfo = transfersInfo[0];
    if (!transferInfo.to) {
      throw new OneKeyLocalError(
        'buildEncodedTx ERROR: transferInfo.to is missing',
      );
    }

    const inputs = await this.buildTransferInputs({
      transferInfo,
    });

    const transaction = await this.buildTransferTransaction({
      fromAddress: inputs.fromAccountAddress,
      toAddress: inputs.toAccountAddress,
      tokenScriptHash: inputs.tokenScriptHash,
      amount: inputs.amountToTransfer,
      systemFee: inputs.systemFee,
      networkFee: inputs.networkFee,
    });
    return transaction.toJson();
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx?.encodedTx as IEncodedTxNeoN3;
    console.log('encodedTx: ', encodedTx);

    const network = await this.getNetwork();
    const account = await this.getAccount();

    const actions: IDecodedTxAction[] = [];

    if (unsignedTx.transfersInfo?.[0]) {
      const { tokenInfo } = unsignedTx.transfersInfo[0];
      const inputs = await this.buildTransferInputs({
        transferInfo: unsignedTx.transfersInfo[0],
      });

      const token = await this.backgroundApi.serviceToken.getToken({
        networkId: this.networkId,
        accountId: this.accountId,
        tokenIdOnNetwork: tokenInfo?.address ?? '',
      });

      if (
        token?.decimals === undefined ||
        token?.decimals === null ||
        Number.isNaN(token?.decimals)
      ) {
        throw new OneKeyInternalError('Token decimals is required');
      }

      const action = await this.buildTxTransferAssetAction({
        from: inputs.fromAccountAddress,
        to: inputs.toAccountAddress,
        transfers: [
          {
            from: inputs.fromAccountAddress,
            to: inputs.toAccountAddress,
            amount: new BigNumber(inputs.amountToTransfer)
              .shiftedBy(-token.decimals)
              .toFixed(),
            icon: token?.logoURI ?? '',
            symbol: token?.symbol ?? '',
            name: token?.name ?? '',
            tokenIdOnNetwork: token?.address ?? '',
            isNative: token?.isNative,
          },
        ],
      });
      actions.push(action);
    } else {
      actions.push({
        type: EDecodedTxActionType.FUNCTION_CALL,
        functionCall: {
          functionName: tx.Transaction.fromJson(encodedTx).serialize(false),
          from: account.address,
          to: '',
          icon: network.logoURI ?? '',
          args: [],
        },
      });
    }

    if (actions.length === 0) {
      actions.push({
        type: EDecodedTxActionType.UNKNOWN,
        unknownAction: {
          from: account.address,
          to: '',
          icon: network.logoURI ?? '',
        },
      });
    }

    const result: IDecodedTx = {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: 0,
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      encodedTx,
    };

    return Promise.resolve(result);
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo,
      };
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, nativeAmountInfo, feeInfo } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxNeoN3;
    const transaction = tx.Transaction.fromJson(encodedTx);

    // max send
    if (nativeAmountInfo?.maxSendAmount && unsignedTx.transfersInfo?.[0]) {
      const transferInfo = unsignedTx.transfersInfo[0];
      const { to, tokenInfo } = transferInfo;
      const dbAccount = await this.getAccount();

      if (!tokenInfo) {
        throw new OneKeyInternalError('Token info is required');
      }

      const maxAmount = new BigNumber(nativeAmountInfo.maxSendAmount)
        .shiftedBy(tokenInfo.decimals || 0)
        .toFixed();

      let systemFee = '0';
      let networkFee = '0';

      if (feeInfo?.feeNeoN3) {
        const {
          systemFee: customSystemFee = '0',
          networkFee: customNetworkFee = '0',
          priorityFee = '0',
        } = feeInfo.feeNeoN3;

        systemFee = customSystemFee;
        networkFee = new BigNumber(customNetworkFee)
          .plus(priorityFee)
          .toFixed();
      } else if (transaction.systemFee && transaction.networkFee) {
        systemFee = transaction.systemFee.toString();
        networkFee = transaction.networkFee.toString();
      }

      const maxAmountTransaction = await this.buildTransferTransaction({
        fromAddress: dbAccount.address,
        toAddress: to,
        tokenScriptHash: tokenInfo.address,
        amount: maxAmount,
        systemFee,
        networkFee,
      });

      return {
        ...unsignedTx,
        encodedTx: maxAmountTransaction.toJson(),
      };
    }

    // update fee
    if (feeInfo?.feeNeoN3) {
      const {
        systemFee = '0',
        networkFee = '0',
        priorityFee = '0',
      } = feeInfo.feeNeoN3;
      transaction.systemFee = u.BigInteger.fromNumber(
        new BigNumber(systemFee).toNumber(),
      );
      transaction.networkFee = u.BigInteger.fromNumber(
        new BigNumber(networkFee).plus(priorityFee).toNumber(),
      );
      return {
        ...unsignedTx,
        encodedTx: transaction.toJson(),
      };
    }

    return Promise.resolve(unsignedTx);
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    if (wallet.isAddress(address)) {
      return Promise.resolve({
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
      });
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    throw new NotImplemented();
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    throw new NotImplemented();
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    throw new NotImplemented();
  }

  override validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    throw new NotImplemented();
  }

  override validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    throw new NotImplemented();
  }

  async getBlockCount() {
    try {
      const [blockCount] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
          result: number;
        }>({
          networkId: this.networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'getblockcount',
                params: [],
              },
            },
          ],
          returnRawData: true,
        });
      if (blockCount.result === undefined || blockCount.result === null) {
        throw new OneKeyInternalError(
          'Invalid block count: result is null or undefined',
        );
      }
      const blockCountBN = new BigNumber(blockCount.result);
      if (blockCountBN.isNaN() || blockCountBN.isNegative()) {
        throw new OneKeyInternalError(
          'Invalid block count: expected a non-negative number',
        );
      }
      return blockCountBN.toNumber();
    } catch (error) {
      throw new OneKeyInternalError(
        `Failed to get block count: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      );
    }
  }

  /** ************************************ DApp Method ************************************* */
  // Invoke
  async createInvokeInputs(invokeArgs: IInvokeArguments) {
    const { args, scriptHash, operation } = invokeArgs;
    return {
      scriptHash,
      operation,
      args: args.map((item: IArgument) => {
        if (item && item.type && item.type === 'Address') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
          return sc.ContractParam.hash160(item.value.toString());
        }
        if (item) {
          return ContractParam.fromJson(item).toJson();
        }
        return null;
      }),
    };
  }

  async createNeo3InvokeTx(params: {
    invokeArgs: ContractCall[];
    signers: SignerLike[];
    networkFee: string;
    systemFee?: any;
    overrideSystemFee?: any;
  }) {
    let script = '';
    try {
      script = sc.createScript(...params.invokeArgs);
    } catch (error) {
      throw new OneKeyInternalError('Failed to create script');
    }

    const currentHeight = await this.getBlockCount();

    const transaction = new tx.Transaction({
      signers: params.signers,
      validUntilBlock: currentHeight + 100,
      systemFee: '0',
      script,
    });

    return transaction.toJson();
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const rpcClient = new rpc.RPCClient(params.rpcUrl);
    const start = performance.now();
    const latestBlock = await rpcClient.getBlockCount();
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber: Number(latestBlock),
    };
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;
    const { signature, publicKey, rawTx, encodedTx } = signedTx;

    const rpcUrl = customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }
    if (!rawTx) {
      throw new OneKeyLocalError('rawTx is empty');
    }

    const rpcClient = new rpc.RPCClient(rpcUrl);
    const client = new rpc.RPCClient(rpcUrl);
    const txid = await client.sendRawTransaction(rawTx);

    console.log('broadcastTransaction Done:', {
      txid,
      rawTx,
    });

    return {
      ...params.signedTx,
      txid,
    };
  }
}
