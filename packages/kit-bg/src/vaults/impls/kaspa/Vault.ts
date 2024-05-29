import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import type { UnspentOutputInfo } from '@onekeyhq/core/src/chains/kaspa/sdkKaspa';
import {
  CONFIRMATION_COUNT,
  DUST_AMOUNT,
  MAX_BLOCK_SIZE,
  MAX_ORPHAN_TX_MASS,
  isValidAddress,
  privateKeyFromWIF,
  selectUTXOs,
  toTransaction,
} from '@onekeyhq/core/src/chains/kaspa/sdkKaspa';
import type { IEncodedTxKaspa } from '@onekeyhq/core/src/chains/kaspa/types';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type { IUnsignedTxPro } from '@onekeyhq/core/src/types';
import {
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
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
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import { EDecodedTxStatus, type IDecodedTx } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringExternal } from './KeyringExternal';
import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringQr } from './KeyringQr';
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
  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    qr: KeyringQr,
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
    const dbAccount = await this.getAccount();
    const confirmUtxos = await this._collectUTXOsInfoByApi({
      address: dbAccount.address,
    });

    let encodedTx = await this.prepareAndBuildTx({
      confirmUtxos,
      transferInfo,
    });

    // validate tx size
    let txn = toTransaction(encodedTx);
    const { mass, txSize } = txn.getMassAndSize();

    if (mass > MAX_ORPHAN_TX_MASS || txSize > MAX_BLOCK_SIZE) {
      encodedTx = await this.prepareAndBuildTx({
        confirmUtxos,
        transferInfo,
        priority: { satoshis: true },
      });
      txn = toTransaction(encodedTx);
      const massAndSize = txn.getMassAndSize();
      if (
        massAndSize.mass > MAX_ORPHAN_TX_MASS ||
        massAndSize.txSize > MAX_BLOCK_SIZE
      ) {
        throw new OneKeyInternalError('Transaction size is too large');
      }
    }
    return encodedTx;
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxKaspa;
    const { outputs, feeInfo } = encodedTx;
    const network = await this.getNetwork();
    const account = await this.getAccount();

    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      networkId: this.networkId,
      tokenIdOnNetwork: '',
      accountAddress: account.address,
    });

    if (!nativeToken) {
      throw new OneKeyInternalError('Native token not found');
    }

    const sends = [];
    for (const output of outputs) {
      sends.push({
        from: account.address,
        to: output.address,
        isNative: true,
        tokenIdOnNetwork: '',
        name: nativeToken.name,
        icon: nativeToken.logoURI ?? '',
        amount: new BigNumber(output.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        amountValue: output.value,
        symbol: network.symbol,
      });
    }

    // const utxoFrom = inputs.map((input) => ({
    //   address: input.address.toString(),
    //   balance: new BigNumber(input.satoshis.toString())
    //     .shiftedBy(-network.decimals)
    //     .toFixed(),
    //   balanceValue: input.satoshis?.toString() ?? '0',
    //   symbol: network.symbol,
    //   isMine: true,
    // }));

    const utxoTo = outputs.map((output) => ({
      address: output.address,
      balance: new BigNumber(output.value)
        .shiftedBy(-network.decimals)
        .toFixed(),
      balanceValue: output.value.toString(),
      symbol: network.symbol,
      isMine: false, // output.address === dbAccount.address,
    }));

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
    const action = await this.buildTxTransferAssetAction({
      from: account.address,
      to: utxoTo[0].address,
      transfers: [transfer],
    });
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
      payload: {
        type: EOnChainHistoryTxType.Send,
      },
      encodedTx,
      totalFeeInNative: new BigNumber(encodedTx.feeInfo?.limit ?? '0')
        .multipliedBy(feeInfo?.price ?? '0.00000001')
        .toFixed(),
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
      throw new Error('gasLimit or gasPrice is not a string.');
    }

    try {
      const bigNumberGasLimit = new BigNumber(gasLimit);
      const bigNumberGasPrice = new BigNumber(gasPrice);

      if (bigNumberGasLimit.isNaN() || bigNumberGasPrice.isNaN()) {
        throw new Error('Fee is not a valid number.');
      }
    } catch (error) {
      throw new Error(`Invalid fee value: ${(error as Error).message}`);
    }
    const mass = new BigNumber(gasLimit).toNumber();
    const newFeeInfo = { price: gasPrice, limit: mass.toString() };
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

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    if (this.isHexPrivateKey(input)) {
      let privateKey = input.startsWith('0x') ? input.slice(2) : input;
      privateKey = encodeSensitiveText({ text: privateKey });
      return Promise.resolve({
        privateKey,
      });
    }

    if (this.isWIFPrivateKey(input)) {
      const privateKeyBuffer = privateKeyFromWIF(input);
      const wifPrivateKey = encodeSensitiveText({
        text: privateKeyBuffer.toString(),
      });
      return Promise.resolve({
        privateKey: wifPrivateKey,
      });
    }

    throw new Error('Invalid private key');
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
    return result;
  }

  _collectUTXOsInfoByApi = memoizee(
    async (params: { address: string }): Promise<UnspentOutputInfo[]> => {
      const { address } = params;
      try {
        const { utxoList: utxos } =
          await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
            networkId: this.networkId,
            accountAddress: address,
            withUTXOList: true,
          });
        if (!utxos || isEmpty(utxos)) {
          throw new OneKeyInternalError('Failed to get UTXO list.');
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
                  // @ts-expect-error
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
          satoshis: new BigNumber(utxo.value).toNumber(),
          blockDaaScore: new BigNumber(utxo.confirmations).toNumber(),
        }));
      } catch (e) {
        throw new OneKeyInternalError('Failed to get UTXO list.');
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
  }: {
    confirmUtxos: UnspentOutputInfo[];
    amountValue: string;
    priority?: { satoshis: boolean };
  }) {
    let { utxoIds, utxos, mass } = selectUTXOs(
      confirmUtxos,
      new BigNumber(amountValue).toNumber(),
      priority,
    );

    const limit = new BigNumber(mass).toString();

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
      const newSelectUtxo = selectUTXOs(
        confirmUtxos,
        new BigNumber(amountValue).plus(mass).plus(DUST_AMOUNT).toNumber(),
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
  }: {
    confirmUtxos: UnspentOutputInfo[];
    transferInfo: ITransferInfo;
    priority?: { satoshis: boolean };
  }) {
    const network = await this.getNetwork();
    const { to, amount } = transferInfo;
    const amountValue = new BigNumber(amount)
      .shiftedBy(network.decimals)
      .toFixed();

    if (new BigNumber(amountValue).isLessThan(DUST_AMOUNT)) {
      throw new OneKeyInternalError('Amount is too small');
    }

    const { utxoIds, utxos, limit, hasMaxSend } = this._coinSelect({
      confirmUtxos,
      amountValue,
      priority,
    });
    const feeRate = chainValueUtils.convertChainValueToGwei({
      network,
      value: '1',
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
}
