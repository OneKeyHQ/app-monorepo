import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import {
  getBtcForkNetwork,
  validateBtcAddress,
} from '@onekeyhq/core/src/chains/btc/sdkBtc';
import type {
  IBtcInput,
  ICoinSelectUTXO,
  IEncodedTxBtc,
  IOutputsForCoinSelect,
} from '@onekeyhq/core/src/chains/btc/types';
import type {
  ICoreApiSignAccount,
  ICoreApiSignBtcExtraInfo,
  ISignedTxPro,
  ITxInput,
  ITxInputToSign,
  IUnsignedMessage,
  IUnsignedTxPro,
} from '@onekeyhq/core/src/types';
import { EAddressEncodings } from '@onekeyhq/core/src/types';
import { estimateTxSize, getBIP44Path } from '@onekeyhq/core/src/utils';
import type { ICoinSelectAlgorithm } from '@onekeyhq/core/src/utils/coinSelectUtils';
import { coinSelect } from '@onekeyhq/core/src/utils/coinSelectUtils';
import { BTC_TX_PLACEHOLDER_VSIZE } from '@onekeyhq/shared/src/consts/chainConsts';
import {
  InsufficientBalance,
  NotImplemented,
  OneKeyInternalError,
} from '@onekeyhq/shared/src/errors';
import { checkIsDefined } from '@onekeyhq/shared/src/utils/assertUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import type {
  INetworkAccountAddressDetail,
  IXpubValidation,
} from '@onekeyhq/shared/types/address';
import type { IFeeInfoUnit } from '@onekeyhq/shared/types/fee';
import { EOnChainHistoryTxType } from '@onekeyhq/shared/types/history';
import {
  EDecodedTxActionType,
  EDecodedTxStatus,
} from '@onekeyhq/shared/types/tx';
import type { IDecodedTx, IDecodedTxAction } from '@onekeyhq/shared/types/tx';

import { VaultBase } from '../../base/VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';

import type {
  IDBAccount,
  IDBUtxoAccount,
  IDBWalletType,
} from '../../../dbs/local/types';
import type { KeyringBase } from '../../base/KeyringBase';
import type {
  IBroadcastTransactionParams,
  IBuildAccountAddressDetailParams,
  IBuildDecodedTxParams,
  IBuildEncodedTxParams,
  IBuildUnsignedTxParams,
  ITransferInfo,
  IVaultSettings,
} from '../../types';

// btc vault
export default class VaultBtc extends VaultBase {
  override async buildAccountAddressDetail(
    params: IBuildAccountAddressDetailParams,
  ): Promise<INetworkAccountAddressDetail> {
    const { account, networkId } = params;
    // btc and tbtc use different cointype, so they do not share same db account, just use db account address only
    const { address } = account;
    // const { normalizedAddress, displayAddress } = await this.validateAddress(
    //   account.address,
    // );
    return {
      networkId,
      normalizedAddress: address,
      displayAddress: address,
      address,
      baseAddress: address,
      isValid: true,
    };
  }

  override async buildDecodedTx(
    params: IBuildDecodedTxParams,
  ): Promise<IDecodedTx> {
    const { unsignedTx } = params;
    const encodedTx = unsignedTx.encodedTx as IEncodedTxBtc;
    const { inputs, outputs } = encodedTx;
    const network = await this.getNetwork();
    const account = await this.getAccount();
    const nativeToken = await this.backgroundApi.serviceToken.getToken({
      networkId: this.networkId,
      tokenIdOnNetwork: '',
    });

    if (!nativeToken) {
      throw new OneKeyInternalError('Native token not found');
    }

    let actions: IDecodedTxAction[] = [];

    const utxoFrom = inputs.map((input) => ({
      address: input.address,
      balance: new BigNumber(input.value)
        .shiftedBy(-network.decimals)
        .toFixed(),
      balanceValue: input.value,
      symbol: network.symbol,
      isMine: true,
    }));
    const utxoTo = outputs
      .filter((output) => !output.payload?.isCharge)
      .map((output) => ({
        address: output.address,
        balance: new BigNumber(output.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: output.value,
        symbol: network.symbol,
        isMine: output.address === account.address,
      }));

    let sendNativeTokenAmountBN = new BigNumber(0);
    let sendNativeTokenAmountValueBN = new BigNumber(0);

    actions = [
      {
        type: EDecodedTxActionType.ASSET_TRANSFER,
        assetTransfer: {
          from: account.address,
          to: utxoTo[0].address,
          sends: utxoTo.map((utxo) => {
            sendNativeTokenAmountBN = sendNativeTokenAmountBN.plus(
              utxo.balance,
            );
            sendNativeTokenAmountValueBN = sendNativeTokenAmountValueBN.plus(
              utxo.balanceValue,
            );
            return {
              from: account.address,
              to: utxo.address,
              isNative: true,
              tokenIdOnNetwork: '',
              name: nativeToken.name,
              icon: nativeToken.logoURI ?? '',
              amount: utxo.balance,
              amountValue: utxo.balanceValue,
              symbol: network.symbol,
            };
          }),
          receives: [],
          utxoFrom,
          utxoTo,
        },
      },
    ];

    const totalFeeInNative = new BigNumber(encodedTx.fee)
      .shiftedBy(-1 * network.feeMeta.decimals)
      .toFixed();

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
      totalFeeInNative,
      nativeAmount: sendNativeTokenAmountBN.toFixed(),
      nativeAmountValue: sendNativeTokenAmountValueBN.toFixed(),
    };
  }

  override broadcastTransaction(
    params: IBroadcastTransactionParams,
  ): Promise<ISignedTxPro> {
    console.log('VaultBtc broadcastTransaction', params, {
      rawTxOk:
        params.signedTx.rawTx ===
        '0200000000010190ed799b5a2d54a743f8c405615ddada3823b2cc1c178a77a15f5e18de45cb390100000000ffffffff02e80300000000000022512017161c749b810cbd8a2aa7310965b5cb025de7afa2e098a9d3b1aba6424302c6f00e02000000000022512017161c749b810cbd8a2aa7310965b5cb025de7afa2e098a9d3b1aba6424302c601402a5758f1759557b6b7a02900339f5ed83984e26a24e22b642f7a3bcd89a13392cf0848d29eb6be2e18e2c040969c37bd44825f8a343db8c530229c0aceecf88200000000',
      txidOk:
        params.signedTx.txid ===
        '17eafe9b6ca10dbdb70f8f37460db13401cccd9cc2bcb4851a31f01799688dd3',
    });
    throw new Error('Method not implemented.');
  }

  override settings: IVaultSettings = settings;

  override async buildEncodedTx(
    params: IBuildEncodedTxParams,
  ): Promise<IEncodedTxBtc> {
    const { transfersInfo, specifiedFeeRate } = params;

    if (!transfersInfo || isEmpty(transfersInfo)) {
      throw new OneKeyInternalError('transfersInfo is required');
    }

    return this._buildEncodedTxFromTransfer({
      transfersInfo,
      specifiedFeeRate,
    });
  }

  override async buildUnsignedTx(
    params: IBuildUnsignedTxParams,
  ): Promise<IUnsignedTxPro> {
    const encodedTx = await this.buildEncodedTx(params);

    if (encodedTx) {
      return this._buildUnsignedTxFromEncodedTx({
        encodedTx,
        transfersInfo: params.transfersInfo ?? [],
      });
    }
    throw new OneKeyInternalError();
  }

  override async updateUnsignedTx(options: {
    unsignedTx: IUnsignedTxPro;
    feeInfo?: IFeeInfoUnit | undefined;
  }): Promise<IUnsignedTxPro> {
    const { unsignedTx, feeInfo } = options;
    let encodedTxNew = unsignedTx.encodedTx as IEncodedTxBtc;
    if (feeInfo) {
      if (!unsignedTx.transfersInfo || isEmpty(unsignedTx.transfersInfo)) {
        throw new OneKeyInternalError('transfersInfo is required');
      }

      encodedTxNew = await this._attachFeeInfoToEncodedTx({
        encodedTx: unsignedTx.encodedTx as IEncodedTxBtc,
        transfersInfo: unsignedTx.transfersInfo,
        feeInfo,
      });
    }

    unsignedTx.encodedTx = encodedTxNew;

    return Promise.resolve(unsignedTx);
  }

  async _attachFeeInfoToEncodedTx({
    encodedTx,
    feeInfo,
    transfersInfo,
  }: {
    encodedTx: IEncodedTxBtc;
    feeInfo: IFeeInfoUnit;
    transfersInfo: ITransferInfo[];
  }) {
    const network = await this.getNetwork();

    if (feeInfo.feeUTXO?.feeRate) {
      const feeRate = new BigNumber(feeInfo.feeUTXO.feeRate)
        .shiftedBy(-network.feeMeta.decimals)
        .toFixed();

      if (typeof feeRate === 'string') {
        return this._buildEncodedTxFromTransfer({
          transfersInfo,
          specifiedFeeRate: feeRate,
        });
      }
    }

    return Promise.resolve(encodedTx);
  }

  async getBtcForkNetwork() {
    return getBtcForkNetwork(await this.getNetworkImpl());
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override async validateXpub(_xpub: string): Promise<IXpubValidation> {
    throw new Error('Method not implemented.');
  }

  override async validateAddress(address: string) {
    return validateBtcAddress({
      address,
      network: await this.getBtcForkNetwork(),
    });
  }

  private parseAddressEncodings(
    addresses: string[],
  ): Promise<Array<EAddressEncodings | undefined>> {
    return Promise.all(
      addresses.map((address) => this.validateAddress(address)),
    ).then((results) => results.map((i) => i.encoding));
  }

  override keyringMap: Record<IDBWalletType, typeof KeyringBase> = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  async _buildEncodedTxFromTransfer(params: {
    transfersInfo: ITransferInfo[];
    specifiedFeeRate?: string;
  }): Promise<IEncodedTxBtc> {
    const { transfersInfo } = params;
    if (transfersInfo.length === 1) {
      const transferInfo = transfersInfo[0];
      if (!transferInfo.to) {
        throw new Error('buildEncodedTx ERROR: transferInfo.to is missing');
      }
    }
    return this._buildEncodedTxFromBatchTransfer(params);
  }

  async _buildEncodedTxFromBatchTransfer(params: {
    transfersInfo: ITransferInfo[];
    specifiedFeeRate?: string;
  }): Promise<IEncodedTxBtc> {
    const { transfersInfo } = params;
    const transferInfo = transfersInfo[0];
    const account = (await this.getAccount()) as IDBUtxoAccount;
    const { inputs, outputs, fee, inputsForCoinSelect, outputsForCoinSelect } =
      await this._buildTransferParamsWithCoinSelector(params);

    if (!inputs || !outputs || isNil(fee)) {
      throw new InsufficientBalance({ message: 'Failed to select UTXOs' });
    }

    return {
      inputs: inputs.map(({ txId, value, ...keep }) => ({
        address: account.address,
        path: '',
        ...keep,
        txid: txId,
        value: value.toString(),
      })),
      outputs: outputs.map(({ value, address, script }) => {
        const valueText = value?.toString();

        // OP_RETURN output
        if (
          valueText &&
          new BigNumber(valueText).eq(0) &&
          !address &&
          script === transferInfo.opReturn
        ) {
          return {
            address: '',
            value: valueText,
            payload: {
              opReturn: transferInfo.opReturn,
            },
          };
        }

        // If there is no address, it should be set to the change address.
        const addressOrChangeAddress = address || account.address;
        if (!addressOrChangeAddress) {
          throw new Error(
            'buildEncodedTxFromBatchTransfer ERROR: Invalid change address',
          );
        }
        if (!valueText || new BigNumber(valueText).lte(0)) {
          throw new Error(
            'buildEncodedTxFromBatchTransfer ERROR: Invalid value',
          );
        }
        return {
          address: addressOrChangeAddress,
          value: valueText,
          payload: address
            ? undefined
            : {
                isCharge: true,
                bip44Path: getBIP44Path(account, account.address),
              },
        };
      }),
      inputsForCoinSelect,
      outputsForCoinSelect,
      fee: fee.toString(),
    };
  }

  async _buildTransferParamsWithCoinSelector({
    transfersInfo,
    specifiedFeeRate,
  }: {
    transfersInfo: ITransferInfo[];
    specifiedFeeRate?: string;
  }) {
    const network = await this.getNetwork();
    if (!transfersInfo.length) {
      throw new Error(
        'buildTransferParamsWithCoinSelector ERROR: transferInfos is required',
      );
    }

    const isBatchTransfer = transfersInfo.length > 1;

    // TODO: inscription transfer

    const utxosInfo = await this._collectUTXOsInfoByApi();

    // Select the slowest fee rate as default, otherwise the UTXO selection
    // would be failed.
    // SpecifiedFeeRate is from UI layer and is in BTC/byte, convert it to sats/byte
    const feeRate =
      typeof specifiedFeeRate !== 'undefined'
        ? new BigNumber(specifiedFeeRate)
            .shiftedBy(network.feeMeta.decimals)
            .toFixed()
        : (await this._getFeeRate())[1];

    const inputsForCoinSelect: ICoinSelectUTXO[] = utxosInfo.map(
      ({ txid, vout, value, address, path }) => ({
        txId: txid,
        vout,
        value: parseInt(value),
        address,
        path,
      }),
    );

    let outputsForCoinSelect: IOutputsForCoinSelect = [];

    if (isBatchTransfer) {
      outputsForCoinSelect = transfersInfo.map(({ to, amount }) => ({
        address: to,
        value: parseInt(
          new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
        ),
      }));
    } else {
      const transferInfo = transfersInfo[0];
      const { to, amount } = transferInfo;

      const allUtxoAmount = utxosInfo
        .reduce((v, { value }) => v.plus(value), new BigNumber('0'))
        .shiftedBy(-network.decimals);

      if (allUtxoAmount.lt(amount)) {
        throw new InsufficientBalance();
      }

      const max = allUtxoAmount.lte(amount);

      const value = parseInt(
        new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
      );

      outputsForCoinSelect = [
        max
          ? { address: to, isMax: true }
          : {
              address: to,
              value,
            },
      ];

      if (
        transferInfo.opReturn &&
        typeof transferInfo.opReturn === 'string' &&
        transferInfo.opReturn.length
      ) {
        outputsForCoinSelect.push({
          address: '',
          value: 0,
          script: transferInfo.opReturn,
        });
      }
    }

    const algorithm: ICoinSelectAlgorithm | undefined = !isBatchTransfer
      ? transfersInfo[0].coinSelectAlgorithm
      : undefined;
    // transfer output + maybe opReturn output
    if (!isBatchTransfer && outputsForCoinSelect.length > 2) {
      throw new Error('single transfer should only have one output');
    }
    const { inputs, outputs, fee } = coinSelect({
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate,
      algorithm,
    });

    return {
      inputs,
      outputs,
      fee,
      inputsForCoinSelect,
      outputsForCoinSelect,
      feeRate,
    };
  }

  async _buildUnsignedTxFromEncodedTx({
    encodedTx,
    transfersInfo,
  }: {
    encodedTx: IEncodedTxBtc;
    transfersInfo: ITransferInfo[];
  }): Promise<IUnsignedTxPro> {
    const { inputs, outputs, inputsForCoinSelect } = encodedTx;

    let txSize = BTC_TX_PLACEHOLDER_VSIZE;
    const inputsInUnsignedTx: ITxInput[] = [];
    for (const input of inputs) {
      const value = new BigNumber(input.value);
      inputsInUnsignedTx.push({
        address: input.address,
        value,
        utxo: { txid: input.txid, vout: input.vout, value },
      });
    }
    const outputsInUnsignedTx = outputs.map(({ address, value, payload }) => ({
      address,
      value: new BigNumber(value),
      payload,
    }));

    const selectedInputs = inputsForCoinSelect?.filter((input) =>
      inputsInUnsignedTx.some(
        (i) => i.utxo?.txid === input.txId && i.utxo.vout === input.vout,
      ),
    );
    if (Number(selectedInputs?.length) > 0 && outputs.length > 0) {
      txSize = estimateTxSize(
        selectedInputs ?? [],
        outputs.map((o) => ({
          address: o.address,
          value: parseInt(o.value),
        })) ?? [],
      );
    }

    const ret = {
      inputs: inputsInUnsignedTx,
      outputs: outputsInUnsignedTx,
      txSize,
      encodedTx,
      transfersInfo,
    };

    return Promise.resolve(ret);
  }

  _getFeeRate = memoizee(
    async () => {
      try {
        const feeInfo = await this.backgroundApi.serviceGas.estimateFee({
          networkId: this.networkId,
        });
        const { feeUTXO } = feeInfo;
        if (!feeUTXO || isEmpty(feeUTXO)) {
          throw new OneKeyInternalError('Failed to get fee rates.');
        }
        const fees = feeUTXO.map((item) =>
          new BigNumber(item.feeRate ?? 0).toFixed(0),
        );
        // Find the index of the first negative fee.
        let negativeIndex = fees.findIndex((val) => new BigNumber(val).lt(0));

        // Keep replacing if there is any negative fee in the array.
        while (negativeIndex >= 0) {
          let leftIndex = negativeIndex - 1;
          let rightIndex = negativeIndex + 1;

          // eslint-disable-next-line no-constant-condition
          while (true) {
            if (leftIndex >= 0 && new BigNumber(fees[leftIndex]).gte(0)) {
              fees[negativeIndex] = fees[leftIndex];
              break;
            }

            if (
              rightIndex < fees.length &&
              new BigNumber(fees[rightIndex]).gte(0)
            ) {
              fees[negativeIndex] = fees[rightIndex];
              break;
            }

            // Move pointers to expand searching range.
            leftIndex -= 1;
            rightIndex += 1;

            if (leftIndex < 0 && rightIndex >= fees.length) {
              break;
            }
          }

          // Find the next negative fee after replacement.
          negativeIndex = fees.findIndex((val) => new BigNumber(val).lt(0));
        }

        return fees.sort((a, b) =>
          new BigNumber(a).comparedTo(new BigNumber(b)),
        );
      } catch (e) {
        console.error(e);
        throw new OneKeyInternalError('Failed to get fee rates.');
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: 1000 * 30,
    },
  );

  async collectTxs(txids: string[]): Promise<{
    [txid: string]: string; // rawTx string
  }> {
    console.log(txids);
    const lookup: {
      [txid: string]: string; // rawTx string
    } = {};

    const txs = await this.backgroundApi.serviceSend.getRawTransactions({
      networkId: this.networkId,
      txids,
    });

    Object.keys(txs).forEach((txid) => (lookup[txid] = txs[txid].rawTx));

    return lookup;
  }

  _collectUTXOsInfoByApi = memoizee(
    async () => {
      try {
        const { utxoList } =
          await this.backgroundApi.serviceAccountProfile.fetchAccountDetails({
            networkId: this.networkId,
            accountAddress: await this.getAccountAddress(),
            xpub: await this.getAccountXpub(),
            withUTXOList: true,
          });
        if (!utxoList || isEmpty(utxoList)) {
          throw new OneKeyInternalError('Failed to get UTXO list.');
        }
        return utxoList;
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

  async _getRelPathToAddressByApi({
    addresses,
    account,
  }: {
    addresses: string[];
    account: IDBAccount;
  }) {
    const utxos = await this._collectUTXOsInfoByApi();

    const pathToAddresses: {
      [path: string]: {
        address: string;
        relPath: string;
      };
    } = {};

    // add all matched addresses from utxos
    for (const utxo of utxos) {
      const { address, path } = utxo;
      if (addresses.includes(address)) {
        const relPath = path.split('/').slice(-2).join('/');
        pathToAddresses[path] = {
          address,
          relPath,
        };
      }
    }

    // always add first account (path=0/0) address
    const firstRelPath = '0/0';
    const firstFullPath = [account.path, firstRelPath].join('/');
    if (!pathToAddresses[firstFullPath]) {
      pathToAddresses[firstFullPath] = {
        address: account.address,
        relPath: firstRelPath,
      };
    }

    const relPaths: string[] = Object.values(pathToAddresses).map(
      (item) => item.relPath,
    );

    return {
      relPaths,
      pathToAddresses,
    };
  }

  async _collectInfoForSoftwareSign(
    unsignedTx: IUnsignedTxPro,
  ): Promise<[Array<EAddressEncodings | undefined>, Record<string, string>]> {
    const { inputs } = unsignedTx.encodedTx as IEncodedTxBtc;

    const inputAddressesEncodings = await this.parseAddressEncodings(
      inputs.map((i) => i.address),
    );

    const nonWitnessInputPrevTxids = Array.from(
      new Set(
        inputAddressesEncodings
          .map((encoding, index) => {
            if (encoding === EAddressEncodings.P2PKH) {
              return checkIsDefined(inputs[index]).txid;
            }
            return undefined;
          })
          .filter((i) => !!i) as string[],
      ),
    );

    const nonWitnessPrevTxs = await this.collectTxs(nonWitnessInputPrevTxids);

    return [inputAddressesEncodings, nonWitnessPrevTxs];
  }

  async prepareBtcSignExtraInfo({
    unsignedTx,
    unsignedMessage,
  }: {
    unsignedTx?: IUnsignedTxPro;
    unsignedMessage?: IUnsignedMessage;
  }): Promise<{
    account: ICoreApiSignAccount;
    btcExtraInfo: ICoreApiSignBtcExtraInfo;
  }> {
    const account = await this.getAccount();

    let addresses: string[] = [];
    if (unsignedMessage) {
      addresses = [account.address];
    }
    if (unsignedTx) {
      const emptyInputs: Array<ITxInputToSign | IBtcInput> = [];
      addresses = emptyInputs
        .concat(
          unsignedTx.inputsToSign ?? [],
          (unsignedTx.encodedTx as IEncodedTxBtc)?.inputs ?? [],
        )
        .filter(Boolean)
        .map((input) => input.address)
        .concat(account.address);
    }

    const {
      // required for multiple address signing
      relPaths,
      pathToAddresses,
    } = await this._getRelPathToAddressByApi({
      addresses,
      account,
    });

    const btcExtraInfo: ICoreApiSignBtcExtraInfo = {
      pathToAddresses,
    };

    if (unsignedTx) {
      const [inputAddressesEncodings, nonWitnessPrevTxs] =
        await this._collectInfoForSoftwareSign(unsignedTx);
      btcExtraInfo.inputAddressesEncodings = inputAddressesEncodings;
      btcExtraInfo.nonWitnessPrevTxs = nonWitnessPrevTxs;
    }

    const signerAccount: ICoreApiSignAccount = {
      ...account,
      relPaths,
    };

    return { btcExtraInfo, account: signerAccount };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  override getPrivateKeyFromImported(params: {
    input: string;
  }): Promise<{ privateKey: string }> {
    throw new NotImplemented();
  }

  override async getAccountXpub(): Promise<string> {
    const account = (await this.getAccount()) as IDBUtxoAccount;
    return account.xpubSegwit ?? account.xpub;
  }

  override async buildEstimateFeeParams() {
    return Promise.resolve(undefined);
  }
}
