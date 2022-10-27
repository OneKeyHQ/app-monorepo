/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */

import { BaseClient } from '@onekeyfe/blockchain-libs/dist/provider/abc';
import { decrypt } from '@onekeyfe/blockchain-libs/dist/secret/encryptors/aes256';
import { TransactionStatus } from '@onekeyfe/blockchain-libs/dist/types/provider';
import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';
// @ts-expect-error
import coinSelect from 'coinselect';
// @ts-expect-error
import coinSelectSplit from 'coinselect/split';
import memoizee from 'memoizee';

import {
  IBlockBookTransaction,
  IEncodedTxBtc,
  IUTXOInput,
  IUTXOOutput,
  PartialTokenInfo,
  TxInput,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { COINTYPE_BTC, IMPL_BCH } from '../../../constants';
import { ExportedPrivateKeyCredential } from '../../../dbs/base';
import {
  InsufficientBalance,
  InvalidAddress,
  NotImplemented,
  OneKeyInternalError,
} from '../../../errors';
import { DBUTXOAccount } from '../../../types/account';
import { EVMDecodedTxType } from '../../impl/evm/decoder/types';
import { KeyringBaseMock } from '../../keyring/KeyringBase';
import { KeyringHdBase } from '../../keyring/KeyringHdBase';
import {
  IApproveInfo,
  IDecodedTx,
  IDecodedTxActionNativeTransfer,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxLegacy,
  IDecodedTxStatus,
  IEncodedTx,
  IEncodedTxUpdateOptions,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTx,
  ITransferInfo,
  IUnsignedTxPro,
  IVaultSettings,
} from '../../types';
import { IKeyringMapKey, VaultBase } from '../../VaultBase';

import { Provider } from './provider';
import { BlockBook } from './provider/blockbook';
import { getAccountDefaultByPurpose } from './utils';

type ArrElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;

export default class VaultBtcFork extends VaultBase {
  keyringMap = {} as Record<IKeyringMapKey, typeof KeyringBaseMock>;

  settings = {} as IVaultSettings;

  private provider?: Provider;

  getDefaultPurpose() {
    return 49;
  }

  getCoinName() {
    return 'BTC';
  }

  getCoinType() {
    return COINTYPE_BTC;
  }

  getXprvReg() {
    return /^[xyz]prv/;
  }

  getXpubReg() {
    return /^[xyz]pub/;
  }

  getDefaultBlockNums() {
    return [5, 2, 1];
  }

  getDefaultBlockTime() {
    return 600;
  }

  async getProvider() {
    if (!this.provider) {
      const chainInfo =
        await this.engine.providerManager.getChainInfoByNetworkId(
          this.networkId,
        );
      this.provider = new Provider(chainInfo);
    }
    return this.provider;
  }

  override async validateAddress(address: string): Promise<string> {
    const provider = await this.getProvider();
    const { normalizedAddress, isValid } = provider.verifyAddress(address);
    if (!isValid || typeof normalizedAddress === 'undefined') {
      throw new InvalidAddress();
    }
    return Promise.resolve(normalizedAddress);
  }

  override async validateImportedCredential(input: string): Promise<boolean> {
    const xprvReg = this.getXprvReg();
    let ret = false;
    try {
      ret =
        this.settings.importedAccountEnabled &&
        xprvReg.test(input) &&
        (await this.getProvider()).isValidXprv(input);
    } catch {
      // pass
    }
    return Promise.resolve(ret);
  }

  override async validateWatchingCredential(input: string): Promise<boolean> {
    const xpubReg = this.getXpubReg();
    let ret = false;
    try {
      ret =
        this.settings.watchingAccountEnabled &&
        xpubReg.test(input) &&
        (await this.getProvider()).isValidXpub(input);
    } catch {
      // ignore
    }
    return Promise.resolve(ret);
  }

  override async checkAccountExistence(
    accountIdOnNetwork: string,
  ): Promise<boolean> {
    let accountIsPresent = false;
    try {
      const provider = await this.getProvider();
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

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    return (await this.getProvider()).getBalances(requests);
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;

    if (dbAccount.id.startsWith('hd-')) {
      const purpose = parseInt(dbAccount.path.split('/')[1]);
      const { addressEncoding } = getAccountDefaultByPurpose(
        purpose,
        this.getCoinName(),
      );
      const { network } = await this.getProvider();
      const { private: xprvVersionBytes } =
        (network.segwitVersionBytes || {})[addressEncoding] || network.bip32;

      const keyring = this.keyring as KeyringHdBase;
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
    // Select the slowest fee rate as default, otherwise the UTXO selection
    // would be failed.
    // SpecifiedFeeRate is from UI layer and is in BTC/byte, convert it to sats/byte
    const feeRate =
      typeof specifiedFeeRate !== 'undefined'
        ? new BigNumber(specifiedFeeRate)
            .shiftedBy(network.feeDecimals)
            .toFixed()
        : (await this.getFeeRate())[0];
    const max = utxos
      .reduce((v, { value }) => v.plus(value), new BigNumber('0'))
      .shiftedBy(-network.decimals)
      .lte(amount);

    const unspentSelectFn = max ? coinSelectSplit : coinSelect;
    const {
      inputs,
      outputs,
      fee,
    }: {
      inputs: IUTXOInput[];
      outputs: IUTXOOutput[];
      fee: number;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    } = unspentSelectFn(
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

    const inputsInUnsignedTx: TxInput[] = [];
    for (const input of inputs) {
      const value = new BigNumber(input.value);
      inputsInUnsignedTx.push({
        address: input.address,
        value,
        utxo: { txid: input.txid, vout: input.vout, value },
      });
    }
    const outputsInUnsignedTx = outputs.map(({ address, value }) => ({
      address,
      value: new BigNumber(value),
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
    const blockNums = this.getDefaultBlockNums();
    return {
      customDisabled: true,
      limit: (feeLimit ?? new BigNumber(0)).toFixed(), // bytes in BTC
      prices,
      waitingSeconds: blockNums.map(
        (numOfBlocks) => numOfBlocks * this.getDefaultBlockTime(),
      ),
      defaultPresetIndex: '1',
      feeSymbol: 'BTC',
      feeDecimals: network.feeDecimals,
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      tx: null, // Must be null if network not support feeInTx
    };
  }

  override async broadcastTransaction(signedTx: ISignedTx): Promise<ISignedTx> {
    debugLogger.engine.info('broadcastTransaction START:', {
      rawTx: signedTx.rawTx,
    });
    const provider = await this.getProvider();
    const txid = await provider.broadcastTransaction(signedTx.rawTx);
    debugLogger.engine.info('broadcastTransaction END:', {
      txid,
      rawTx: signedTx.rawTx,
    });
    return {
      ...signedTx,
      txid,
    };
  }

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    return (await this.getProvider()).getTransactionStatuses(txids);
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [] } = options;

    const provider = await this.getProvider();
    const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
    const { decimals, symbol } = await this.engine.getNetwork(this.networkId);
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    let txs: Array<IBlockBookTransaction> = [];
    try {
      txs =
        (
          (await provider.getAccount({
            type: 'history',
            xpub: dbAccount.xpub,
          })) as { transactions: Array<IBlockBookTransaction> }
        ).transactions ?? [];
    } catch (e) {
      console.error(e);
    }

    // Temporary solution to nownode blockbook bch data inconsistency problem
    const impl = await this.getNetworkImpl();
    const isMineFn = (
      i:
        | ArrElement<IBlockBookTransaction['vin']>
        | ArrElement<IBlockBookTransaction['vout']>,
    ) => {
      if (impl !== IMPL_BCH) {
        return i.isOwn ?? false;
      }
      return i.addresses.some((address) => address === dbAccount.address);
    };

    const promises = txs.map((tx) => {
      try {
        const historyTxToMerge = localHistory.find(
          (item) => item.decodedTx.txid === tx.txid,
        );
        if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
          // No need to update.
          return null;
        }
        const utxoFrom = tx.vin.map((input) => ({
          address: input.isAddress ?? false ? input.addresses[0] : '',
          balance: new BigNumber(input.value).shiftedBy(-decimals).toFixed(),
          balanceValue: input.value,
          symbol,
          isMine: isMineFn(input),
        }));
        const utxoTo = tx.vout.map((output) => ({
          address: output.isAddress ?? false ? output.addresses[0] : '',
          balance: new BigNumber(output.value).shiftedBy(-decimals).toFixed(),
          balanceValue: output.value,
          symbol,
          isMine: isMineFn(output),
        }));

        const totalOut = BigNumber.sum(
          ...utxoFrom.map(({ balanceValue, isMine }) =>
            isMine ? balanceValue : '0',
          ),
        );
        const totalIn = BigNumber.sum(
          ...utxoTo.map(({ balanceValue, isMine }) =>
            isMine ? balanceValue : '0',
          ),
        );
        let direction = IDecodedTxDirection.IN;
        if (totalOut.gt(totalIn)) {
          direction = utxoTo.every(({ isMine }) => isMine)
            ? IDecodedTxDirection.SELF
            : IDecodedTxDirection.OUT;
        }
        let amountValue = totalOut.minus(totalIn).abs();
        if (
          direction === IDecodedTxDirection.OUT &&
          utxoFrom.every(({ isMine }) => isMine)
        ) {
          // IF the transaction's direction is out and all inputs are from
          // current account, substract the fees from the net output amount
          // to give an exact sending amount value.
          amountValue = amountValue.minus(tx.fees);
        }

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
                from: utxoFrom.find((utxo) => !!utxo.address)?.address ?? '',
                to: utxoTo.find((utxo) => !!utxo.address)?.address ?? '',
                amount: amountValue.shiftedBy(-decimals).toFixed(),
                amountValue: amountValue.toFixed(),
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

  collectUTXOs = memoizee(
    async () => {
      const provider = await this.getProvider();
      const dbAccount = (await this.getDbAccount()) as DBUTXOAccount;
      try {
        return await provider.getUTXOs(dbAccount.xpub);
      } catch (e) {
        console.error(e);
        throw new OneKeyInternalError('Failed to get UTXOs of the account.');
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: 1000 * 30,
    },
  );

  private getFeeRate = memoizee(
    async () => {
      const client = await (await this.getProvider()).blockbook;
      const blockNums = this.getDefaultBlockNums();
      try {
        return await Promise.all(
          blockNums.map((blockNum) =>
            client
              .estimateFee(blockNum)
              .then((feeRate) => new BigNumber(feeRate).toFixed(0)),
          ),
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

  createClientFromURL(url: string) {
    return new BlockBook(url) as unknown as BaseClient;
  }

  fetchTokenInfos(
    tokenAddresses: string[],
  ): Promise<Array<PartialTokenInfo | undefined>> {
    throw new NotImplemented();
  }
}
