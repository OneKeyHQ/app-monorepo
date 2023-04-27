/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/require-await */
import { hexToBytes } from '@noble/hashes/utils';
import BigNumber from 'bignumber.js';
import { groupBy } from 'lodash';
import memoizee from 'memoizee';

import type { DBSimpleAccount } from '@onekeyhq/engine/src/types/account';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';

import { InvalidAddress, OneKeyInternalError } from '../../../errors';
import { decrypt } from '../../../secret/encryptors/aes256';
import { TransactionStatus } from '../../../types/provider';
import {
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  IEncodedTxUpdateType,
} from '../../types';
import { convertFeeValueToGwei } from '../../utils/feeInfoUtils';
import { VaultBase } from '../../VaultBase';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import {
  CONFIRMATION_COUNT,
  DUST_AMOUNT,
  MAX_BLOCK_SIZE,
  MAX_SOMPI,
  MINIMUM_RELAY_TRANSACTION_FEE,
  RestAPIClient,
  isValidAddress,
  privateKeyFromBuffer,
  privateKeyFromWIF,
  queryConfirmUTXOs,
  selectUTXOs,
} from './sdk';
import { toTransaction } from './sdk/transaction';
import settings from './settings';

import type { KeyringSoftwareBase } from '../../keyring/KeyringSoftwareBase';
import type {
  IDecodedTx,
  IDecodedTxActionNativeTransfer,
  IDecodedTxLegacy,
  IEncodedTxUpdateOptions,
  IEncodedTxUpdatePayloadTransfer,
  IFeeInfo,
  IFeeInfoUnit,
  IHistoryTx,
  ISignedTxPro,
  ITransferInfo,
  IUnsignedTxPro,
} from '../../types';
import type { TxInput } from '../../utils/btcForkChain/types';
import type { IEncodedTxKaspa } from './types';

// @ts-ignore
export default class Vault extends VaultBase {
  keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  settings = settings;

  getClientCache = memoizee(async (rpcUrl) => this.getKaspaClient(rpcUrl), {
    promise: true,
    max: 1,
    maxAge: getTimeDurationMs({ minute: 3 }),
  });

  async getClient() {
    const rpcURL = await this.getRpcUrl();
    return this.getClientCache(rpcURL);
  }

  getKaspaClient(url: string) {
    // client: axios
    return new RestAPIClient(url);
  }

  // Chain only methods

  override async getClientEndpointStatus(
    url: string,
  ): Promise<{ responseTime: number; latestBlock: number }> {
    const client = await this.getClientCache(url);

    const start = performance.now();
    const { virtualDaaScore: blockNumber } = await client.getNetworkInfo();
    const latestBlock = parseInt(blockNumber);
    return { responseTime: Math.floor(performance.now() - start), latestBlock };
  }

  override async getBalances(
    requests: { address: string; tokenAddress?: string | undefined }[],
  ): Promise<(BigNumber | undefined)[]> {
    const client = await this.getClient();

    const requestAddress = groupBy(requests, (request) => request.address);

    const balances = new Map<string, BigNumber>();
    await Promise.all(
      Object.entries(requestAddress).map(async ([address, tokens]) => {
        try {
          const balance = await client.queryBalance(address);
          try {
            balances.set(address, new BigNumber(balance.toString()));
          } catch (e) {
            // ignore
          }
        } catch (error) {
          // ignore account error
        }
      }),
    );

    return requests.map((req) => {
      const { address } = req;
      return balances.get(address) ?? new BigNumber(0);
    });
  }

  override async buildEncodedTxFromTransfer(
    transferInfo: ITransferInfo,
    specifiedFeeLimit?: string,
  ): Promise<IEncodedTxKaspa> {
    const { to, amount, token: tokenAddress } = transferInfo;
    if (tokenAddress)
      throw new OneKeyInternalError('Kaspa does not support token transfer');

    const client = await this.getClient();
    const { address: from } = await this.getDbAccount();

    const network = await this.getNetwork();
    const amountValue = new BigNumber(amount)
      .shiftedBy(network.decimals)
      .toFixed();

    if (new BigNumber(amountValue).isLessThanOrEqualTo(DUST_AMOUNT)) {
      throw new OneKeyInternalError('Amount is too small');
    }

    const feeRate = convertFeeValueToGwei({ value: '1', network });

    const confirmUtxos = await queryConfirmUTXOs(client, from);

    const { utxoIds, utxos, mass } = selectUTXOs(
      confirmUtxos,
      parseInt(amountValue),
    );

    const limit = specifiedFeeLimit ?? mass.toString();

    const hasMaxSend = utxos
      .reduce((v, { satoshis }) => v.plus(satoshis), new BigNumber('0'))
      .shiftedBy(-network.decimals)
      .lte(amount);

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
      mass: parseInt(limit),
    };
  }

  override async buildUnsignedTxFromEncodedTx(
    encodedTx: IEncodedTxKaspa,
  ): Promise<IUnsignedTxPro> {
    const { inputs, outputs } = encodedTx;
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;

    // const publicKey = publicKeyFromOriginPubkey(
    //   Buffer.from(hexToBytes(dbAccount.pub)),
    // )
    //   .toBuffer()
    //   .toString('hex');

    const inputsInUnsignedTx: TxInput[] = [];
    for (const input of inputs) {
      const value = new BigNumber(input.satoshis);
      inputsInUnsignedTx.push({
        address: input.address.toString(),
        value,
        // publicKey,
        utxo: { txid: input.txId, vout: input.outputIndex, value },
      });
    }
    const outputsInUnsignedTx = outputs.map(({ address, value }) => ({
      address,
      value: new BigNumber(value),
      payload: {},
    }));

    const ret = {
      inputs: inputsInUnsignedTx,
      outputs: outputsInUnsignedTx,
      payload: {},
      encodedTx,
    };

    return Promise.resolve(ret);
  }

  decodedTxToLegacy(decodedTx: IDecodedTx): Promise<IDecodedTxLegacy> {
    return Promise.resolve({} as IDecodedTxLegacy);
  }

  async decodeTx(
    encodedTx: IEncodedTxKaspa,
    payload?: any,
  ): Promise<IDecodedTx> {
    const { inputs, outputs } = encodedTx;

    const network = await this.engine.getNetwork(this.networkId);
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const token = await this.engine.getNativeTokenInfo(this.networkId);

    const nativeTransfer: IDecodedTxActionNativeTransfer = {
      tokenInfo: token,
      utxoFrom: inputs.map((input) => ({
        address: input.address.toString(),
        balance: new BigNumber(input.satoshis.toString())
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: input.satoshis?.toString() ?? '0',
        symbol: network.symbol,
        isMine: true,
      })),
      utxoTo: outputs.map((output) => ({
        address: output.address,
        balance: new BigNumber(output.value)
          .shiftedBy(-network.decimals)
          .toFixed(),
        balanceValue: output.value.toString(),
        symbol: network.symbol,
        isMine: false, // output.address === dbAccount.address,
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
      totalFeeInNative: encodedTx.feeInfo?.limit ?? '0',
    };
  }

  // Max send
  async updateEncodedTx(
    encodedTx: IEncodedTxKaspa,
    payload: IEncodedTxUpdatePayloadTransfer,
    options: IEncodedTxUpdateOptions,
  ): Promise<IEncodedTxKaspa> {
    const { outputs } = encodedTx;
    if (options.type === IEncodedTxUpdateType.transfer && outputs.length > 0) {
      const network = await this.getNetwork();

      const sendAmount = new BigNumber(payload.amount)
        .shiftedBy(network.decimals)
        .toFixed();

      return Promise.resolve({
        ...encodedTx,
        hasMaxSend: true,
        outputs: [
          {
            address: outputs[0].address,
            value: sendAmount,
          },
        ],
      });
    }
    return Promise.resolve(encodedTx);
  }

  minimumRequiredTransactionRelayFee(mass: number): number {
    let minimumFee = (mass * MINIMUM_RELAY_TRANSACTION_FEE) / 1000;

    if (minimumFee === 0 && MINIMUM_RELAY_TRANSACTION_FEE > 0) {
      minimumFee = MINIMUM_RELAY_TRANSACTION_FEE;
    }

    // Set the minimum fee to the maximum possible value if the calculated
    // fee is not in the valid range for monetary amounts.
    if (minimumFee > MAX_SOMPI) {
      minimumFee = MAX_SOMPI;
    }

    return minimumFee;
  }

  async fetchFeeInfo(encodedTx: IEncodedTxKaspa): Promise<IFeeInfo> {
    const network = await this.engine.getNetwork(this.networkId);

    const txn = toTransaction(encodedTx);
    const { txSize, mass } = txn.getMassAndSize();

    const dataFee = this.minimumRequiredTransactionRelayFee(mass);

    if (txSize > MAX_BLOCK_SIZE) {
      throw new Error('Transaction size is too large');
    }

    const price = convertFeeValueToGwei({ value: '1', network });

    return {
      nativeSymbol: network.symbol,
      nativeDecimals: network.decimals,
      feeSymbol: network.feeSymbol,
      feeDecimals: network.feeDecimals,

      limit: new BigNumber(dataFee ?? '1').multipliedBy(1.1).toFixed(0),
      prices: [price],
      defaultPresetIndex: '0',
    };
  }

  async attachFeeInfoToEncodedTx(params: {
    encodedTx: IEncodedTxKaspa;
    feeInfoValue: IFeeInfoUnit;
  }): Promise<IEncodedTxKaspa> {
    const { price, limit } = params.feeInfoValue;

    if (typeof price !== 'undefined' && typeof price !== 'string') {
      throw new OneKeyInternalError('Invalid gas price.');
    }
    if (typeof limit !== 'string') {
      throw new OneKeyInternalError('Invalid fee limit');
    }

    return Promise.resolve({
      ...params.encodedTx,
      feeInfo: {
        price,
        limit,
      },
      mass: parseInt(limit ?? '1000'),
    });
  }

  override async broadcastTransaction(
    signedTx: ISignedTxPro,
  ): Promise<ISignedTxPro> {
    const client = await this.getClient();
    const { rawTx } = signedTx;
    const txid = await client.sendRawTransaction(rawTx);
    return {
      ...signedTx,
      txid,
    };
  }

  async getExportedCredential(password: string): Promise<string> {
    const dbAccount = await this.getDbAccount();
    if (dbAccount.id.startsWith('hd-') || dbAccount.id.startsWith('imported')) {
      const keyring = this.keyring as KeyringSoftwareBase;
      const [encryptedPrivateKey] = Object.values(
        await keyring.getPrivateKeys(password),
      );
      const chainId = await this.getNetworkChainId();
      const privateKey = privateKeyFromBuffer(
        decrypt(password, encryptedPrivateKey),
        chainId,
      );
      return privateKey.toWIF();
    }
    throw new OneKeyInternalError(
      'Only credential of HD or imported accounts can be exported',
    );
  }

  override async getTransactionStatuses(
    txids: string[],
  ): Promise<(TransactionStatus | undefined)[]> {
    const client = await this.getClient();

    const { virtualDaaScore: blockNumber } = await client.getNetworkInfo();
    const txs = await client.getTransactions(txids);

    const txStatuses = new Map<string, TransactionStatus>();
    for (const tx of txs) {
      let status = TransactionStatus.PENDING;
      if (
        tx.accepting_block_blue_score &&
        new BigNumber(blockNumber)
          .minus(tx.accepting_block_blue_score)
          .isGreaterThanOrEqualTo(CONFIRMATION_COUNT)
      ) {
        status = TransactionStatus.CONFIRM_AND_SUCCESS;
      }
      txStatuses.set(tx.transaction_id, status);
    }

    return txids.map((txid) => txStatuses.get(txid));
  }

  override async fetchOnChainHistory(options: {
    tokenIdOnNetwork?: string;
    localHistory?: IHistoryTx[];
  }): Promise<IHistoryTx[]> {
    const { localHistory = [], tokenIdOnNetwork } = options;
    if (tokenIdOnNetwork) {
      // No token support now.
      return Promise.resolve([]);
    }

    const client = await this.getClient();
    const dbAccount = (await this.getDbAccount()) as DBSimpleAccount;
    const { decimals, symbol } = await this.engine.getNativeTokenInfo(
      this.networkId,
    );

    const { virtualDaaScore: blockNumber } = await client.getNetworkInfo();
    const token = await this.engine.getNativeTokenInfo(this.networkId);
    const explorerTxs = await client.getTransactionsByAddress(
      dbAccount.address,
    );

    const promises = explorerTxs.map(async (tx) => {
      const historyTxToMerge = localHistory.find(
        (item) => item.decodedTx.txid === tx.transaction_id,
      );
      if (historyTxToMerge && historyTxToMerge.decodedTx.isFinal) {
        // No need to update.
        return Promise.resolve(null);
      }

      try {
        const { inputs, outputs } = tx;
        const nativeTransfer: IDecodedTxActionNativeTransfer = {
          tokenInfo: token,
          utxoFrom: inputs.map((input) => ({
            address: input.previous_outpoint_address,
            balance: new BigNumber(input.previous_outpoint_amount.toString())
              .shiftedBy(-decimals)
              .toFixed(),
            balanceValue: input.previous_outpoint_amount?.toString() ?? '0',
            symbol,
            isMine: true,
          })),
          utxoTo: outputs.map((output) => ({
            address: output.script_public_key_address,
            balance: new BigNumber(output.amount.toString())
              .shiftedBy(-decimals)
              .toFixed(),
            balanceValue: output.amount.toString(),
            symbol,
            isMine: output.script_public_key_address === dbAccount.address,
          })),
          from: inputs[0].previous_outpoint_address,
          to: outputs[0].script_public_key_address,
          amount: new BigNumber(outputs[0].amount.toString())
            .shiftedBy(-decimals)
            .toFixed(),
          amountValue: outputs[0].amount.toString(),
          extraInfo: null,
        };

        const decodedTx: IDecodedTx = {
          txid: tx.transaction_id,
          owner: dbAccount.address,
          signer: dbAccount.address,
          nonce: 0,
          actions: [
            {
              type: IDecodedTxActionType.NATIVE_TRANSFER,
              nativeTransfer,
            },
          ],
          status: new BigNumber(blockNumber)
            .minus(tx.accepting_block_blue_score)
            .isGreaterThanOrEqualTo(CONFIRMATION_COUNT)
            ? IDecodedTxStatus.Confirmed
            : IDecodedTxStatus.Pending,
          networkId: this.networkId,
          accountId: this.accountId,
          extraInfo: null,
          totalFeeInNative: new BigNumber(tx.mass)
            .shiftedBy(-decimals)
            .toFixed(),
        };
        decodedTx.updatedAt =
          typeof tx.block_time !== 'undefined' ? tx.block_time : Date.now();
        decodedTx.createdAt =
          historyTxToMerge?.decodedTx.createdAt ?? decodedTx.updatedAt;
        decodedTx.isFinal = decodedTx.status === IDecodedTxStatus.Confirmed;

        return await this.buildHistoryTx({
          decodedTx,
          historyTxToMerge,
        });
      } catch (e) {
        // Ignore error.
      }
    });

    return (await Promise.all(promises)).filter(Boolean);
  }

  // ===== validate util =====
  override async validateAddress(address: string) {
    const chainId = await this.getNetworkChainId();
    if (isValidAddress(address, chainId)) return Promise.resolve(address);
    return Promise.reject(new InvalidAddress());
  }

  override async validateWatchingCredential(input: string) {
    return this.validateAddress(input)
      .then((address) => this.settings.watchingAccountEnabled && !!address)
      .catch(() => false);
  }

  override async validateImportedCredential(input: string): Promise<boolean> {
    // Generic private key test, override if needed.
    return Promise.resolve(
      this.settings.importedAccountEnabled &&
        (this.isHexPrivateKey(input) || this.isWIFPrivateKey(input)),
    );
  }

  isHexPrivateKey(input: string) {
    return /^(0x)?[0-9a-zA-Z]{64}$/.test(input);
  }

  isWIFPrivateKey(input: string) {
    return /^[5KL][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(input);
  }

  override async getPrivateKeyByCredential(
    credential: string,
  ): Promise<Buffer | undefined> {
    if (this.isHexPrivateKey(credential)) {
      return Promise.resolve(
        Buffer.from(
          credential.startsWith('0x') ? credential.slice(2) : credential,
          'hex',
        ),
      );
    }

    if (this.isWIFPrivateKey(credential)) {
      const privateKey = privateKeyFromWIF(credential);
      return Promise.resolve(Buffer.from(hexToBytes(privateKey.toString())));
    }

    return undefined;
  }
}
