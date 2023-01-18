/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';
// @ts-ignore
import coinSelect from 'coinselect';
// @ts-ignore
import coinSelectSplit from 'coinselect/split';
import memoizee from 'memoizee';

import { BlockBook } from '@onekeyhq/blockchain-libs/src/provider/chains/btc/blockbook';
import type { Provider } from '@onekeyhq/blockchain-libs/src/provider/chains/btc/provider';
import { decrypt } from '@onekeyhq/engine/src/secret/encryptors/aes256';
import { UnsignedTx } from '@onekeyhq/engine/src/types/provider';
import type {
  PartialTokenInfo,
  TxInput,
} from '@onekeyhq/engine/src/types/provider';

import {
  InsufficientBalance,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import { TxStatus } from '../../../types/covalent';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
} from '../../types';
import { Provider as BTCForkChainProvider } from '../../utils/btcForkChain/provider';
import { getBIP44Path } from '../../utils/btcForkChain/utils';
import { VaultBase } from '../../VaultBase';
import { EVMDecodedTxType } from '../evm/decoder/types';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import settings from './settings';
import { getAccountDefaultByPurpose } from './utils';

import type { ExportedPrivateKeyCredential } from '../../../dbs/base';
import type { DBUTXOAccount } from '../../../types/account';
import type {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxActionNativeTransfer,
  IDecodedTxLegacy,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { IBlockBookTransaction } from '../../utils/btcForkChain/types';
import type { EVMDecodedItem } from '../evm/decoder/types';
import type { IBtcUTXO, IEncodedTxBtc } from './types';

const DEFAULT_BLOCK_NUMS = [5, 2, 1];
const DEFAULT_BLOCK_TIME = 600; // Average block time is 10 minutes.
const DEFAULT_PRESET_FEE_INDEX = 1; // Use medium fee rate by default.

export default class Vault extends VaultBase {
  private provider?: BTCForkChainProvider;

  async getBTCForkChainProvider() {
    if (!this.provider) {
      const chainInfo =
        await this.engine.providerManager.getChainInfoByNetworkId(
          this.networkId,
        );
      this.provider = new BTCForkChainProvider(chainInfo);
    }
    return this.provider;
  }

  private getFeeRate = memoizee(
    async () => {
      const client = await (this.engineProvider as Provider).blockbook;
      try {
        const fees = await Promise.all(
          DEFAULT_BLOCK_NUMS.map((blockNum) =>
            client
              .estimateFee(blockNum)
              .then((feeRate) => new BigNumber(feeRate).toFixed(0)),
          ),
        );
        return fees.sort((a, b) => {
          const aBN = new BigNumber(a);
          const bBN = new BigNumber(b);
          if (aBN.gt(bBN)) return 1;
          if (aBN.lt(bBN)) return -1;
          return 0;
        });
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

  collectUTXOs = memoizee(
    async () => {
      const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
      const client = await (this.engineProvider as Provider).blockbook;
      try {
        // TODO: use updated blockchain-libs API
        return await client.restful
          .get(`/api/v2/utxo/${dbAccount.xpub}`)
          .then((i) => i.json() as unknown as Array<IBtcUTXO>);
      } catch (e) {
        console.error(e);
        throw new OneKeyInternalError('Failed to get UTXOs of the account.');
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: 1000 * 60,
    },
  );

  settings = settings;

  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override getFetchBalanceAddress(account: DBUTXOAccount): Promise<string> {
    return Promise.resolve(account.xpub);
  }

  attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxBtc;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxBtc> {
    const feeRate = params.feeInfoValue.price;
    if (typeof feeRate === 'string') {
      return this.buildEncodedTxFromTransfer(
        params.encodedTx.transferInfo,
        feeRate,
      );
    }
    return Promise.resolve(params.encodedTx);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    const { type, nativeTransfer } = decodedTx.actions[0];
    if (
      type !== IDecodedTxActionType.NATIVE_TRANSFER ||
      typeof nativeTransfer === 'undefined'
    ) {
      // shouldn't happen.
      throw new OneKeyInternalError('Incorrect decodedTx.');
    }
    return Promise.resolve({
      txType: EVMDecodedTxType.NATIVE_TRANSFER,
      symbol: 'UNKNOWN',
      amount: nativeTransfer.amount,
      value: nativeTransfer.amountValue,
      fromAddress: nativeTransfer.from,
      toAddress: nativeTransfer.to,
      data: '',
      totalFeeInNative: decodedTx.totalFeeInNative,
      total: BigNumber.sum
        .apply(
          null,
          (nativeTransfer.utxoFrom || []).map(
            ({ balanceValue }) => balanceValue,
          ),
        )
        .toFixed(),
    } as IDecodedTxLegacy);
  }

  async decodeTx(encodedTx: IEncodedTxBtc, payload?: any): Promise<IDecodedTx> {
    const { inputs, outputs } = encodedTx;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    const nativeTransfer: IDecodedTxActionNativeTransfer = {
      tokenInfo: token,
      utxoFrom: inputs.map((input) => ({
        address: input.address,
        balance: new BigNumber(input.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: input.value,
        symbol: network.symbol,
        isMine: true,
      })),
      utxoTo: outputs.map((output) => ({
        address: output.address,
        balance: new BigNumber(output.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: output.value,
        symbol: network.symbol,
        isMine: output.address === dbAccount.address,
      })),
      from: dbAccount.address,
      to: outputs[0].address,
      amount: new BigNumber(outputs[0].value)
        .shiftedBy(-network.decimals)
        .toFixed(),
      amountValue: outputs[0].value,
      extraInfo: null,
    };
    return {
      txid: '',
      owner: dbAccount.address,
      signer: dbAccount.address,
      nonce: 0,
      actions: [
        {
          type: IDecodedTxActionType.NATIVE_TRANSFER,
          direction:
            outputs[0].address === dbAccount.address
              ? IDecodedTxDirection.OUT
              : IDecodedTxDirection.SELF,
          nativeTransfer,
        },
      ],
      status: IDecodedTxStatus.Pending,
      networkId: this.networkId,
      accountId: this.accountId,
      extraInfo: null,
      totalFeeInNative: encodedTx.totalFeeInNative,
    };
  }

  async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
    specifiedFeeRate?: string,
  ): Promise<IEncodedTxBtc> {
    const { to, amount } = transferInfo;
    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const utxos = await this.collectUTXOs();
    // const feeRate = '2';
    // Select the slowest fee rate as default, otherwise the UTXO selection
    // would be failed.
    // SpecifiedFeeRate is from UI layer and is in BTC/byte, convert it to sats/byte
    const feeRate =
      typeof specifiedFeeRate !== 'undefined'
        ? new BigNumber(specifiedFeeRate)
            .shiftedBy(network.feeDecimals)
            .toFixed()
        : (await this.getFeeRate())[DEFAULT_PRESET_FEE_INDEX];
    const max = utxos
      .reduce((v, { value }) => v.plus(value), new BigNumber('0'))
      .shiftedBy(-network.decimals)
      .lte(amount);

    const {
      inputs,
      outputs,
      fee,
    }: {
      inputs: Array<{
        txId: string;
        vout: number;
        value: number;
        address: string;
        path: string;
      }>;
      outputs: Array<{ address: string; value: number }>;
      fee: number;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    } = (max ? coinSelectSplit : coinSelect)(
      utxos.map(({ txid, vout, value, address, path }) => ({
        txId: txid,
        vout,
        value: parseInt(value),
        address,
        path,
      })),
      [
        max
          ? { address: to }
          : {
              address: to,
              value: parseInt(
                new BigNumber(amount).shiftedBy(network.decimals).toFixed(),
              ),
            },
      ],
      parseInt(feeRate),
    );
    if (!inputs || !outputs) {
      throw new InsufficientBalance('Failed to select UTXOs');
    }
    const totalFee = fee.toString();
    const totalFeeInNative = new BigNumber(totalFee)
      .shiftedBy(-1 * network.feeDecimals)
      .toFixed();
    return {
      inputs: inputs.map(({ txId, value, ...keep }) => ({
        ...keep,
        txid: txId,
        value: value.toString(),
      })),
      outputs: outputs.map(({ value, address }) => ({
        address: address || dbAccount.address, // change amount
        value: value.toString(),
        payload: address
          ? undefined
          : {
              isCharge: true,
              bip44Path: getBIP44Path(dbAccount, dbAccount.address),
            },
      })),
      totalFee,
      totalFeeInNative,
      transferInfo,
    };
  }

  buildEncodedTxFromApprove(approveInfo: IApproveInfo): Promise<any> {
    throw new NotImplemented();
  }

  updateEncodedTxTokenApprove(
    encodedTx: IEncodedTx,
    amount: string,
  ): Promise<IEncodedTx> {
    throw new NotImplemented();
  }

  updateEncodedTx(
    encodedTx: IEncodedTx,
    payload: any,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTx> {
    return Promise.resolve(encodedTx);
  }

  buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxBtc,
  ): Promise<IUnsignedTxPro> {
    const { inputs, outputs } = encodedTx;

    const inputsInUnsignedTx: Array<TxInput> = [];
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

    const ret = {
      inputs: inputsInUnsignedTx,
      outputs: outputsInUnsignedTx,
      payload: {},
      encodedTx,
    };
    return Promise.resolve(ret);
  }

  async fetchFeeInfo(encodedTx: IEncodedTxBtc): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);
    const { feeLimit } = await this.engine.providerManager.buildUnsignedTx(
      this.networkId,
      {
        ...(await this.buildUnsignedTxFromEncodedTx(encodedTx)),
        feePricePerUnit: new BigNumber(1),
      },
    );
    // Prices are in sats/byte, convert it to BTC/byte for UI.
    const prices = (await this.getFeeRate()).map((price) =>
      new BigNumber(price).shiftedBy(-network.feeDecimals).toFixed(),
    );
    return {
      customDisabled: true,
      limit: (feeLimit ?? new BigNumber(0)).toFixed(), // bytes in BTC
      prices,
      waitingSeconds: DEFAULT_BLOCK_NUMS.map(
        (numOfBlocks) => numOfBlocks * DEFAULT_BLOCK_TIME,
      ),
      defaultPresetIndex: DEFAULT_PRESET_FEE_INDEX.toString(),
      feeSymbol: 'BTC',
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null, // Must be null if network not support feeInTx
    };
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    if (dbAccount.id.startsWith('hd-')) {
      const purpose = parseInt(dbAccount.path.split('/')[1]);
      const { addressEncoding } = getAccountDefaultByPurpose(purpose);
      const { network } = this.engineProvider as Provider;
      const { private: xprvVersionBytes } =
        (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

      const keyring = this.keyring as KeyringHd;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      return bs58check.encode(
        bs58check
          .decode(dbAccount.xpub)
          .fill(
            Buffer.from(xprvVersionBytes.toString(16).padStart(8, '0'), 'hex'),
            0,
            4,
          )
          .fill(
            Buffer.concat([
              Buffer.from([0]),
              decrypt(password, encryptedPrivateKey),
            ]),
            45,
            78,
          ),
      );
    }
    if (dbAccount.id.startsWith('imported-')) {
      // Imported accounts, crendetial is already xprv
      const { privateKey } = (await this.engine.dbApi.getCredential(
        this.accountId,
        password,
      )) as ExportedPrivateKeyCredential;
      if (typeof privateKey === 'undefined') {
        throw new OneKeyInternalError('Unable to get credential.');
      }
      return bs58check.encode(decrypt(password, privateKey));
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override async getAccountBalance(tokenIds: Array<string>, withMain = true) {
    // No token support on BTC.
    const ret = tokenIds.map((id) => undefined);
    if (!withMain) {
      return ret;
    }
    const { xpub } = (await this.getDbAccount()) as DBUTXOAccount;
    if (!xpub) {
      return [new BigNumber('0'), ...ret];
    }
    const [mainBalance] = await this.getBalances([{ address: xpub }]);
    return [mainBalance].concat(ret);
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [] } = options;

    const provider = await this.getBTCForkChainProvider();
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const { decimals, symbol, impl } = await this.engine.getNetwork(
      this.networkId,
    );
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    let txs: Array<IBlockBookTransaction> = [];
    try {
      txs =
        (
          (await provider.getHistory(
            {
              type: 'history',
              xpub: dbAccount.xpub,
            },
            impl,
            dbAccount.address,
            symbol,
            decimals,
          )) as { transactions: Array<IBlockBookTransaction> }
        ).transactions ?? [];
    } catch (e) {
      console.error(e);
    }

    const promises = txs.map((tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.txid,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          // No need to update.
          return null;
        }
        const { direction, utxoFrom, utxoTo, from, to, amount, amountValue } =
          tx;

        const decodedTx: IDecodedTx = {
          txid: tx.txid,
          owner: dbAccount.address,
          signer: dbAccount.address,
          nonce: 0,
          actions: [
            {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              direction,
              nativeTransfer: {
                tokenInfo: token,
                utxoFrom,
                utxoTo,
                from,
                // For out and self transaction, use first address as to.
                // For in transaction, use first owned address as to.
                to,
                amount,
                amountValue,
                extraInfo: null,
              },
            },
          ],
          status:
            (tx.confirmations ?? 0) > 0
              ? IDecodedTxStatus.Confirmed
              : IDecodedTxStatus.Pending,
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
          totalFeeInNative: new BigNumber(tx.fees)
            .shiftedBy(-decimals)
            .toFixed(),
        };
        decodedTx.updatedAt =
          typeof tx.blockTime !== 'undefined'
            ? tx.blockTime * 1000
            : Date.now();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;
        return this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        console.error(e);
        return Promise.resolve(null);
      }
    });
    return (await Promise.all(promises)).filter(Boolean);
  }

  // TODO: BTC history type
  async getHistory(): Promise<Array<EVMDecodedItem>> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    const ret = [];
    let txs;
    try {
      txs =
        (
          (await (this.engineProvider as Provider).getAccount({
            type: 'history',
            xpub: dbAccount.xpub,
          })) as { transactions: Array<any> }
        ).transactions ?? [];
    } catch (e) {
      console.error(e);
      txs = [];
    }

    const network = await this.engine.getNetwork(this.networkId);

    for (const tx of txs) {
      try {
        const item = {} as EVMDecodedItem;
        item.symbol = network.symbol;
        item.network = network;
        item.chainId = 0;
        item.txStatus = TxStatus.Confirmed;
        item.info = null;

        const { value, valueIn, fees } = tx as {
          value: string;
          valueIn: string;
          fees: string;
        };
        item.amount = new BigNumber(value)
          .shiftedBy(-network.decimals)
          .toFixed();
        item.value = value;
        item.total = new BigNumber(valueIn).toFixed();

        item.txHash = (tx as { txid: string }).txid;
        item.blockSignedAt = (tx as { blockTime: number }).blockTime * 1000;
        item.data = (tx as { hex: string }).hex;

        const txSize = item.data.length / 2;
        const gasPrice = new BigNumber(fees).div(txSize).toFixed();

        item.gasInfo = {
          gasLimit: txSize,
          gasPrice,
          maxPriorityFeePerGas: '0',
          maxFeePerGas: '0',
          maxPriorityFeePerGasInGwei: '0',
          maxFeePerGasInGwei: '0',
          maxFeeSpend: '0',
          feeSpend: new BigNumber(fees).shiftedBy(-network.decimals).toFixed(),
          gasUsed: txSize,
          gasUsedRatio: 1,
          effectiveGasPrice: gasPrice,
          effectiveGasPriceInGwei: gasPrice,
        };

        const isSend = (tx as { vin: Array<{ isOwn: boolean }> }).vin.some(
          ({ isOwn }) => isOwn,
        );

        if (isSend) {
          item.fromType = 'OUT';
          [item.toAddress] = (
            tx as { vout: Array<{ addresses: Array<string> }> }
          ).vout[0].addresses;
          for (const input of (tx as { vin: Array<any> }).vin) {
            const { isOwn, addresses } = input as {
              isOwn: boolean;
              addresses: Array<string>;
            };
            if (isOwn) {
              [item.fromAddress] = addresses;
              break;
            }
          }
        } else {
          item.fromType = 'IN';
          [item.fromAddress] = (
            tx as { vin: Array<{ addresses: Array<string> }> }
          ).vin[0].addresses;
          for (const output of (tx as { vout: Array<any> }).vout) {
            const { isOwn, addresses } = output as {
              isOwn: boolean;
              addresses: Array<string>;
            };
            if (isOwn) {
              [item.toAddress] = addresses;
              break;
            }
          }
        }

        ret.push(item);
      } catch (e) {
        console.error(e);
      }
    }

    return ret;
  }

  // Chain only functionalities below.

  override validateImportedCredential(input: string): Promise<boolean> {
    let ret = false;
    try {
      ret =
        this.settings.importedAccountEnabled &&
        /^[xyz]prv/.test(input) &&
        (this.engineProvider as Provider).isValidXprv(input);
    } catch {
      // pass
    }
    return Promise.resolve(ret);
  }

  override validateWatchingCredential(input: string): Promise<boolean> {
    let ret = false;
    try {
      ret =
        this.settings.watchingAccountEnabled &&
        /^[xyz]pub/.test(input) &&
        (this.engineProvider as Provider).isValidXpub(input);
    } catch {
      // pass
    }
    return Promise.resolve(ret);
  }

  override createClientFromURL(url: string): BlockBook {
    return new BlockBook(url);
  }

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }

  override async checkAccountExistence(
    accountIdOnNetwork: string,
  ): Promise<boolean> {
    let accountIsPresent = false;
    try {
      const provider = this.engineProvider as Provider;
      const { txs } = (await provider.getAccount({
        type: 'simple',
        xpub: accountIdOnNetwork,
      })) as {
        txs: number;
      };
      accountIsPresent = txs > 0;
    } catch (e) {
      console.error(e);
    }
    return Promise.resolve(accountIsPresent);
  }

  override async getBalances(
    requests: Array<{ address: string; tokenAddress?: string }>,
  ) {
    const { restful } = await (this.engineProvider as Provider).blockbook;
    return Promise.all(
      requests.map(({ address }) =>
        restful
          .get(`/api/v2/xpub/${address}`, { details: 'basic' })
          .then((r) => r.json())
          .then((r: { balance: string; unconfirmedBalance: string }) => {
            const balance = new BigNumber(r.balance);
            const unconfirmedBalance = new BigNumber(r.unconfirmedBalance);
            return !unconfirmedBalance.isNaN() && !unconfirmedBalance.isZero()
              ? balance.plus(unconfirmedBalance)
              : balance;
          })
          .catch(() => undefined),
      ),
    );
  }

  override getPrivateKeyByCredential(credential: string) {
    return bs58check.decode(credential);
  }
}
