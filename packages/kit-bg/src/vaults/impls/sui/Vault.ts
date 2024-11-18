/* eslint-disable @typescript-eslint/no-unused-vars */
import { Transaction } from '@mysten/sui/transactions';
import { SUI_TYPE_ARG, isValidSuiAddress } from '@mysten/sui/utils';
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import type { IEncodedTxSui } from '@onekeyhq/core/src/chains/sui/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { OneKeyInternalError } from '@onekeyhq/shared/src/errors';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
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
import { OneKeySuiClient } from './sdkSui/ClientSui';
import { OneKeySuiTransport } from './sdkSui/SuiTransport';
import transactionUtils, { ESuiTransactionType } from './sdkSui/transactions';
import { waitPendingTransaction } from './sdkSui/utils';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionByCustomRpcParams,
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildOkxSwapEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type {
  SuiTransactionBlockResponse,
  SuiTransactionBlockResponseOptions,
} from '@mysten/sui/client';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.sui.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  getClientCache = memoizee(async () => this.getSuiClient(), {
    promise: true,
    max: 1,
    maxAge: timerUtils.getTimeDurationMs({ minute: 3 }),
  });

  async getClient() {
    return this.getClientCache();
  }

  getSuiClient() {
    const transport = new OneKeySuiTransport({
      backgroundApi: this.backgroundApi,
      networkId: this.networkId,
    });
    return new OneKeySuiClient({
      transport,
    });
  }

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

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxSui> {
    const { transfersInfo } = params;
    if (!transfersInfo || isEmpty(transfersInfo)) {
      throw new OneKeyInternalError('transfersInfo is required');
    }
    if (transfersInfo.length > 1) {
      throw new OneKeyInternalError('Batch transfer is not supported');
    }
    const transferInfo = transfersInfo[0];
    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }
    const { to, amount, tokenInfo } = transferInfo;
    const account = await this.getAccount();
    const recipient = hexUtils.addHexPrefix(to);
    const sender = hexUtils.addHexPrefix(account.address);
    if (
      !tokenInfo ||
      typeof tokenInfo.decimals !== 'number' ||
      tokenInfo.decimals < 0
    ) {
      throw new OneKeyInternalError('Token decimals is required');
    }

    const amountValue = new BigNumber(amount)
      .shiftedBy(tokenInfo.decimals)
      .toFixed();
    const client = await this.getClient();
    const transaction = await transactionUtils.createTokenTransaction({
      client,
      sender,
      recipient,
      amount: amountValue,
      coinType: tokenInfo.address,
    });

    return {
      rawTx: transaction.serialize(),
      sender: account.address,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx?.encodedTx as IEncodedTxSui;
    const { swapInfo } = unsignedTx;

    const tx = Transaction.from(encodedTx.rawTx);
    tx.setSender(tx.blockData.sender ?? (await this.getAccountAddress()));

    const transactionType = transactionUtils.analyzeTransactionType(tx);

    const network = await this.getNetwork();
    const account = await this.getAccount();
    let actions: IDecodedTxAction[] = [];

    if (transactionType === ESuiTransactionType.TokenTransfer) {
      console.log('unsignedTx.transfersInfo: ', unsignedTx.transfersInfo);
      if (unsignedTx.transfersInfo?.[0]) {
        const { from, to, amount, tokenInfo } = unsignedTx.transfersInfo[0];
        const token = await this.backgroundApi.serviceToken.getToken({
          networkId: this.networkId,
          accountId: this.accountId,
          tokenIdOnNetwork: tokenInfo?.address ?? '',
        });
        const action = await this.buildTxTransferAssetAction({
          from,
          to,
          transfers: [
            {
              from,
              to,
              amount,
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
        // use dry-run result to create action
        const client = await this.getClient();
        const buildTx = await tx.build({ client });
        const dryRunResult = await client.dryRunTransactionBlock({
          transactionBlock: buildTx,
        });
        const transfers = transactionUtils.parseTransferDetails({
          balanceChanges: dryRunResult.balanceChanges,
        });
        if (transfers.length > 0) {
          const action = await this.buildTxTransferAssetAction({
            from: transfers[0].from,
            to: transfers[0].to,
            transfers: (
              await Promise.all(
                transfers.map(async (transfer) => {
                  const token = await this.backgroundApi.serviceToken.getToken({
                    networkId: this.networkId,
                    accountId: this.accountId,
                    tokenIdOnNetwork: transfer.tokenAddress,
                  });
                  if (
                    token?.decimals === undefined ||
                    token?.decimals === null ||
                    Number.isNaN(token?.decimals)
                  ) {
                    return null;
                  }
                  return {
                    from: transfer.from,
                    to: transfer.to,
                    amount: new BigNumber(transfer.amount)
                      .shiftedBy(-token.decimals)
                      .toString(),
                    icon: token?.logoURI ?? '',
                    symbol: token?.symbol ?? '',
                    name: token?.name ?? '',
                    tokenIdOnNetwork: token?.address ?? '',
                    isNative: token?.isNative,
                  };
                }),
              )
            ).filter(Boolean),
          });
          actions.push(action);
        }
      }
    } else if (transactionType === ESuiTransactionType.ContractInteraction) {
      const contractInfo = transactionUtils.parseMoveCall(tx);
      if (contractInfo) {
        actions.push({
          type: EDecodedTxActionType.FUNCTION_CALL,
          functionCall: {
            from: account.address,
            to: contractInfo.contractTo,
            functionName: contractInfo.contractName,
            icon: network.logoURI ?? '',
            args: [],
          },
        });
      }
    }

    if (swapInfo) {
      const toAddress =
        unsignedTx.transfersInfo?.[0]?.to || actions?.[0]?.assetTransfer?.to;
      actions = [
        await this.buildInternalSwapAction({
          swapInfo,
          swapToAddress: toAddress,
        }),
      ];
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
    const client = await this.getClient();
    const { unsignedTx, nativeAmountInfo, feeInfo } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxSui;

    // max send
    if (nativeAmountInfo?.maxSendAmount) {
      const { rawTx } = encodedTx;
      const oldTx = Transaction.from(rawTx);

      const transactionType = transactionUtils.analyzeTransactionType(oldTx);
      if (transactionType !== ESuiTransactionType.TokenTransfer) {
        return Promise.resolve(unsignedTx);
      }

      if (!unsignedTx.transfersInfo?.[0]?.to) {
        throw new OneKeyInternalError('Invalid transfer object');
      }

      // max send logic
      const newTx = await transactionUtils.createTokenTransaction({
        client,
        sender: oldTx.blockData.sender ?? (await this.getAccountAddress()),
        recipient: unsignedTx.transfersInfo[0].to,
        amount: nativeAmountInfo.maxSendAmount,
        coinType: SUI_TYPE_ARG,
        maxSendNativeToken: true,
      });
      const newEncodedTx = {
        ...encodedTx,
        rawTx: newTx.serialize(),
      };
      return {
        ...unsignedTx,
        encodedTx: newEncodedTx,
      };
    }

    if (feeInfo?.gas?.gasLimit && feeInfo?.gas?.gasPrice) {
      const newTx = Transaction.from(encodedTx.rawTx);
      newTx.blockData.gasConfig.price = feeInfo.gas.gasPrice;
      newTx.blockData.gasConfig.budget = feeInfo.gas.gasLimit;
      // newTx.setGasPrice(new BigNumber(feeInfo.gas.gasPrice).toNumber());
      // newTx.setGasBudget(new BigNumber(feeInfo.gas.gasLimit).toNumber());
      const newEncodedTx = {
        ...encodedTx,
        rawTx: newTx.serialize(),
      };
      return {
        ...unsignedTx,
        encodedTx: newEncodedTx,
      };
    }

    return Promise.resolve(unsignedTx);
  }

  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    try {
      const { signature, publicKey, rawTx, encodedTx } = params.signedTx;

      if (!signature) {
        throw new Error('signature is empty');
      }
      if (!publicKey) {
        throw new Error('publicKey is empty');
      }

      const txid = await this.backgroundApi.serviceSend.broadcastTransaction({
        accountId: this.accountId,
        networkId: this.networkId,
        signedTx: params.signedTx,
        accountAddress: (await this.getAccount()).address,
        signature,
      });

      console.log('broadcastTransaction Done:', {
        txid,
        rawTx,
      });

      return {
        ...params.signedTx,
        txid,
      };
    } catch (error: any) {
      const { errorCode, message }: { errorCode: any; message: string } =
        error || {};

      // payAllSui problem https://github.com/MystenLabs/sui/issues/6364
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const errorMessage = `${errorCode ?? ''} ${message}`;
      if (message.indexOf('Insufficient gas:') !== -1) {
        // TODO: need to i18n insufficient fee message
        throw new OneKeyInternalError('msg__broadcast_tx_Insufficient_fee');
      } else {
        throw new OneKeyInternalError(errorMessage);
      }
    }
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    const isValid = isValidSuiAddress(address);
    return Promise.resolve({
      isValid,
      normalizedAddress: isValid ? address : '',
      displayAddress: isValid ? address : '',
    });
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    return super.baseGetPrivateKeyFromImported(params);
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    if (!/^(0x)?[0-9a-zA-Z]{64}$/.test(privateKey)) {
      return {
        isValid: false,
      };
    }
    return this.baseValidatePrivateKey(privateKey);
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  async waitPendingTransaction(
    txId: string,
    options?: SuiTransactionBlockResponseOptions,
  ): Promise<SuiTransactionBlockResponse | undefined> {
    const client = await this.getClient();
    return waitPendingTransaction(client, txId, options);
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const client = new OneKeySuiClient({
      url: params.rpcUrl,
    });
    const start = performance.now();
    const latestBlock = await client.getTotalTransactionBlocks();
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber: Number(latestBlock),
    };
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    try {
      const { customRpcInfo, signedTx } = params;
      const { signature, publicKey, rawTx, encodedTx } = signedTx;

      const rpcUrl = customRpcInfo.rpc;
      if (!rpcUrl) {
        throw new OneKeyInternalError('Invalid rpc url');
      }

      if (!signature) {
        throw new Error('signature is empty');
      }
      if (!publicKey) {
        throw new Error('publicKey is empty');
      }

      const client = new OneKeySuiClient({ url: rpcUrl });

      const response = await client.executeTransactionBlock({
        transactionBlock: rawTx,
        signature,
        requestType: (signedTx.encodedTx as IEncodedTxSui).requestType,
      });
      const txid = response.digest;

      console.log('broadcastTransaction Done:', {
        txid,
        rawTx,
      });

      return {
        ...params.signedTx,
        txid,
      };
    } catch (error: any) {
      const { errorCode, message }: { errorCode: any; message: string } =
        error || {};

      // payAllSui problem https://github.com/MystenLabs/sui/issues/6364
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      const errorMessage = `${errorCode ?? ''} ${message}`;
      if (message.indexOf('Insufficient gas:') !== -1) {
        // TODO: need to i18n insufficient fee message
        throw new OneKeyInternalError('msg__broadcast_tx_Insufficient_fee');
      } else {
        throw new OneKeyInternalError(errorMessage);
      }
    }
  }

  override async buildOkxSwapEncodedTx(
    params: IBuildOkxSwapEncodedTxParams,
  ): Promise<IEncodedTxSui> {
    const accountAddress = await this.getAccountAddress();
    if (params.okxTx.from !== accountAddress) {
      throw new OneKeyInternalError('Invalid from address');
    }
    const encodedTx = {
      rawTx: Transaction.from(params.okxTx.data).serialize(),
      sender: params.okxTx.from,
    };
    return Promise.resolve(encodedTx);
  }
}
