/* eslint-disable @typescript-eslint/no-unused-vars */
import { defaultAbiCoder } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil, noop } from 'lodash';
import TronWeb from 'tronweb';

import {
  TRON_SOURCE_FLAG_MAINNET,
  TRON_SOURCE_FLAG_TESTNET,
  TRON_TX_EXPIRATION_TIME,
} from '@onekeyhq/core/src/chains/tron/constants';
import type {
  IDecodedTxExtraTron,
  IEncodedTxTron,
} from '@onekeyhq/core/src/chains/tron/types';
import coreChainApi from '@onekeyhq/core/src/instance/coreChainApi';
import type { ISignedTxPro, IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  InsufficientBalance,
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import accountUtils from '@onekeyhq/shared/src/utils/accountUtils';
import chainResourceUtils from '@onekeyhq/shared/src/utils/chainResourceUtils';
import contractUtils from '@onekeyhq/shared/src/utils/contractUtils';
import { calculateFeeForSend } from '@onekeyhq/shared/src/utils/feeUtils';
import { toBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';
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
  ETronResourceRentalPayType,
  type IFeeInfoUnit,
  type ITronResourceRentalInfo,
} from '@onekeyhq/shared/types/fee';
import { type IOnChainHistoryTx } from '@onekeyhq/shared/types/history';
import { EReasonForNeedPassword } from '@onekeyhq/shared/types/setting';
import { ESwapTabSwitchType } from '@onekeyhq/shared/types/swap/types';
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
import { KeyringQr } from './KeytringQr';

import type { IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IApproveInfo,
  IBroadcastTransactionByCustomRpcParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildOkxSwapEncodedTxParams,
  IBuildUnsignedTxParams,
  IGetPrivateKeyFromImportedParams,
  IGetPrivateKeyFromImportedResult,
  INativeAmountInfo,
  ITokenApproveInfo,
  ITransferInfo,
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type { Types } from 'tronweb';

const INFINITE_AMOUNT_HEX =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export default class Vault extends VaultBase {
  override coreApi = coreChainApi.tron.hd;

  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: KeyringQr,
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
    const { transfersInfo, approveInfo } = params;

    if (transfersInfo && !isEmpty(transfersInfo)) {
      return this._buildEncodedTxFromTransfer(params);
    }

    if (approveInfo) {
      return this._buildEncodedTxFromApprove(params);
    }

    throw new OneKeyInternalError();
  }

  async _extendTxExpiration({
    transaction,
    expiration,
  }: {
    transaction: Types.Transaction;
    expiration: number;
  }) {
    try {
      const [extendedTransaction] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<Types.Transaction>(
          {
            networkId: this.networkId,
            body: [
              {
                route: 'tronweb',
                params: {
                  method: 'transactionBuilder.extendExpiration',
                  params: [transaction, expiration],
                },
              },
            ],
          },
        );
      return extendedTransaction;
    } catch (e) {
      console.error('extendTxExpiration ERROR:', e);
      return transaction;
    }
  }

  async _buildEncodedTxFromApprove(params: IBuildEncodedTxParams) {
    const { approveInfo } = params;
    const { owner, spender, amount, tokenInfo, isMax } =
      approveInfo as IApproveInfo;

    if (!tokenInfo) {
      throw new OneKeyLocalError(
        'buildEncodedTx ERROR: approveInfo.tokenInfo is missing',
      );
    }

    const amountHex = toBigIntHex(
      isMax
        ? new BigNumber(2).pow(256).minus(1)
        : new BigNumber(amount).shiftedBy(tokenInfo.decimals),
    );

    const [
      {
        result: { result },
        transaction,
      },
    ] = await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
      result: { result: boolean };
      transaction: Types.Transaction;
    }>({
      networkId: this.networkId,
      body: [
        {
          route: 'tronweb',
          params: {
            method: 'transactionBuilder.triggerSmartContract',
            params: [
              tokenInfo.address,
              'approve(address,uint256)',
              {},
              [
                { type: 'address', value: spender },
                {
                  type: 'uint256',
                  value: amountHex,
                },
              ],
              owner,
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
    return this._extendTxExpiration({
      transaction,
      expiration: TRON_TX_EXPIRATION_TIME,
    });
  }

  async _buildEncodedTxFromTransfer(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxTron> {
    const transfersInfo = params.transfersInfo as ITransferInfo[];
    if (transfersInfo.length === 1) {
      const transferInfo = transfersInfo[0];
      const { from, to, amount, tokenInfo } = transferInfo;

      if (!transferInfo.to) {
        throw new OneKeyLocalError(
          'buildEncodedTx ERROR: transferInfo.to is missing',
        );
      }

      if (!tokenInfo) {
        throw new OneKeyLocalError(
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
          transaction: Types.Transaction;
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
        return this._extendTxExpiration({
          transaction,
          expiration: TRON_TX_EXPIRATION_TIME,
        });
      }

      try {
        const [transaction] =
          await this.backgroundApi.serviceAccountProfile.sendProxyRequest<Types.Transaction>(
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
        return await this._extendTxExpiration({
          transaction,
          expiration: TRON_TX_EXPIRATION_TIME,
        });
      } catch (e) {
        if (typeof e === 'string' && e.endsWith('balance is not sufficient.')) {
          throw new InsufficientBalance({
            info: {
              symbol: tokenInfo.symbol,
            },
          });
        } else if (typeof e === 'string') {
          throw new OneKeyLocalError(e);
        } else {
          throw e;
        }
      }
    }
    return this._buildEncodedTxFromBatchTransfer(transfersInfo);
  }

  async _buildEncodedTxFromBatchTransfer(transfersInfo: ITransferInfo[]) {
    return {} as Types.Transaction;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const accountAddress = await this.getAccountAddress();

    const encodedTx = unsignedTx.encodedTx as IEncodedTxTron;

    const { swapInfo } = unsignedTx;

    let action: IDecodedTxAction = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: accountAddress,
        to: '',
      },
    };
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
    } = encodedTx.raw_data.contract[0].parameter
      .value as Types.TransferContract;

    const accountAddress = await this.getAccountAddress();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      accountId: this.accountId,
      networkId: this.networkId,
      tokenIdOnNetwork: '',
    });

    if (!nativeToken) return;

    const from =
      TronWeb.utils.address.fromHex(fromAddressHex) ?? accountAddress;
    const to = TronWeb.utils.address.fromHex(toAddressHex);
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
      data = '',
      owner_address: fromAddressHex,
    } = encodedTx.raw_data.contract[0].parameter
      .value as Types.TriggerSmartContract;

    let action;

    try {
      const fromAddress = TronWeb.utils.address.fromHex(fromAddressHex);
      const tokenAddress = TronWeb.utils.address.fromHex(contractAddressHex);

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
          to: TronWeb.utils.address.fromHex(toAddressHex),
          tokenIdOnNetwork: token.address,
          icon: token.logoURI ?? '',
          name: token.name,
          symbol: token.symbol,
          amount: amountBN.shiftedBy(-token.decimals).toFixed(),
          isNFT: false,
        };

        action = await this.buildTxTransferAssetAction({
          from: fromAddress,
          to: TronWeb.utils.address.fromHex(toAddressHex),
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
            spender: TronWeb.utils.address.fromHex(spenderAddressHex),
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
      return this._buildUnsignedTxFromEncodedTx({
        encodedTx: encodedTx as IEncodedTxTron,
        transfersInfo: params.transfersInfo ?? [],
      });
    }
    throw new OneKeyInternalError();
  }

  async _buildUnsignedTxFromEncodedTx({
    encodedTx,
    transfersInfo,
  }: {
    encodedTx: IEncodedTxTron;
    transfersInfo: ITransferInfo[];
  }) {
    return Promise.resolve({ encodedTx, transfersInfo });
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const {
      unsignedTx,
      nativeAmountInfo,
      tokenApproveInfo,
      tronResourceRentalInfo,
    } = params;
    let encodedTxNew = unsignedTx.encodedTx as IEncodedTxTron;
    let updated = false;
    if (tokenApproveInfo) {
      encodedTxNew = await this._updateTokenApproveInfo({
        encodedTx: encodedTxNew,
        tokenApproveInfo,
      });
      updated = true;
    }

    if (nativeAmountInfo) {
      encodedTxNew = await this._updateNativeTokenAmount({
        encodedTx: encodedTxNew,
        nativeAmountInfo,
      });
      updated = true;
    }

    if (
      unsignedTx.transfersInfo &&
      unsignedTx.transfersInfo.length > 0 &&
      tronResourceRentalInfo &&
      !updated
    ) {
      encodedTxNew = await this._updateTxAfterResourceRental({
        encodedTx: encodedTxNew,
        tronResourceRentalInfo,
        transfersInfo: unsignedTx.transfersInfo,
      });
      updated = true;
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
          transaction: Types.Transaction;
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
        return await this._extendTxExpiration({
          transaction,
          expiration: TRON_TX_EXPIRATION_TIME,
        });
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
        encodedTx.raw_data.contract[0].parameter
          .value as Types.TransferContract;

      const [transaction] =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequest<Types.Transaction>(
          {
            networkId: this.networkId,
            body: [
              {
                route: 'tronweb',
                params: {
                  method: 'transactionBuilder.sendTrx',
                  params: [
                    TronWeb.utils.address.fromHex(toAddressHex),
                    new BigNumber(nativeAmountInfo.maxSendAmount)
                      .shiftedBy(network.decimals)
                      .toNumber(),
                    TronWeb.utils.address.fromHex(fromAddressHex),
                  ],
                },
              },
            ],
          },
        );
      return this._extendTxExpiration({
        transaction,
        expiration: TRON_TX_EXPIRATION_TIME,
      });
    }

    return Promise.resolve(encodedTx);
  }

  async _updateTxAfterResourceRental(params: {
    encodedTx: IEncodedTxTron;
    tronResourceRentalInfo: ITronResourceRentalInfo;
    transfersInfo: ITransferInfo[];
  }) {
    const { encodedTx, tronResourceRentalInfo, transfersInfo } = params;

    if (
      !tronResourceRentalInfo.isResourceRentalEnabled ||
      !tronResourceRentalInfo.isResourceRentalNeeded
    ) {
      return encodedTx;
    }

    return this._buildEncodedTxFromTransfer({
      transfersInfo,
    });
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    if (TronWeb.utils.address.isAddress(address)) {
      const resolvedAddress = TronWeb.utils.address.fromHex(address);
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

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const tronWeb = new TronWeb.TronWeb({ fullHost: params.rpcUrl });
    const start = performance.now();
    const {
      result: { number: blockNumber },
    } = await tronWeb.fullNode.request<{
      result: { number: string };
    }>(
      'jsonrpc',
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBlockByNumber',
        params: ['latest', false],
      },
      'post',
    );
    const bestBlockNumber = parseInt(blockNumber, 10);
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber,
    };
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;
    const rpcUrl = customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }
    const tronWeb = new TronWeb.TronWeb({ fullHost: rpcUrl });
    const ret = await tronWeb.trx.sendRawTransaction(
      JSON.parse(signedTx.rawTx),
    );

    if (typeof ret.code !== 'undefined') {
      throw new OneKeyInternalError(
        `${ret.code} ${Buffer.from(ret.message || '', 'hex').toString()}`,
      );
    }
    console.log('broadcastTransaction END:', {
      txid: signedTx.txid,
      rawTx: signedTx.rawTx,
    });
    return {
      ...params.signedTx,
      txid: signedTx.txid,
    };
  }

  override async buildOkxSwapEncodedTx(
    params: IBuildOkxSwapEncodedTxParams,
  ): Promise<IEncodedTxTron> {
    const { okxTx, fromTokenInfo, type } = params;
    const { from, to, value, data, signatureData: _signatureData } = okxTx;
    const signatureData: { functionSelector: string } = JSON.parse(
      (_signatureData as string[])[0] ?? '{}',
    );

    const isSwapBridge = type === ESwapTabSwitchType.BRIDGE;

    let signatureDataHex = '';

    if (signatureData) {
      signatureDataHex = signatureData.functionSelector ?? '';
    }

    let buildTxParams = [];
    const functionParams =
      contractUtils.parseSignatureParameters(signatureDataHex);
    const functionParamValues = contractUtils.flattenBigNumbers(
      defaultAbiCoder.decode(functionParams, `0x${data.slice(10)}`),
    ) as unknown[];
    buildTxParams = functionParams.map((param, index) => ({
      type: param,
      value: functionParamValues[index],
    }));

    const [{ result, transaction }] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
        result: { result: boolean };
        transaction: Types.Transaction;
      }>({
        networkId: this.networkId,
        body: [
          {
            route: 'tronweb',
            params: {
              method: 'transactionBuilder.triggerSmartContract',
              params: [
                to,
                signatureDataHex,
                {
                  feeLimit: 300_000_000,
                  callValue: parseInt(value, 10),
                },
                buildTxParams,
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

    if (!isSwapBridge) {
      (
        transaction.raw_data.contract[0].parameter
          .value as Types.TriggerSmartContract
      ).data = data.slice(2);

      const txPb = TronWeb.utils.transaction.txJsonToPb(transaction);

      const txRawDataHex = TronWeb.utils.transaction.txPbToRawDataHex(txPb);
      const txID = TronWeb.utils.transaction.txPbToTxID(txPb);

      transaction.raw_data_hex = txRawDataHex;
      transaction.txID = txID.slice(2);
    }

    return this._extendTxExpiration({
      transaction,
      expiration: TRON_TX_EXPIRATION_TIME,
    });
  }

  async _createResourceRentalOrder(params: {
    tronResourceRentalInfo: ITronResourceRentalInfo;
  }) {
    const { tronResourceRentalInfo } = params;

    const createOrderParams = tronResourceRentalInfo.createOrderParams;

    if (
      createOrderParams &&
      tronResourceRentalInfo.payType === ETronResourceRentalPayType.Token &&
      !tronResourceRentalInfo.isSwapTrxEnabled
    ) {
      createOrderParams.extraTrxNum = 0;
    }

    const resp =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequestWithTrxRes<{
        transaction: Types.Transaction;
        orderId: string;
        success: boolean;
        error?: string;
      }>({
        networkId: this.networkId,
        body: {
          method: 'post',
          url: '/api/v1/order/create',
          data: {
            ...createOrderParams,
            sourceFlag: (
              await this.getNetwork()
            ).isTestnet
              ? TRON_SOURCE_FLAG_TESTNET
              : TRON_SOURCE_FLAG_MAINNET,
          },
          params: {},
        },
      });
    return resp;
  }

  async _uploadResourceRentalOrder(params: {
    orderId: string;
    signedTx: ISignedTxPro;
  }) {
    const { orderId, signedTx } = params;
    const resp =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequestWithTrxRes<{
        tx_ids: string[];
        success: boolean;
        error?: string;
      }>({
        networkId: this.networkId,
        body: {
          method: 'post',
          url: '/api/tronRent/uploadHash',
          data: {
            orderId,
            fromHash: signedTx.txid,
            signedData: JSON.parse(signedTx.rawTx),
            sourceFlag: (
              await this.getNetwork()
            ).isTestnet
              ? TRON_SOURCE_FLAG_TESTNET
              : TRON_SOURCE_FLAG_MAINNET,
          },
          params: {},
        },
      });
    return resp;
  }

  async _signRentalTx(params: { unsignedTx: IUnsignedTxPro }) {
    const { unsignedTx } = params;
    const { password, deviceParams } =
      await this.backgroundApi.servicePassword.promptPasswordVerifyByAccount({
        accountId: this.accountId,
        reason: EReasonForNeedPassword.CreateTransaction,
      });
    const tx =
      await this.backgroundApi.serviceHardwareUI.withHardwareProcessing(
        async () => {
          const signedTx = await this.signTransaction({
            unsignedTx,
            password,
            deviceParams,
            signOnly: true,
          });
          console.log('signTx@vault.signTransaction', signedTx);
          return signedTx;
        },
        { deviceParams, debugMethodName: 'serviceSend.signTransaction' },
      );
    return tx;
  }

  override async preActionsBeforeSending(params: {
    unsignedTxs: IUnsignedTxPro[];
    tronResourceRentalInfo?: ITronResourceRentalInfo;
    feeInfo?: IFeeInfoUnit;
  }) {
    const { tronResourceRentalInfo } = params;

    if (!tronResourceRentalInfo) {
      return;
    }

    const { isResourceRentalNeeded, isResourceRentalEnabled } =
      tronResourceRentalInfo;

    if (!isResourceRentalNeeded || !isResourceRentalEnabled) {
      return;
    }

    const rentalOrder = await this._createResourceRentalOrder({
      tronResourceRentalInfo,
    });

    const signedRentalTx = await this._signRentalTx({
      unsignedTx: {
        encodedTx: rentalOrder.transaction,
      },
    });

    const uploadResult = await this._uploadResourceRentalOrder({
      orderId: rentalOrder.orderId,
      signedTx: signedRentalTx,
    });

    return {
      preSendTx: {
        txid: uploadResult?.tx_ids?.[0] ?? '',
      },
    };
  }

  override async preActionsBeforeConfirm({
    unsignedTxs,
  }: {
    unsignedTxs: IUnsignedTxPro[];
  }) {
    // disable auto claim energy for watching account
    if (accountUtils.isWatchingAccount({ accountId: this.accountId })) {
      return;
    }

    const unsignedTx = unsignedTxs[0];
    const encodedTx = unsignedTx.encodedTx as IEncodedTxTron;

    const accountAddress = await this.getAccountAddress();

    // 1. Check if the transaction requires consuming additional energy
    if (encodedTx.raw_data.contract[0].type === 'TransferContract') {
      return;
    }

    const feeResp = await this.backgroundApi.serviceGas.estimateFee({
      networkId: this.networkId,
      accountId: this.accountId,
      accountAddress,
      encodedTx,
    });

    const feeInfo: IFeeInfoUnit = {
      common: feeResp.common,
      feeTron: feeResp.feeTron?.[1] ?? feeResp.feeTron?.[0],
    };

    if (!feeInfo.feeTron) {
      return;
    }

    const availableEnergy = new BigNumber(
      feeInfo.feeTron.accountInfo?.energyTotal ?? 0,
    ).minus(feeInfo.feeTron.accountInfo?.energyUsed ?? 0);

    if (availableEnergy.gt(feeInfo.feeTron.requiredEnergy)) {
      return;
    }

    const feeResult = calculateFeeForSend({
      feeInfo,
      nativeTokenPrice: feeResp.common.nativeTokenPrice ?? 0,
    });

    // 2. Check if the address has attempted to claim the subsidy within the last 24 hours
    const tronClaimResourceInfo =
      await this.backgroundApi.simpleDb.chainResource.getTronClaimResourceInfo({
        accountAddress,
      });

    if (
      tronClaimResourceInfo &&
      tronClaimResourceInfo.lastClaimTime &&
      Date.now() - tronClaimResourceInfo.lastClaimTime <
        timerUtils.getTimeDurationMs({ hour: 24 })
    ) {
      return;
    }

    // 3. If more than 24 hours have passed since the last attempt, try to claim the subsidy again
    const { timestamp, signed, claimSource } =
      chainResourceUtils.buildTronClaimResourceParams({
        accountAddress,
        isTestnet: (await this.getNetwork()).isTestnet,
      });

    try {
      const resp =
        await this.backgroundApi.serviceAccountProfile.sendProxyRequestWithTrxRes<{
          code: number;
          message: string;
          success: boolean;
          error?: string;
        }>({
          networkId: this.networkId,
          body: {
            method: 'post',
            url: '/api/tronRent/addFreeTronRentRecord',
            data: {
              fromAddress: accountAddress,
              sourceFlag: claimSource,
              timestamp,
              signed,
            },
            params: {},
          },
          returnRawData: true,
        });

      // 4. Update the local tron claim resource state
      await this.backgroundApi.simpleDb.chainResource.updateTronClaimResourceInfo(
        {
          accountAddress,
          lastClaimTime: timestamp,
        },
      );

      defaultLogger.reward.tronReward.claimResource({
        networkId: this.networkId,
        address: accountAddress,
        sourceFlag: claimSource ?? '',
        isSuccess: true,
        resourceType: 'energy',
        isAutoClaimed: true,
      });

      if (resp.code === 0) {
        await timerUtils.wait(1000);
      }

      // 5. Return the claim flag, which will be used for special status display at the transaction confirm page
      return {
        isTronResourceAutoClaimed: resp.code === 0,
        txOriginalFee: {
          totalNative: feeResult.totalNative,
          totalFiat: feeResult.totalFiat,
        },
      };
    } catch (error) {
      console.log(JSON.stringify(error));
      noop();
    }
  }
}
