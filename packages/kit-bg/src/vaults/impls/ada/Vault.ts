/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unused-vars */
import BigNumber from 'bignumber.js';
import { isEmpty } from 'lodash';

import {
  decodePrivateKeyByXprv,
  validBootstrapAddress,
  validShelleyAddress,
} from '@onekeyhq/core/src/chains/ada/sdkAda';
import type {
  IAdaAccount,
  IAdaAmount,
  IAdaEncodeOutput,
  IAdaUTXO,
  IEncodedTxAda,
} from '@onekeyhq/core/src/chains/ada/types';
import {
  decodeSensitiveText,
  encodeSensitiveText,
} from '@onekeyhq/core/src/secret';
import type {
  IEncodedTx,
  ISignedTxPro,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import {
  InsufficientBalance,
  InvalidAddress,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
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
import { KeyringQr } from './KeyringQr';
import { KeyringWatching } from './KeyringWatching';
import sdk from './sdkAda';
import { getChangeAddress } from './sdkAda/adaUtils';
import settings from './settings';

import type { IDBUtxoAccount, IDBWalletType } from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
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
  IVaultSettings,
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

  override async buildAccountAddressDetail(
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
  ): Promise<IEncodedTxAda> {
    const { transfersInfo } = params;
    if (!transfersInfo || isEmpty(transfersInfo)) {
      throw new OneKeyInternalError('transfersInfo is required');
    }
    if (transfersInfo.length > 1) {
      throw new OneKeyInternalError('Only one transfer is allowed');
    }
    const transferInfo = transfersInfo[0];
    if (!transferInfo.to) {
      throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
    }
    const { to, amount, tokenInfo } = transferInfo;
    const dbAccount = (await this.getAccount()) as IDBUtxoAccount;
    const { path, addresses, xpub } = dbAccount;
    const network = await this.getNetwork();
    const { decimals, feeMeta } = network;
    const utxos = await this._collectUTXOsInfoByApi({
      address: dbAccount.address,
      path,
      addresses,
      xpub,
    });
    const amountBN = new BigNumber(amount);

    let output;
    if (tokenInfo?.address) {
      output = {
        address: to,
        amount: undefined,
        assets: [
          {
            quantity: amountBN.shiftedBy(tokenInfo?.decimals).toFixed(),
            unit: tokenInfo?.address,
          },
        ],
      };
    } else {
      output = {
        address: to,
        amount: amountBN.shiftedBy(decimals).toFixed(),
        assets: [],
      };
    }

    const CardanoApi = await sdk.getCardanoApi();
    let txPlan: Awaited<ReturnType<typeof CardanoApi.composeTxPlan>>;
    try {
      txPlan = await CardanoApi.composeTxPlan(
        transferInfo,
        dbAccount.xpub,
        utxos,
        dbAccount.address,
        [output as any],
      );
    } catch (e: any) {
      const utxoValueTooSmall = 'UTXO_VALUE_TOO_SMALL';
      const insufficientBalance = 'UTXO_BALANCE_INSUFFICIENT';
      if (
        [utxoValueTooSmall, insufficientBalance].includes(e.code) ||
        [utxoValueTooSmall, insufficientBalance].includes(e.message)
      ) {
        throw new InsufficientBalance();
      }
      throw e;
    }

    const changeAddress = getChangeAddress(dbAccount);

    // @ts-expect-error
    const { fee, inputs, outputs, totalSpent, tx } = txPlan;
    const totalFeeInNative = new BigNumber(fee)
      .shiftedBy(-1 * feeMeta.decimals)
      .toFixed();

    return {
      inputs,
      outputs,
      fee,
      totalSpent,
      totalFeeInNative,
      tx,
      changeAddress,
      signOnly: false,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxAda;
    const { inputs, outputs } = encodedTx;
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

    let actions: IDecodedTxAction[] = [];

    const nativeAmountMap = this._getOutputAmount(outputs, network.decimals);
    const utxoFrom = inputs.map((input) => {
      const { balance, balanceValue } = this._getInputOrOutputBalance(
        input.amount,
        network.decimals,
      );
      return {
        address: input.address,
        balance,
        balanceValue,
        symbol: network.symbol,
        isMine: true,
      };
    });
    const utxoTo = outputs
      .filter((output) => !output.isChange)
      .map((output) => ({
        address: output.address,
        balance: new BigNumber(output.amount)
          .shiftedBy(network.decimals)
          .toFixed(),
        balanceValue: output.amount,
        symbol: network.symbol,
        isMine: output.address === account.address,
      }));

    const sends = [];
    for (const output of outputs.filter((o) => !o.isChange)) {
      for (const asset of output.assets) {
        const token = await this.backgroundApi.serviceToken.getToken({
          networkId: this.networkId,
          tokenIdOnNetwork: asset.unit,
          accountAddress: account.address,
        });
        sends.push({
          from: account.address,
          to: output.address,
          isNative: false,
          tokenIdOnNetwork: asset.unit,
          name: token.name,
          icon: token.logoURI ?? '',
          amount: new BigNumber(asset.quantity)
            .shiftedBy(-network.decimals)
            .toFixed(),
          amountValue: asset.quantity,
          symbol: token.symbol,
        });
      }
      sends.push({
        from: account.address,
        to: output.address,
        isNative: true,
        tokenIdOnNetwork: '',
        name: nativeToken.name,
        icon: nativeToken.logoURI ?? '',
        amount: new BigNumber(output.amount)
          .shiftedBy(-network.decimals)
          .toFixed(),
        amountValue: output.amount,
        symbol: network.symbol,
      });
    }
    actions = [
      {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: {
          from: account.address,
          to: utxoTo[0].address,
          sends,
          receives: [],
          utxoFrom,
          utxoTo,
        },
      },
    ];

    return {
      txid: '',
      owner: account.address,
      signer: account.address,
      nonce: 0,
      actions,
      status: EDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      payload: {
        type: EOnChainHistoryTxType.Send,
      },
      encodedTx,
      totalFeeInNative: encodedTx.totalFeeInNative,
      nativeAmount: nativeAmountMap.amount,
      nativeAmountValue: nativeAmountMap.amountValue,
    };
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    if (params.encodedTx) {
      const _existEncodedTx = params.encodedTx as IEncodedTxAda;
      return {
        encodedTx: params.encodedTx,
        transfersInfo: params.transfersInfo ?? [
          _existEncodedTx.transferInfo as ITransferInfo,
        ],
        txSize: new BigNumber(_existEncodedTx.totalFeeInNative).toNumber(),
      };
    }
    const encodedTx = await this.buildEncodedTx(params);
    if (encodedTx) {
      return {
        encodedTx,
        transfersInfo: params.transfersInfo,
        // feeRate = 1, 1 * txSize = final fee for ui
        txSize: new BigNumber(encodedTx.totalFeeInNative).toNumber(),
      };
    }
    throw new OneKeyInternalError('Failed to build unsigned tx');
  }

  override updateUnsignedTx(
    params: IUpdateUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    return Promise.resolve(params.unsignedTx);
  }

  override validateAddress(address: string): Promise<IAddressValidation> {
    if (address.length < 35) {
      return Promise.reject(new InvalidAddress());
    }
    if (validShelleyAddress(address) || validBootstrapAddress(address)) {
      return Promise.resolve({
        isValid: true,
        normalizedAddress: address,
        displayAddress: address,
      });
    }
    return Promise.reject(new InvalidAddress());
  }

  override validateXpub(xpub: string): Promise<IXpubValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override getPrivateKeyFromImported(
    params: IGetPrivateKeyFromImportedParams,
  ): Promise<IGetPrivateKeyFromImportedResult> {
    const input = decodeSensitiveText({ encodedText: params.input });
    let privateKey = bufferUtils.bytesToHex(decodePrivateKeyByXprv(input));
    privateKey = encodeSensitiveText({ text: privateKey });
    return Promise.resolve({ privateKey });
  }

  override validateXprvt(xprvt: string): Promise<IXprvtValidation> {
    const isValid = /^xprv/.test(xprvt) && xprvt.length >= 165;
    return Promise.resolve({ isValid });
  }

  override async validatePrivateKey(
    privateKey: string,
  ): Promise<IPrivateKeyValidation> {
    return Promise.resolve({
      isValid: false,
    });
  }

  override async validateGeneralInput(
    params: IValidateGeneralInputParams,
  ): Promise<IGeneralInputValidation> {
    const { result } = await this.baseValidateGeneralInput(params);
    return result;
  }

  override async getAccountXpub(): Promise<string | undefined> {
    const dbAccount = (await this.getAccount()) as IDBUtxoAccount;
    const stakeAddress = dbAccount.addresses?.['2/0'];
    return stakeAddress;
  }

  _collectUTXOsInfoByApi = memoizee(
    async (params: {
      address: string;
      path: string;
      addresses: Record<string, string>;
      xpub: string;
    }): Promise<IAdaUTXO[]> => {
      const { addresses, path, address, xpub } = params;
      const stakeAddress = addresses['2/0'];
      try {
        const { utxoList } =
          await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
            networkId: this.networkId,
            accountAddress: address,
            xpub: stakeAddress,
            withUTXOList: true,
            cardanoPubKey: xpub,
          });
        if (!utxoList || isEmpty(utxoList)) {
          throw new OneKeyInternalError('Failed to get UTXO list.');
        }

        const pathIndex = path.split('/')[3];

        return utxoList.map((utxo) => {
          let { path: utxoPath } = utxo;
          if (utxoPath && utxoPath.length > 0) {
            const pathArray = utxoPath.split('/');
            pathArray.splice(3, 1, pathIndex);
            utxoPath = pathArray.join('/');
          }
          return {
            ...utxo,
            tx_hash: utxo.txid,
            tx_index: utxo.txIndex as number,
            path: utxoPath,
            output_index: utxo.txIndex as number,
            amount: utxo.amount ?? [],
          };
        });
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

  private _getInputOrOutputBalance = (
    amounts: IAdaAmount[],
    decimals: number,
    asset = 'lovelace',
  ): { balance: string; balanceValue: string } => {
    const item = amounts.filter((amount) => amount.unit === asset);
    if (!item || item.length <= 0) {
      return { balance: '0', balanceValue: '0' };
    }
    const amount = item[0]?.quantity ?? '0';
    return {
      balance: new BigNumber(amount).shiftedBy(-decimals).toFixed(),
      balanceValue: amount,
    };
  };

  private _getOutputAmount = (
    outputs: IAdaEncodeOutput[],
    decimals: number,
    asset = 'lovelace',
  ) => {
    const realOutput = outputs.find((output) => !output.isChange);
    if (!realOutput) {
      return {
        amount: new BigNumber(0).shiftedBy(-decimals).toFixed(),
        amountValue: '0',
      };
    }
    if (asset === 'lovelace') {
      return {
        amount: new BigNumber(realOutput.amount).shiftedBy(-decimals).toFixed(),
        amountValue: realOutput.amount,
      };
    }
    const assetAmount = realOutput.assets.find((token) => token.unit === asset);
    return {
      amount: new BigNumber(assetAmount?.quantity ?? 0)
        .shiftedBy(-decimals)
        .toFixed(),
      amountValue: assetAmount?.quantity ?? '0',
    };
  };

  private _getStakeAddress = memoizee(
    async (address?: string) => {
      if (
        address &&
        validShelleyAddress(address) &&
        address.startsWith('stake')
      ) {
        return address;
      }
      const dbAccount = (await this.getAccount()) as IDBUtxoAccount;
      return dbAccount.addresses?.['2/0'] ?? '';
    },
    {
      maxAge: timerUtils.getTimeDurationMs({ seconds: 30 }),
      promise: true,
    },
  );

  // Dapp Function
  async getBalanceForDapp() {
    const stakeAddress = await this._getStakeAddress();
    const [rawBalance, assetsBalance] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<
        IAdaAccount | IAdaAmount[]
      >({
        networkId: this.networkId,
        body: [
          {
            route: 'bf',
            params: {
              method: 'accounts',
              params: [stakeAddress],
            },
          },
          {
            route: 'bf',
            params: {
              method: 'accountsAddressesAssets',
              params: [stakeAddress],
            },
          },
        ],
      });
    const balance = {
      unit: 'lovelace',
      quantity: (rawBalance as IAdaAccount).controlled_amount,
    };
    const result = [balance, ...(assetsBalance as IAdaAmount[])];
    const CardanoApi = await sdk.getCardanoApi();
    return CardanoApi.dAppGetBalance(result);
  }

  async getUtxosForDapp(amount?: string) {
    const dbAccount = (await this.getAccount()) as IDBUtxoAccount;
    const { address, xpub, path, addresses } = dbAccount;
    const utxos = await this._collectUTXOsInfoByApi({
      address,
      addresses,
      path,
      xpub,
    });
    const CardanoApi = await sdk.getCardanoApi();
    return CardanoApi.dAppGetUtxos(dbAccount.address, utxos, amount);
  }

  async getAccountAddressForDapp() {
    const dbAccount = (await this.getAccount()) as IDBUtxoAccount;
    const CardanoApi = await sdk.getCardanoApi();
    return CardanoApi.dAppGetAddresses([dbAccount.address]);
  }

  async getStakeAddressForDapp() {
    const dbAccount = (await this.getAccount()) as IDBUtxoAccount;
    const stakeAddress = await this._getStakeAddress(dbAccount.address);
    const CardanoApi = await sdk.getCardanoApi();
    return CardanoApi.dAppGetAddresses([stakeAddress]);
  }

  async buildTxCborToEncodeTx(txHex: string): Promise<IEncodedTxAda> {
    const dbAccount = (await this.getAccount()) as IDBUtxoAccount;
    const changeAddress = getChangeAddress(dbAccount);
    const stakeAddress = await this._getStakeAddress(dbAccount.address);
    const [associatedAddresses] =
      await this.backgroundApi.serviceAccountProfile.sendProxyRequest<
        { address: string }[]
      >({
        networkId: this.networkId,
        body: [
          {
            route: 'bf',
            params: {
              method: 'accountsAddresses',
              params: [stakeAddress],
            },
          },
        ],
      });
    const { address, xpub, path, addresses: accountAddresses } = dbAccount;
    const utxos = await this._collectUTXOsInfoByApi({
      address,
      addresses: accountAddresses,
      path,
      xpub,
    });
    const CardanoApi = await sdk.getCardanoApi();
    const addresses = associatedAddresses.map((i) => i.address);
    const encodeTx = await CardanoApi.dAppConvertCborTxToEncodeTx(
      txHex,
      utxos,
      addresses,
      changeAddress,
    );
    return {
      ...encodeTx,
      changeAddress,
    };
  }
}
