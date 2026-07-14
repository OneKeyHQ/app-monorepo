import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import type { IKaspaUnspentOutputInfo } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa';
import {
  CONFIRMATION_COUNT,
  DEFAULT_FEE_RATE,
  DUST_AMOUNT,
  MAX_BLOCK_SIZE,
  MAX_ORPHAN_TX_MASS,
  MAX_UTXO_SIZE,
  isValidAddress,
  privateKeyFromWIF,
  selectUTXOs,
  toTransaction,
} from '@onekeyhq/core/src/chains/kaspa/sdkKaspa';
import { RestAPIClient as ClientKaspa } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/clientRestApi';
import sdk from '@onekeyhq/core/src/chains/kaspa/sdkKaspa/sdk';
import type { IEncodedTxKaspa } from '@onekeyhq/core/src/chains/kaspa/types';
import {
  decodeSensitiveTextAsync,
  encodeSensitiveTextAsync,
} from '@onekeyhq/core/src/secret';
import {
  EAddressEncodings,
  type ISignedTxPro,
  type IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
  OneKeyLocalError,
} from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import chainValueUtils from '@onekeyhq/shared/src/utils/chainValueUtils';
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
import type { IAfterSendTxActionParams } from '@onekeyhq/shared/types/signatureConfirm';
import type { IToken } from '@onekeyhq/shared/types/token';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';

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
  IBroadcastTransactionParams,
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

// Minimum spendable KAS advised to fund a KRC20 payload transfer, surfaced to
// the user via Toast when their balance is too low (instead of the generic
// "insufficient balance / no UTXO" errors that don't tell the user to top up KAS).
const KRC20_MIN_KAS_TO_SEND = '2';

export default class Vault extends VaultBase {
  override keyringMap: Record<IDBWalletType, typeof KeyringBase | undefined> = {
    hd: KeyringHd,
    qr: undefined,
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

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxKaspa> {
    const { transfersInfo, specifiedFeeRate } = params;

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

    let encodedTx: IEncodedTxKaspa;

    const isKRC20 = transferInfo.tokenInfo && !transferInfo.tokenInfo.isNative;

    const dbAccount = await this.getAccount();
    let confirmUtxos: IKaspaUnspentOutputInfo[];
    try {
      confirmUtxos = await this._collectUTXOsInfoByApi({
        address: dbAccount.address,
      });
    } catch (e) {
      // A KRC20 payload transfer must be funded with KAS. When the account has
      // no spendable KAS UTXOs, surface a clear "top up KAS" hint instead of the
      // generic "no available UTXO" error.
      if (isKRC20) {
        throw this._createInsufficientKasForKRC20Error(
          transferInfo.tokenInfo?.symbol,
        );
      }
      throw e;
    }

    // KRC20: single-tx transfer. Put the kasplex op JSON into the consensus
    // payload of a normal P2PK self-transfer (dust carrier back to self).
    // Built/signed via kaspa-wasm and returned early.
    if (isKRC20) {
      const transferData = this._createKRC20TransferData({
        tokenInfo: transferInfo.tokenInfo as IToken,
        amount: transferInfo.amount,
        to: transferInfo.to,
      });
      const network = await this.getNetwork();
      const dustKas = new BigNumber(DUST_AMOUNT)
        .shiftedBy(-network.decimals)
        .toFixed();
      const built = await this.prepareAndBuildTx({
        confirmUtxos,
        transferInfo: {
          ...transferInfo,
          to: dbAccount.address,
          amount: dustKas,
        },
        specifiedFeeRate,
      });
      const payloadEncodedTx: IEncodedTxKaspa = {
        ...built,
        changeAddress: dbAccount.address,
        payload: Buffer.from(JSON.stringify(transferData), 'utf8').toString(
          'hex',
        ),
      };
      return payloadEncodedTx;
    }

    encodedTx = await this.prepareAndBuildTx({
      confirmUtxos,
      transferInfo,
      specifiedFeeRate,
    });

    // validate tx size
    let txn = toTransaction(encodedTx);
    const { mass, txSize } = txn.getMassAndSize();
    if (encodedTx.feeInfo) {
      encodedTx.feeInfo.limit = mass.toString();
    }
    encodedTx.mass = mass;

    if (mass > MAX_ORPHAN_TX_MASS || txSize > MAX_BLOCK_SIZE) {
      encodedTx = await this.prepareAndBuildTx({
        confirmUtxos,
        transferInfo,
        priority: { satoshis: true },
        specifiedFeeRate,
      });
      txn = toTransaction(encodedTx);
      if (encodedTx.inputs.length > MAX_UTXO_SIZE) {
        const totalAmount = encodedTx.inputs
          .toSorted((a, b) =>
            new BigNumber(b.satoshis).minus(a.satoshis).toNumber(),
          )
          .slice(0, MAX_UTXO_SIZE)
          .reduce((acc, input) => acc.plus(input.satoshis), new BigNumber(0));
        const tokenInfo = transferInfo.tokenInfo ?? (await this.getNetwork());

        const totalAmountStr = totalAmount
          .shiftedBy(-tokenInfo.decimals)
          .toFixed(0, BigNumber.ROUND_DOWN);
        throw new OneKeyInternalError(
          appLocale.intl.formatMessage(
            {
              id: ETranslations.feedback_kaspa_utxo_limit_exceeded_text,
            },
            {
              amount: totalAmountStr,
              symbol: tokenInfo?.symbol ?? 'KAS',
            },
          ),
        );
      }
      const massAndSize = txn.getMassAndSize();
      if (encodedTx.feeInfo) {
        encodedTx.feeInfo.limit = massAndSize.mass.toString();
      }
      encodedTx.mass = massAndSize.mass;
    }

    return encodedTx;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx, transferPayload } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxKaspa;
    const { outputs, feeInfo } = encodedTx;
    const { swapInfo } = unsignedTx;
    const network = await this.getNetwork();
    const account = await this.getAccount();

    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      accountId: this.accountId,
      networkId: this.networkId,
      tokenIdOnNetwork: '',
    });

    const utxoTo = outputs.map((output) => ({
      address: output.address,
      balance: new BigNumber(output.value)
        .shiftedBy(-network.decimals)
        .toFixed(),
      balanceValue: output.value.toString(),
      symbol: network.symbol,
      isMine: false, // output.address === dbAccount.address,
    }));

    let sendNativeTokenAmountBN = new BigNumber(0);
    let sendNativeTokenAmountValueBN = new BigNumber(0);

    let action: IDecodedTxAction = {
      type: EDecodedTxActionType.UNKNOWN,
      unknownAction: {
        from: account.address,
        to: utxoTo[0].address,
      },
    };
    if (
      transferPayload &&
      transferPayload.tokenInfo &&
      transferPayload.amountToSend &&
      transferPayload.originalRecipient
    ) {
      const { tokenInfo } = transferPayload;
      if (tokenInfo) {
        action = await this.buildTxTransferAssetAction({
          from: account.address,
          to: transferPayload.originalRecipient,
          transfers: [
            {
              from: account.address,
              to: transferPayload.originalRecipient,
              amount: transferPayload.amountToSend,
              tokenIdOnNetwork: tokenInfo.address,
              icon: tokenInfo.logoURI ?? '',
              name: tokenInfo.name ?? '',
              symbol: tokenInfo.symbol,
            },
          ],
        });
      }
    } else if (swapInfo) {
      const swapSendToken = swapInfo.sender.token;
      const swapReceiveToken = swapInfo.receiver.token;
      const providerInfo = swapInfo.swapBuildResData.result.info;
      action = await this.buildTxTransferAssetAction({
        from: swapInfo.accountAddress,
        to: utxoTo[0].address,
        application: {
          name: providerInfo.providerName,
          icon: providerInfo.providerLogo ?? '',
        },
        transfers: [
          {
            from: swapInfo.accountAddress,
            to: '',
            tokenIdOnNetwork: swapSendToken.contractAddress,
            icon: swapSendToken.logoURI ?? '',
            name: swapSendToken.name ?? '',
            symbol: swapSendToken.symbol,
            amount: swapInfo.sender.amount,
            isNFT: false,
            isNative: swapSendToken.isNative,
            networkId: swapInfo.sender.accountInfo.networkId,
          },
          {
            from: '',
            to: swapInfo.receivingAddress,
            tokenIdOnNetwork: swapReceiveToken.contractAddress,
            icon: swapReceiveToken.logoURI ?? '',
            name: swapReceiveToken.name ?? '',
            symbol: swapReceiveToken.symbol,
            amount: swapInfo.receiver.amount,
            isNFT: false,
            isNative: swapReceiveToken.isNative,
            networkId: swapInfo.receiver.accountInfo.networkId,
          },
        ],
        isInternalSwap: true,
        swapReceivedAddress: swapInfo.receivingAddress,
        swapReceivedNetworkId: swapInfo.receiver.token.networkId,
      });
      if (swapSendToken.isNative) {
        sendNativeTokenAmountBN = new BigNumber(swapInfo.sender.amount);
        sendNativeTokenAmountValueBN = sendNativeTokenAmountBN.shiftedBy(
          swapSendToken.decimals,
        );
      }
    } else if (nativeToken) {
      sendNativeTokenAmountBN = new BigNumber(utxoTo[0].balance);
      sendNativeTokenAmountValueBN = sendNativeTokenAmountBN.shiftedBy(
        nativeToken.decimals,
      );
      const transfer = {
        from: account.address,
        to: utxoTo[0].address,
        amount: new BigNumber(utxoTo[0].balance).toFixed(),
        tokenIdOnNetwork: nativeToken.address,
        icon: nativeToken.logoURI ?? '',
        name: nativeToken.name,
        symbol: nativeToken.symbol,
        isNFT: false,
        isNative: true,
      };
      action = await this.buildTxTransferAssetAction({
        from: account.address,
        to: utxoTo[0].address,
        transfers: [transfer],
      });
    }

    // When dropChangeToFee folds a sub-dust change into the fee, the tx carries
    // no change output, so the real on-chain fee is the full input/output
    // surplus (sum(inputs) - sum(outputs)). The compute-mass relay fee that
    // feeInfo.limit × price reflects would under-report it by up to DUST_AMOUNT,
    // showing a misleadingly small fee on the confirmation screen.
    let totalFeeInNative: string;
    if (encodedTx.dropChangeToFee) {
      const sumInputs = encodedTx.inputs.reduce(
        (acc, input) => acc.plus(input.satoshis),
        new BigNumber(0),
      );
      const sumOutputs = encodedTx.outputs.reduce(
        (acc, output) => acc.plus(output.value),
        new BigNumber(0),
      );
      totalFeeInNative = sumInputs
        .minus(sumOutputs)
        .shiftedBy(-network.decimals)
        .toFixed();
    } else {
      totalFeeInNative = new BigNumber(encodedTx.feeInfo?.limit ?? '0')
        .multipliedBy(feeInfo?.price ?? '0.00000001')
        .toFixed();
    }

    return {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: 0,
      actions: [action],
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      encodedTx,
      totalFeeInNative,
      nativeAmount: sendNativeTokenAmountBN.toFixed(),
      nativeAmountValue: sendNativeTokenAmountValueBN.toFixed(),
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo,
      };
    }
    throw new NotImplemented();
  }

  override async updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const { feeInfo, unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxKaspa;
    const { gasLimit, gasPrice } = feeInfo?.gas ?? {};
    if (typeof gasLimit !== 'string' || typeof gasPrice !== 'string') {
      throw new OneKeyLocalError('gasLimit or gasPrice is not a string.');
    }

    try {
      const bigNumberGasLimit = new BigNumber(gasLimit);
      const bigNumberGasPrice = new BigNumber(gasPrice);

      if (bigNumberGasLimit.isNaN() || bigNumberGasPrice.isNaN()) {
        throw new OneKeyLocalError('Fee is not a valid number.');
      }
    } catch (error) {
      throw new OneKeyLocalError(
        `Invalid fee value: ${(error as Error).message}`,
      );
    }
    const mass = new BigNumber(gasLimit).toNumber();
    const newFeeInfo = { price: gasPrice, limit: mass.toString() };

    if (feeInfo) {
      const network = await this.getNetwork();

      const specifiedFeeRate = new BigNumber(gasPrice)
        .shiftedBy(network.feeMeta.decimals)
        .toFixed();

      const newEncodedTx = await this.buildEncodedTx({
        transfersInfo: unsignedTx.transfersInfo,
        specifiedFeeRate,
      });

      return {
        ...params.unsignedTx,
        encodedTx: {
          ...newEncodedTx,
          mass,
        },
      };
    }
    return {
      ...params.unsignedTx,
      encodedTx: {
        ...encodedTx,
        feeInfo: newFeeInfo,
        mass,
      },
    };
  }

  override async validateAddress(address: string): Promise<IAddressValidation> {
    const chainId = await this.getNetworkChainId();
    const isValid = isValidAddress(address, chainId);
    return {
      isValid,
      normalizedAddress: address,
      displayAddress: address,
    };
  }

  override validateXpub(): Promise<IXpubValidation> {
    throw new NotImplemented();
  }

  override async getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = await decodeSensitiveTextAsync({
      encodedText: params.input,
    });
    if (this.isHexPrivateKey(input)) {
      let privateKey = input.startsWith('0x') ? input.slice(2) : input;
      privateKey = await encodeSensitiveTextAsync({ text: privateKey });
      return Promise.resolve({
        privateKey,
      });
    }

    if (this.isWIFPrivateKey(input)) {
      const privateKeyBuffer = privateKeyFromWIF(input);
      const wifPrivateKey = await encodeSensitiveTextAsync({
        text: privateKeyBuffer.toString(),
      });
      return Promise.resolve({
        privateKey: wifPrivateKey,
      });
    }

    throw new OneKeyLocalError('Invalid private key');
  }

  override validateXprvt(): Promise<IXprvtValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    const settings = await this.getVaultSettings();
    const isValid =
      settings.importedAccountEnabled &&
      (this.isHexPrivateKey(privateKey) || this.isWIFPrivateKey(privateKey));
    return {
      isValid,
    };
  }

  // ------------------- Utils -----------------------------------------

  override async getAddressEncoding(): Promise<EAddressEncodings | undefined> {
    const account = await this.getAccount();
    return account.id.endsWith(EAddressEncodings.KASPA_ORG)
      ? EAddressEncodings.KASPA_ORG
      : undefined;
  }

  isHexPrivateKey(input: string) {
    return /^(0x)?[0-9a-zA-Z]{64}$/.test(input);
  }

  isWIFPrivateKey(input: string) {
    return /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(input);
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    const settings = await this.getVaultSettings();
    result.deriveInfoItems = Object.values(settings.accountDeriveInfo);
    return result;
  }

  _collectUTXOsInfoByApi = memoizee(
    async (_params: {
      address: string;
    }): Promise<IKaspaUnspentOutputInfo[]> => {
      try {
        const { utxoList: utxos } =
          await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
            networkId: this.networkId,
            accountId: this.accountId,
            withUTXOList: true,
          });
        if (!utxos || isEmpty(utxos)) {
          throw new OneKeyInternalError(
            appLocale.intl.formatMessage({
              id: ETranslations.feedback_failed_to_get_utxos,
            }),
          );
        }

        const [networkInfo] =
          await this.backgroundApi.serviceAccountProfile.sendProxyRequest<{
            networkName: string;
            blockCount: string;
            headerCount: string;
            virtualDaaScore: string;
          }>({
            networkId: this.networkId,
            body: [
              {
                route: 'rpc',
                params: {
                  method: 'GET',
                  params: [],
                  url: '/info/network',
                },
              },
            ],
          });
        const blueScore = new BigNumber(networkInfo.virtualDaaScore);
        const confirmedUtxos = utxos.filter((utxo) =>
          blueScore
            .minus(utxo.confirmations)
            .isGreaterThanOrEqualTo(CONFIRMATION_COUNT),
        );

        return confirmedUtxos.map((utxo) => ({
          ...utxo,
          scriptPubKey: utxo.scriptPublicKey?.scriptPublicKey ?? '',
          scriptPublicKeyVersion: utxo.scriptPublicKey?.version ?? 0,
          satoshis: utxo.value,
          blockDaaScore: new BigNumber(utxo.confirmations).toNumber(),
        }));
      } catch (_e) {
        throw new OneKeyInternalError(
          appLocale.intl.formatMessage({
            id: ETranslations.feedback_failed_to_get_utxos,
          }),
        );
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
    },
  );

  _coinSelect({
    confirmUtxos,
    amountValue,
    priority,
    feeRate,
  }: {
    confirmUtxos: IKaspaUnspentOutputInfo[];
    amountValue: string;
    priority?: { satoshis: boolean };
    feeRate: string;
  }) {
    let { utxoIds, utxos, mass } = selectUTXOs(
      confirmUtxos,
      new BigNumber(amountValue),
      priority,
    );

    const limit = new BigNumber(mass).toFixed();

    let hasMaxSend = false;
    if (utxos.length === confirmUtxos.length) {
      hasMaxSend = utxos
        .reduce((v, { satoshis }) => v.plus(satoshis), new BigNumber('0'))
        .lte(amountValue);
    }

    if (
      !hasMaxSend &&
      utxos
        .reduce((v, { satoshis }) => v.plus(satoshis), new BigNumber('0'))
        .lte(new BigNumber(amountValue).plus(DUST_AMOUNT))
    ) {
      const fee = new BigNumber(mass).multipliedBy(feeRate).toFixed();
      const newSelectUtxo = selectUTXOs(
        confirmUtxos,
        new BigNumber(amountValue).plus(fee).plus(DUST_AMOUNT),
      );
      utxoIds = newSelectUtxo.utxoIds;
      utxos = newSelectUtxo.utxos;
      mass = newSelectUtxo.mass;
    }

    return {
      utxoIds,
      utxos,
      mass,
      limit,
      hasMaxSend,
    };
  }

  async prepareAndBuildTx({
    confirmUtxos,
    transferInfo,
    priority,
    specifiedFeeRate,
  }: {
    confirmUtxos: IKaspaUnspentOutputInfo[];
    transferInfo: ITransferInfo;
    priority?: { satoshis: boolean };
    specifiedFeeRate?: string;
  }) {
    const network = await this.getNetwork();
    const { to, amount } = transferInfo;
    const amountValue = new BigNumber(amount)
      .shiftedBy(network.decimals)
      .toFixed();

    if (new BigNumber(amountValue).isLessThan(DUST_AMOUNT)) {
      throw new OneKeyInternalError('Amount is too small');
    }
    const feeRate = specifiedFeeRate ?? DEFAULT_FEE_RATE.toString();

    const { utxoIds, utxos, limit, hasMaxSend } = this._coinSelect({
      confirmUtxos,
      amountValue,
      priority,
      feeRate,
    });

    return {
      utxoIds,
      inputs: utxos,
      outputs: [
        {
          address: to,
          value: amountValue,
        },
      ],
      feeInfo: {
        price: feeRate,
        limit,
      },
      hasMaxSend,
      mass: new BigNumber(limit).toNumber(),
    };
  }

  override async getCustomRpcEndpointStatus(
    params: IMeasureRpcStatusParams,
  ): Promise<IMeasureRpcStatusResult> {
    const client = new ClientKaspa(params.rpcUrl);
    const start = performance.now();
    const { virtualDaaScore: blockNumber } = await client.getNetworkInfo();
    const bestBlockNumber = parseInt(blockNumber, 10);
    return {
      responseTime: Math.floor(performance.now() - start),
      bestBlockNumber,
    };
  }

  override async broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    const encodedTx = params.signedTx.encodedTx as IEncodedTxKaspa;

    // The single-tx KRC20 payload path signs (wasm software / streaming hardware)
    // and returns a safe-JSON rawTx carrying the kasplex op JSON in the consensus
    // payload. The REST submit endpoints (OneKey proxy AND api.kaspa.org) have no
    // `payload` field in their submit schema, so they strip it and the node
    // validates a no-payload tx — rejecting our with-payload signature. Submit
    // via wRPC instead, which carries the full Transaction object (payload
    // included) so the node verifies exactly what we signed.
    if (encodedTx?.payload) {
      const network = await this.getNetwork();
      const api = await sdk.getKaspaApi();
      const txid = await api.submitPayloadTransactionViaRpc({
        rawTx: params.signedTx.rawTx,
        isTestnet: network.isTestnet,
      });
      return {
        ...params.signedTx,
        txid,
      };
    }

    return super.broadcastTransaction(params);
  }

  override async broadcastTransactionFromCustomRpc(
    params: IBroadcastTransactionByCustomRpcParams,
  ): Promise<ISignedTxPro> {
    const { customRpcInfo, signedTx } = params;

    // Custom RPC is a REST (api.kaspa.org-style) endpoint, whose /transactions
    // submit schema drops the consensus payload. A KRC20 single-tx payload
    // transfer therefore can't go through a custom RPC node — surface it clearly
    // instead of silently sending a payload-less tx the node would reject.
    // (The default path broadcasts payload txs over wRPC JSON, which keeps it.)
    const encodedTx = signedTx.encodedTx as IEncodedTxKaspa;
    if (encodedTx?.payload) {
      throw new OneKeyLocalError(
        'The current custom RPC node does not support KRC20 payload transactions. Please turn off custom RPC to send this transfer.',
      );
    }

    const rpcUrl = customRpcInfo.rpc;
    if (!rpcUrl) {
      throw new OneKeyInternalError('Invalid rpc url');
    }
    const client = new ClientKaspa(rpcUrl);
    const txId = await client.sendRawTransaction(signedTx.rawTx);
    console.log('broadcastTransaction END:', {
      txid: txId,
      rawTx: signedTx.rawTx,
    });
    return {
      ...params.signedTx,
      txid: txId,
    };
  }

  // The base afterSendTxAction throws NotImplemented; kaspa must override it.
  // The single-tx payload KRC20 transfer has no follow-up tx (no commit/reveal),
  // so this is a no-op.
  override async afterSendTxAction(_params: IAfterSendTxActionParams) {
    // no-op
  }

  // -------------------KRC20-----------------------------------------

  _createInsufficientKasForKRC20Error(tokenSymbol?: string) {
    return new OneKeyLocalError(
      appLocale.intl.formatMessage(
        {
          id: ETranslations.send_insufficient_native_token_for_token_send__msg,
        },
        {
          symbol: 'KAS',
          amount: KRC20_MIN_KAS_TO_SEND,
          token: tokenSymbol || 'KRC20',
        },
      ),
    );
  }

  _createKRC20TransferData({
    tokenInfo,
    amount,
    to,
  }: {
    tokenInfo: IToken;
    amount: string;
    to: string;
  }) {
    return {
      'p': 'krc-20',
      'op': 'transfer',
      'tick': tokenInfo.address,
      'amt': chainValueUtils.convertTokenAmountToChainValue({
        value: amount,
        token: tokenInfo,
      }),
      'to': to,
    };
  }
}
