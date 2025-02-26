/* eslint-disable @typescript-eslint/no-unused-vars */
import { sc, tx, u, wallet } from '@cityofzion/neon-core';
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import type { IEncodedTxNeoN3 } from '@onekeyhq/core/src/chains/neo/types';
import type { IEncodedTx, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
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
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }

    const inputs = await this.buildTransferInputs({
      transferInfo,
    });

    const script = sc.createScript({
      scriptHash: inputs.tokenScriptHash,
      operation: 'transfer',
      args: [
        sc.ContractParam.hash160(inputs.fromAccountAddress),
        sc.ContractParam.hash160(inputs.toAccountAddress),
        sc.ContractParam.integer(inputs.amountToTransfer),
        sc.ContractParam.any(null),
      ],
    });

    const currentHeight = await this.getBlockCount();

    const transaction = new tx.Transaction({
      signers: [
        {
          account: inputs.scriptHash,
          scopes: tx.WitnessScope.CalledByEntry,
        },
      ],
      validUntilBlock: currentHeight + 100,
      systemFee: inputs.systemFee,
      script,
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
      // TODO: contract interaction
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
    if (nativeAmountInfo?.maxSendAmount) {
      // TODO:
      // - 根据最新的 amount, systemFee, networkFee, 更新 transaction
    }

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
}
