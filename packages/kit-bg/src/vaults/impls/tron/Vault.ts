/* eslint-disable @typescript-eslint/no-unused-vars */
import { defaultAbiCoder } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';
import TronWeb from 'tronweb';

import type {
  IDecodedTxExtraTron,
  IEncodedTxTron,
} from '@onekeyhq/core/src/chains/tron/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  InsufficientBalance,
  InvalidAddress,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
import type {
  IAddressValidation,
  IGeneralInputValidation,
  INetworkAccountAddressDetail,
  IPrivateKeyValidation,
  IXprvtValidation,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IOnChainHistoryTx } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxAction,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';
import { EErc20MethodSelectors } from '../evm/decoder/abi';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  INativeAmountInfo,
  ITokenApproveInfo,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';

const INFINITE_AMOUNT_HEX =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.tron.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId, externalAccountAddress } = params;

    const address = account.address || externalAccountAddress || '';

    const { normalizedAddress, displayAddress, isValid } =
      await this.validateAddress(address);
    return {
      networkId,
      normalizedAddress,
      displayAddress,
      address: displayAddress,
      baseAddress: normalizedAddress,
      isValid,
      allowEmptyAddress: false,
    };
  }

  override buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxTron> {
    const { transfersInfo } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      return this._buildEncodedTxFromTransfer(params);
    }

    throw new OneKeyInternalError();
  }

  async _buildEncodedTxFromTransfer(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxTron> {
    const transfersInfo = params.transfersInfo as ITransferInfo[];
    if (transfersInfo.length === 1) {
      const transferInfo = transfersInfo[0];
      const { from, to, amount, tokenInfo } = transferInfo;

      if (!transferInfo.to) {
        throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
      }

      if (!tokenInfo) {
        throw new Error(
          'buildEncodedTx ERROR: transferInfo.tokenInfo is missing',
        );
      }

      if (!tokenInfo.isNative) {
        const [
          {
            result: { result },
            transaction,
          },
        ] = await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
          result: { result: boolean };
          transaction: IUnsignedTransaction;
        }>({
          networkId: this.networkId,
          body: [
            {
              route: 'tronweb',
              params: {
                method: 'transactionBuilder.triggerSmartContract',
                params: [
                  tokenInfo.address,
                  'transfer(address,uint256)',
                  {},
                  [
                    { type: 'address', value: to },
                    {
                      type: 'uint256',
                      value: new BigNumber(amount)
                        .shiftedBy(tokenInfo.decimals)
                        .toFixed(0),
                    },
                  ],
                  from,
                ],
              },
            },
          ],
        });
        if (!result) {
          throw new OneKeyInternalError(
            'Unable to build token transfer transaction',
          );
        }
        return transaction;
      }

      try {
        const [transaction] =
          await this.backgroundApi.serviceAccountProfile.sendProxyRequest<IUnsignedTransaction>(
            {
              networkId: this.networkId,
              body: [
                {
                  route: 'tronweb',
                  params: {
                    method: 'transactionBuilder.sendTrx',
                    params: [
                      to,
                      parseInt(
                        new BigNumber(amount)
                          .shiftedBy(tokenInfo.decimals)
                          .toFixed(),
                        10,
                      ),
                      from,
                    ],
                  },
                },
              ],
            },
          );
        return transaction;
      } catch (e) {
        if (typeof e === 'string' && e.endsWith('balance is not sufficient.')) {
          throw new InsufficientBalance({
            info: {
              symbol: tokenInfo.symbol,
            },
          });
        } else if (typeof e === 'string') {
          throw new Error(e);
        } else {
          throw e;
        }
      }
    }
    return this._buildEncodedTxFromBatchTransfer(transfersInfo);
  }

  async _buildEncodedTxFromBatchTransfer(transfersInfo: ITransferInfo[]) {
    return {} as IUnsignedTransaction;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;

    const encodedTx = unsignedTx.encodedTx as IEncodedTxTron;

    const { swapInfo } = unsignedTx;

    let action: IDecodedTxAction = { type: EDecodedTxActionType.UNKNOWN };
    let toAddress = '';

    if (encodedTx.raw_data.contract[0].type === 'TransferContract') {
      const actionFromNativeTransfer =
        await this._buildTxTransferNativeTokenAction({
          encodedTx,
        });
      if (actionFromNativeTransfer?.action) {
        action = actionFromNativeTransfer.action;
        toAddress = actionFromNativeTransfer.toAddress;
      }
    } else if (encodedTx.raw_data.contract[0].type === 'TriggerSmartContract') {
      const actionFromContract = await this._buildTxActionFromContract({
        encodedTx,
      });
      if (actionFromContract?.action) {
        action = actionFromContract.action;
        toAddress = actionFromContract.toAddress;
      }
    }

    if (swapInfo) {
      action = await this.buildInternalSwapAction({
        swapInfo,
        swapToAddress: toAddress,
      });
    }

    const owner = await this.getAccountAddress();
    return {
      txid: encodedTx.txID,
      owner,
      signer: owner,
      to: toAddress,
      nonce: 0,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,

      extraInfo: null,
      encodedTx,
    };
  }

  async _buildTxTransferNativeTokenAction({
    encodedTx,
  }: {
    encodedTx: IEncodedTxTron;
  }) {
    const {
      amount,
      owner_address: fromAddressHex,
      to_address: toAddressHex,
    } = (encodedTx.raw_data.contract[0] as ISendTrxCall).parameter.value;

    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      accountId: this.accountId,
      networkId: this.networkId,
      tokenIdOnNetwork: '',
    });

    if (!nativeToken) return;

    const from = TronWeb.address.fromHex(fromAddressHex) ?? accountAddress;
    const to = TronWeb.address.fromHex(toAddressHex);
    const transfer: IDecodedTxTransferInfo = {
      from,
      to,
      tokenIdOnNetwork: nativeToken.address,
      icon: nativeToken.logoURI ?? '',
      name: nativeToken.name,
      symbol: nativeToken.symbol,
      amount: new BigNumber(amount).shiftedBy(-nativeToken.decimals).toFixed(),
      isNFT: false,
      isNative: true,
    };

    const action = await this.buildTxTransferAssetAction({
      from,
      to,
      transfers: [transfer],
    });

    return {
      toAddress: to,
      action,
    };
  }

  async _buildTxActionFromContract({
    encodedTx,
  }: {
    encodedTx: IEncodedTxTron;
  }) {
    const {
      contract_address: contractAddressHex,
      data,
      owner_address: fromAddressHex,
    } = (encodedTx.raw_data.contract[0] as ITriggerSmartContractCall).parameter
      .value;

    let action;

    try {
      const fromAddress = TronWeb.address.fromHex(fromAddressHex);
      const tokenAddress = TronWeb.address.fromHex(contractAddressHex);

      const token = await this.backgroundApi.serviceToken.getToken({
        accountId: this.accountId,
        networkId: this.networkId,
        tokenIdOnNetwork: tokenAddress,
      });

      if (!token) return;

      const methodSelector = `0x${data.slice(0, 8)}`;

      if (methodSelector === EErc20MethodSelectors.tokenTransfer) {
        const [toAddressHex, decodedAmount] = defaultAbiCoder.decode(
          ['address', 'uint256'],
          `0x${data.slice(8)}`,
        );

        const amountBN = new BigNumber(
          (decodedAmount as { _hex: string })._hex,
        );

        const transfer: IDecodedTxTransferInfo = {
          from: fromAddress,
          to: TronWeb.address.fromHex(toAddressHex),
          tokenIdOnNetwork: token.address,
          icon: token.logoURI ?? '',
          name: token.name,
          symbol: token.symbol,
          amount: amountBN.shiftedBy(-token.decimals).toFixed(),
          isNFT: false,
        };

        action = await this.buildTxTransferAssetAction({
          from: fromAddress,
          to: TronWeb.address.fromHex(toAddressHex),
          transfers: [transfer],
        });
      }
      if (methodSelector === EErc20MethodSelectors.tokenApprove) {
        const [spenderAddressHex, decodedAmount] = defaultAbiCoder.decode(
          ['address', 'uint256'],
          `0x${data.slice(8)}`,
        );
        const amountBN = new BigNumber(
          (decodedAmount as { _hex: string })._hex,
        );
        action = {
          type: EDecodedTxActionType.TOKEN_APPROVE,
          tokenApprove: {
            from: fromAddress,
            to: tokenAddress,
            spender: TronWeb.address.fromHex(spenderAddressHex),
            amount: amountBN.shiftedBy(-token.decimals).toFixed(),
            icon: token.logoURI ?? '',
            name: token.name,
            symbol: token.symbol,
            decimals: token.decimals,
            tokenIdOnNetwork: token.address,
            isInfiniteAmount: toBigIntHex(amountBN) === INFINITE_AMOUNT_HEX,
          },
        };
      }

      return {
        toAddress: tokenAddress,
        action,
      };
    } catch (e) {
      console.error('buildTxActionFromContract ERROR:', e);
      // Unable to parse, will be a unknown action
    }
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx(encodedTx as IEncodedTxTron);
    }
    throw new OneKeyInternalError();
  }

  async _buildUnsignedTxFromEncodedTx(encodedTx: IEncodedTxTron) {
    return Promise.resolve({ encodedTx });
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { unsignedTx, nativeAmountInfo, tokenApproveInfo } = params;
    let encodedTxNew = unsignedTx.encodedTx as IEncodedTxTron;

    if (tokenApproveInfo) {
      encodedTxNew = await this._updateTokenApproveInfo({
        encodedTx: encodedTxNew,
        tokenApproveInfo,
      });
    }

    if (nativeAmountInfo) {
      encodedTxNew = await this._updateNativeTokenAmount({
        encodedTx: encodedTxNew,
        nativeAmountInfo,
      });
    }

    unsignedTx.encodedTx = encodedTxNew;
    return unsignedTx;
  }

  async _updateTokenApproveInfo(params: {
    encodedTx: IEncodedTxTron;
    tokenApproveInfo: ITokenApproveInfo;
  }) {
    const { encodedTx, tokenApproveInfo } = params;
    const actionFromContract = await this._buildTxActionFromContract({
      encodedTx,
    });
    if (
      actionFromContract &&
      actionFromContract.action &&
      actionFromContract.action.type === EDecodedTxActionType.TOKEN_APPROVE &&
      actionFromContract.action.tokenApprove
    ) {
      const accountAddress = await this.getAccountAddress();
      const { allowance, isUnlimited } = tokenApproveInfo;
      const { spender, decimals, tokenIdOnNetwork } =
        actionFromContract.action.tokenApprove;

      const amountHex = toBigIntHex(
        isUnlimited
          ? new BigNumber(2).pow(256).minus(1)
          : new BigNumber(allowance).shiftedBy(decimals),
      );

      try {
        const [
          {
            result: { result },
            transaction,
          },
        ] = await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
          result: { result: boolean };
          transaction: IUnsignedTransaction;
        }>({
          networkId: this.networkId,
          body: [
            {
              route: 'tronweb',
              params: {
                method: 'transactionBuilder.triggerSmartContract',
                params: [
                  tokenIdOnNetwork,
                  'approve(address,uint256)',
                  {},
                  [
                    { type: 'address', value: spender },
                    {
                      type: 'uint256',
                      value: amountHex,
                    },
                  ],
                  accountAddress,
                ],
              },
            },
          ],
        });
        if (!result) {
          throw new OneKeyInternalError(
            'Unable to build token approve transaction',
          );
        }
        return transaction;
      } catch (e) {
        console.error('updateTokenApproveInfo ERROR:', e);
        return encodedTx;
      }
    }
    return encodedTx;
  }

  async _updateNativeTokenAmount(params: {
    encodedTx: IEncodedTxTron;
    nativeAmountInfo: INativeAmountInfo;
  }) {
    const { encodedTx, nativeAmountInfo } = params;
    const network = await this.getNetwork();

    if (
      encodedTx.raw_data.contract[0].type === 'TransferContract' &&
      !isNil(nativeAmountInfo.maxSendAmount)
    ) {
      const { owner_address: fromAddressHex, to_address: toAddressHex } =
        encodedTx.raw_data.contract[0].parameter.value;

      const [transaction] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<IUnsignedTransaction>(
          {
            networkId: this.networkId,
            body: [
              {
                route: 'tronweb',
                params: {
                  method: 'transactionBuilder.sendTrx',
                  params: [
                    TronWeb.address.fromHex(toAddressHex),
                    new BigNumber(nativeAmountInfo.maxSendAmount)
                      .shiftedBy(network.decimals)
                      .toNumber(),
                    TronWeb.address.fromHex(fromAddressHex),
                  ],
                },
              },
            ],
          },
        );
      return transaction;
    }

    return Promise.resolve(encodedTx);
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    if (TronWeb.isAddress(address)) {
      const resolvedAddress = TronWeb.address.fromHex(address);
      return Promise.resolve({
        isValid: true,
        normalizedAddress: resolvedAddress,
        displayAddress: resolvedAddress,
        address,
      });
    }
    return Promise.resolve({
      isValid: false,
      normalizedAddress: '',
      displayAddress: '',
    });
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
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
    return this.baseValidatePrivateKey(privateKey);
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override async buildOnChainHistoryTxExtraInfo({
    onChainHistoryTx,
  }: {
    onChainHistoryTx: IOnChainHistoryTx;
  }): Promise<IDecodedTxExtraTron> {
    const receipt = onChainHistoryTx.receipt;
    return Promise.resolve({
      energyUsage: receipt?.energyUsage,
      energyFee: receipt?.energyFee,
      energyUsageTotal: receipt?.energyUsageTotal,
      netUsage: receipt?.netUsage,
    });
  }
}
