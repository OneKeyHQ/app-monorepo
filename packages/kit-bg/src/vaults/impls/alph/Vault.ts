/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  AddressType,
  DUST_AMOUNT,
  NodeProvider,
  addressFromTokenId,
  bs58,
  contractIdFromAddress,
  isValidAddress,
} from '@alephium/web3';
import BigNumber from 'bignumber.js';

import {
  EAlphTxType,
  type IEncodedTxAlph,
} from '@onekeyhq/core/src/chains/alph/types';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import {
  MinimumTransferAmountError,
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
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
import type { IEstimateFeeParams } from '@onekeyhq/shared/types/fee';
import type { IToken } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxDirection,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type {
  IDecodedTx,
  IDecodedTxTransferInfo,
} from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import { MAX_GAS_AMOUNT, serializeUnsignedTransaction } from './sdkAlph/utils';

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
  IUpdateUnsignedTxParams,
  IValidateGeneralInputParams,
} from '../../types';
import type { SignTransferTxParams } from '@alephium/web3';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined, // KeyringQr,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringExternal,
  };

  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    const { address } = account;

    return {
      networkId,
      normalizedAddress: address,
      displayAddress: address,
      address,
      baseAddress: address,
      isValid: true,
      allowEmptyAddress: false,
    };
  }

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTx> {
    const { transfersInfo } = params;
    if (!transfersInfo) {
      throw new OneKeyInternalError('Invalid transfersInfo');
    }
    const signerAddress = await this.getAccountAddress();
    const transfer = transfersInfo[0];
    const amount = chainValueUtils.convertTokenAmountToChainValue({
      value: transfer.amount,
      token: transfer.tokenInfo as IToken,
      decimalPlaces: 0,
      roundingMode: BigNumber.ROUND_DOWN,
    });
    const encodedTxParams: SignTransferTxParams = {
      signerAddress,
      signerKeyType: 'default',
      destinations: [
        {
          address: transfer.to,
          attoAlphAmount: amount,
        },
      ],
    };

    if (!transfer.tokenInfo?.isNative) {
      if (amount === '0') {
        throw new MinimumTransferAmountError({
          info: {
            amount: chainValueUtils.convertTokenChainValueToAmount({
              value: '1',
              token: transfer.tokenInfo as IToken,
            }),
          },
        });
      }
      encodedTxParams.destinations[0].attoAlphAmount = DUST_AMOUNT.toString();
      const id = bufferUtils.bytesToHex(
        contractIdFromAddress(transfer.tokenInfo?.address as string),
      );
      encodedTxParams.destinations[0].tokens = [
        {
          id,
          amount,
        },
      ];
    } else if (new BigNumber(amount).isLessThan(DUST_AMOUNT.toString())) {
      throw new MinimumTransferAmountError({
        info: {
          amount: chainValueUtils.convertTokenChainValueToAmount({
            value: DUST_AMOUNT.toString(),
            token: transfer.tokenInfo,
          }),
        },
      });
    }

    return {
      type: EAlphTxType.Transfer,
      params: encodedTxParams,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxAlph;
    const from = encodedTx.params.signerAddress;
    const actions: IDecodedTx['actions'] = [];
    const network = await this.getNetwork();
    if (encodedTx.type === EAlphTxType.Transfer) {
      const destinations = (encodedTx.params as SignTransferTxParams)
        .destinations;
      const nativeToken = await this.backgroundApi.serviceToken.getNativeToken({
        networkId: network.id,
        accountId: this.accountId,
      });
      const transfers: IDecodedTxTransferInfo[] = [];
      await Promise.all(
        destinations.map(async (dest) => {
          if (new BigNumber(dest.attoAlphAmount.toString()).isGreaterThan(0)) {
            transfers.push({
              from,
              to: dest.address,
              amount: chainValueUtils.convertChainValueToAmount({
                value: dest.attoAlphAmount.toString(),
                network,
              }),
              icon: nativeToken?.logoURI ?? '',
              symbol: nativeToken?.symbol ?? '',
              name: nativeToken?.name ?? '',
              tokenIdOnNetwork: nativeToken?.address ?? '',
              isNative: true,
            });
          }
          if (dest.tokens) {
            await Promise.all(
              dest.tokens.map(async (tokenData) => {
                const tokenIdOnNetwork = bufferUtils.bytesToHex(
                  addressFromTokenId(tokenData.id),
                );
                const tokenInfo =
                  await this.backgroundApi.serviceToken.getToken({
                    networkId: network.id,
                    accountId: this.accountId,
                    tokenIdOnNetwork,
                  });
                if (tokenInfo) {
                  transfers.push({
                    from,
                    to: dest.address,
                    amount: chainValueUtils.convertTokenChainValueToAmount({
                      value: tokenData.amount.toString(),
                      token: tokenInfo,
                    }),
                    icon: tokenInfo.logoURI ?? '',
                    symbol: tokenInfo.symbol ?? '',
                    name: tokenInfo.name ?? '',
                    tokenIdOnNetwork: tokenInfo.address ?? '',
                    isNative: false,
                  });
                }
              }),
            );
          }
        }),
      );
      const action = await this.buildTxTransferAssetAction({
        from,
        to: destinations[0].address,
        transfers,
      });
      const hasNativeAsset = action.assetTransfer?.sends.some(
        (send) => send.isNative,
      );
      if (!hasNativeAsset) {
        action.assetTransfer?.sends.forEach((send) => {
          if (!send.isNative) {
            action.assetTransfer?.sends.push({
              ...send,
              amount: '0.001',
              icon: nativeToken?.logoURI ?? '',
              name: nativeToken?.name ?? '',
              symbol: nativeToken?.symbol ?? '',
              tokenIdOnNetwork: nativeToken?.address ?? '',
              isNative: true,
            });
          }
        });
      }
      actions.push(action);
    } else {
      actions.push({
        type: EDecodedTxActionType.UNKNOWN,
        direction: EDecodedTxDirection.OTHER,
        unknownAction: {
          from,
          to: '',
        },
      });
    }
    return {
      txid: '',
      owner: from,
      signer: from,
      nonce: 0,
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      feeInfo: {
        common: {
          feeDecimals: network.decimals,
          feeSymbol: network.symbol,
          nativeDecimals: network.decimals,
          nativeSymbol: network.symbol,
        },
        gas: {
          gasPrice: encodedTx.params.gasPrice?.toString() ?? '0',
          gasLimit: encodedTx.params.gasAmount?.toString() ?? '0',
        },
      },
      extraInfo: null,
      encodedTx,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.encodedTx ?? (await this.buildEncodedTx(params));
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo ?? [],
      };
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = params.unsignedTx.encodedTx as IEncodedTxAlph;
    if (params.feeInfo) {
      if (params.feeInfo.gas?.gasPrice) {
        encodedTx.params.gasPrice = chainValueUtils.convertAmountToChainValue({
          value: params.feeInfo.gas?.gasPrice,
          network: await this.getNetwork(),
        });
      }
      if (params.feeInfo.gas?.gasLimit) {
        encodedTx.params.gasAmount = Number(params.feeInfo.gas?.gasLimit);
      }
    }

    // max amount
    if (params.nativeAmountInfo && params.nativeAmountInfo.maxSendAmount) {
      const txParams = encodedTx.params as SignTransferTxParams;
      if (txParams.destinations[0].attoAlphAmount.toString() !== '0') {
        const network = await this.getNetwork();
        txParams.destinations[0].attoAlphAmount = new BigNumber(
          chainValueUtils.convertAmountToChainValue({
            value: params.nativeAmountInfo.maxSendAmount,
            network,
          }),
        )
          .minus(DUST_AMOUNT.toString())
          .toFixed();
      } else {
        if (!txParams.destinations[0].tokens) {
          throw new OneKeyInternalError('No tokens found');
        }
        const token = await this.backgroundApi.serviceToken.getToken({
          networkId: this.networkId,
          accountId: this.accountId,
          tokenIdOnNetwork: txParams.destinations[0].tokens[0].id,
        });
        txParams.destinations[0].tokens[0].amount = new BigNumber(
          params.nativeAmountInfo.maxSendAmount,
        )
          .shiftedBy(token?.decimals ?? 0)
          .toFixed(0, BigNumber.ROUND_FLOOR);
      }
    }

    return {
      ...params.unsignedTx,
      encodedTx,
    };
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    const isValid = isValidAddress(address);
    let encoding: EAddressEncodings | undefined;

    if (isValid) {
      const decoded = bs58.decode(address);
      const addressType = decoded[0];

      if (addressType === AddressType.P2PKH) {
        encoding = EAddressEncodings.ALPH_P2PKH;
      } else if (addressType === AddressType.P2SH) {
        encoding = EAddressEncodings.ALPH_P2SH;
      } else if (addressType === AddressType.P2MPKH) {
        encoding = EAddressEncodings.ALPH_P2MPKH;
      } else if (addressType === AddressType.P2C) {
        encoding = EAddressEncodings.ALPH_P2C;
      }

      return Promise.resolve({
        isValid,
        normalizedAddress: address,
        displayAddress: address,
        encoding,
      });
    }

    return Promise.resolve({
      isValid: false,
      normalizedAddress: '',
      displayAddress: '',
    });
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

  override async buildEstimateFeeParams({
    encodedTx,
  }: {
    encodedTx: IEncodedTxAlph | undefined;
  }): Promise<{
    encodedTx: IEncodedTx | undefined;
    estimateFeeParams?: IEstimateFeeParams;
  }> {
    const account = await this.getAccount();
    if (encodedTx?.type === EAlphTxType.Transfer) {
      const balance =
        await this.backgroundApi.serviceAccountProfile.fetchAccountNativeBalance(
          {
            account,
            networkId: this.networkId,
          },
        );
      const params = encodedTx.params as SignTransferTxParams;
      if (balance.balance === params.destinations[0].attoAlphAmount) {
        const amount = new BigNumber(params.destinations[0].attoAlphAmount)
          .minus(MAX_GAS_AMOUNT)
          .minus(DUST_AMOUNT.toString());
        params.destinations[0].attoAlphAmount = amount.gt(0)
          ? amount.toFixed(0)
          : '0';
      }
    }

    const type = {
      [EAlphTxType.Transfer]: 'buildTransferTx',
      [EAlphTxType.DeployContract]: 'buildDeployContractTx',
      [EAlphTxType.ExecuteScript]: 'buildExecuteScriptTx',
      [EAlphTxType.UnsignedTx]: 'buildUnsignedTx',
    }[encodedTx?.type as EAlphTxType];

    return {
      encodedTx: {
        ...encodedTx?.params,
        type,
        networkId: 'mainnet',
        fromPublicKey: account.pub,
        fromPublicKeyType: 'default',
      } as unknown as IEncodedTxAlph,
    };
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const start = performance.now();
    const nodeProvider = new NodeProvider(params.rpcUrl);
    const chainInfo = await nodeProvider.blockflow.getBlockflowChainInfo({
      fromGroup: 0,
      toGroup: 0,
    });
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber: chainInfo.currentHeight,
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
    const nodeProvider = new NodeProvider(rpcUrl);
    const { txId } = await nodeProvider.transactions.postTransactionsSubmit(
      JSON.parse(signedTx.rawTx),
    );
    console.log('broadcastTransaction END:', {
      txid: txId,
      rawTx: signedTx.rawTx,
    });

    return {
      ...params.signedTx,
      txid: txId,
    };
  }
}
