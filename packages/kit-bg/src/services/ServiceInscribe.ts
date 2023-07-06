import axios from 'axios';
import BigNumber from 'bignumber.js';
import { cloneDeep, isNil, maxBy } from 'lodash';

import simpleDb from '@onekeyhq/engine/src/dbs/simple/simpleDb';
import {
  getGetblockEndpoint,
  getMempoolEndpoint,
} from '@onekeyhq/engine/src/endpoint';
import {
  decrypt,
  encrypt,
} from '@onekeyhq/engine/src/secret/encryptors/aes256';
import {
  INSCRIBE_ACCOUNT_STORAGE_KEY,
  INSCRIPTION_PADDING_SATS_VALUES,
  MULTIPLE_INSCRIPTIONS_ENABLED,
} from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/consts';
import { InscribeAccount } from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/InscribeAccount';
import {
  Tx,
  secp256k1SchnorrSdk,
} from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/sdk';
import type {
  IInscriptionCategoryType,
  IInscriptionContent,
  IInscriptionContentLite,
  IInscriptionHistory,
  IInscriptionInitRedeemInfo,
  IInscriptionPayload,
  IInscriptionRedeemInfo,
  IInscriptionsOrder,
  ITaprootAddressInfoInscription,
  ITaprootTransaction,
  ITaprootTransactionInput,
  ITaprootTransactionOutput,
  ITaprootTransactionReceivedMoneyInfo,
  Networks,
  ScriptData,
  TxTemplate,
} from '@onekeyhq/engine/src/vaults/impl/btc/inscribe/types';
import type { ISignedTxPro } from '@onekeyhq/engine/src/vaults/types';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import { AddressEncodings } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import {
  decodeBtcRawTx,
  tapRootAccountUtils,
} from '@onekeyhq/engine/src/vaults/utils/btcForkChain/utils';
import type VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';
import {
  convertFeeNativeToValue,
  convertFeeValueToNative,
} from '@onekeyhq/engine/src/vaults/utils/feeInfoUtils';
import { getTimeDurationMs } from '@onekeyhq/kit/src/utils/helper';
import {
  backgroundClass,
  backgroundMethod,
} from '@onekeyhq/shared/src/background/backgroundDecorators';
import { IMPL_BTC, IMPL_TBTC } from '@onekeyhq/shared/src/engine/engineConsts';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import appStorage from '@onekeyhq/shared/src/storage/appStorage';
import bufferUtils from '@onekeyhq/shared/src/utils/bufferUtils';
import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';

import ServiceBase from './ServiceBase';

@backgroundClass()
export default class ServiceInscribe extends ServiceBase {
  @backgroundMethod()
  async fetchFeeRates() {
    const { apiMempool } = await this.getBitcoinNetworkMap();
    // "https://mempool.space/" + mempoolNetwork + "api/v1/fees/recommended"
    const res = await axios.get<{
      fastestFee: number;
      halfHourFee: number;
      hourFee: number;
      economyFee: number;
      minimumFee: number;
    }>(`${apiMempool}/api/v1/fees/recommended`);
    return res.data;
  }

  async fetchAddressUtxo({
    address,
  }: {
    address: string;
  }): Promise<ITaprootTransactionReceivedMoneyInfo | undefined> {
    const { apiMempool } = await this.getBitcoinNetworkMap();
    // TODO auto select utxo
    // https://mempool.space/testnet/api/address/tb1puvc5kvmhhg85l6j222dcd43l46gmrh8ra5cgwpafqerpracs0q0snt8uc9/utxo
    const url = `${apiMempool}/api/address/${address}/utxo`;
    const res = await axios.get<
      Array<{
        txid: string;
        vout: number;
        value: number;
      }>
    >(url);
    const utxoList = res.data || [];
    const maxValueUtxo = maxBy(utxoList, (o) => o.value);

    if (!maxValueUtxo || !utxoList.length) {
      return undefined;
    }
    return {
      txid: maxValueUtxo.txid,
      vout: maxValueUtxo.vout,
      amt: new BigNumber(maxValueUtxo.value).toFixed(),
    };
  }

  getCommitTxInfo({
    address,
    commitSignedTx,
  }: {
    address: string;
    commitSignedTx: ISignedTxPro;
  }): Promise<ITaprootTransactionReceivedMoneyInfo> {
    const { txid } = commitSignedTx;
    const encodedTx = commitSignedTx.encodedTx as IEncodedTxBtc;
    const vout = encodedTx.outputs.findIndex((o) => o.address === address);
    if (isNil(vout)) {
      throw new Error(
        `getCommitTxInfo ERROR: vout not found for address ${address} in tx ${txid}`,
      );
    }
    const amt = encodedTx.outputs[vout]?.value;
    if (
      new BigNumber(amt).lt(
        encodedTx.outputsForCoinSelect[0]?.value ?? Number.MAX_VALUE,
      )
    ) {
      throw new Error(
        `getCommitTxInfo ERROR: amt (${amt}) too small for address ${address} in tx ${txid}`,
      );
    }

    return Promise.resolve({
      txid,
      vout,
      amt,
    });
  }

  async verifyBroadcastTxs({
    rawTxs,
    order,
  }: {
    rawTxs: string[];
    order: IInscriptionsOrder;
  }) {
    const { network } = await this.getBitcoinNetworkMap();
    const commitTxInfo = decodeBtcRawTx(rawTxs[0]);
    const revealTxInfo = decodeBtcRawTx(rawTxs[1]);

    console.log('verifyBroadcastTxs', {
      commitTxInfo,
      revealTxInfo,
      order,
    });

    const commitAddressInfo = tapRootAccountUtils.parseScriptPubKey({
      network,
      scriptPubKey: commitTxInfo.tx.vout[0].scriptPubKey.toString(),
    });
    const commitAmount = commitTxInfo.tx.vout[0].value;

    const revealAddressInfo = tapRootAccountUtils.parseScriptPubKey({
      network,
      scriptPubKey: revealTxInfo.tx.vout[0].scriptPubKey.toString(),
    });
    const revealAmount = revealTxInfo.tx.vout[0].value;

    const revealToCommitMatchedUtxo =
      commitTxInfo.tx.vout[revealTxInfo.tx.vin[0].vout];

    const privateKey = await this.prepareInscribePrivateKey();
    const inscribeAccount = await this.createInscribeAccount({ privateKey });
    const inscribeScript = revealTxInfo.tx.vin[0].witness[1];
    const inscribeAccountAddressInfo = inscribeAccount.createAddressInfo({
      script: inscribeScript,
    });
    /*
      - check tx1 and tx2 signer account matched
      - check funding address and amount matched
      - check receive address and amount matched
      - check tx1 output matched with tx2 input (txid, vout)
    */
    if (
      inscribeScript &&
      revealToCommitMatchedUtxo.scriptPubKey.toString() ===
        commitAddressInfo.scriptPubKey.toString() &&
      revealToCommitMatchedUtxo.value === commitAmount &&
      inscribeAccountAddressInfo.address === commitAddressInfo.address &&
      order.fundingAddress === commitAddressInfo.address &&
      new BigNumber(order.fundingValue).eq(commitAmount as any) &&
      order.toAddress === revealAddressInfo.address &&
      new BigNumber(order.paddingSats).eq(revealAmount as any) &&
      commitTxInfo.txid === revealTxInfo.tx.vin[0].txid
    ) {
      return true;
    }

    throw new Error('verifyBroadcastTxs failed');
  }

  async broadcastTxs(txs: Array<string>): Promise<string[]> {
    const { apiGetblock } = await this.getBitcoinNetworkMap();

    const client = new JsonRPCRequest(apiGetblock);
    const txids = await client.batchCall<string[]>(
      txs.map((rawTx) => ['sendrawtransaction', [rawTx]]),
    );
    return txids;

    // const decodedTx = decodeBtcRawTx(rawTx);
    // const decodedTx2 = decodeBtcRawTx2(rawTx);
    //
    // console.log('decodedTx1', decodedTx);
    // console.log('decodedTx2', decodedTx2);
    // console.log('rawTx', rawTx);
    // return '1111111';
    // https://mempool.space/testnet/api/tx
    // **** broadcast single tx by mempool
    // const url = `${mempool}/api/tx`; // sendTx
    // const res = await axios.request({
    //   url,
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'text/plain;charset=UTF-8',
    //   },
    //   data: rawTx,
    // });
    // const txid: string = res.data;
    // return txid;
  }

  buildRedeemTxInputOutput({
    inscription,
    txInfo,
  }: {
    inscription: IInscriptionPayload;
    txInfo: ITaprootTransactionReceivedMoneyInfo;
  }) {
    const { txid, vout, amt } = txInfo;
    const { paddingSats, toAddressScriptPubKey, fee } = inscription;

    // TODO auto-select utxo?
    const input = [
      {
        txid,
        vout, // TODO get vout from inscription index?
        prevout: {
          value: parseFloat(amt),
          scriptPubKey: inscription.addressInfo.scriptPubKey,
        },
        witness: [
          // sig
          // script
          // cblock
        ],
      },
    ];
    const output = [
      {
        // TODO paddingSats
        // value: amt - inscription.fee,
        value: paddingSats,
        scriptPubKey: toAddressScriptPubKey,
      },
    ];
    const totalOutputAmt = paddingSats + fee;
    const totalInputAmt = parseFloat(amt);

    if (totalInputAmt < totalOutputAmt) {
      throw new Error(
        `Inscribe ERROR: Not enough funds to pay for inscription: ${amt} < ${paddingSats} + ${fee}`,
      );
    }
    const changeValue = totalInputAmt - totalOutputAmt;
    if (changeValue >= 546) {
      // TODO change output of total fee calculation
      output.push({
        value: changeValue,
        scriptPubKey: inscription.addressInfo.scriptPubKey,
      });
    }

    return {
      input,
      output,
    };
  }

  buildInitRedeemTxInputOutput({
    initRedeemInfo,
    txInfo,
  }: {
    initRedeemInfo: IInscriptionInitRedeemInfo;
    txInfo: ITaprootTransactionReceivedMoneyInfo;
  }) {
    const { addressInfo, inscriptions, internalTransferFees, paddingSats } =
      initRedeemInfo;
    const { txid, vout, amt } = txInfo;

    // TODO auto-select utxo?
    const input = [
      {
        txid,
        vout,
        // received sats from wallet account
        prevout: {
          value: parseFloat(amt),
          scriptPubKey: addressInfo.scriptPubKey,
        },
        witness: [],
      },
    ];
    const output = [];

    let totalOutputValue = 0;
    for (let i = 0; i < inscriptions.length; i += 1) {
      const value = paddingSats + inscriptions[i].fee;
      totalOutputValue += value;
      output.push({
        value,
        // send sats to sub account
        scriptPubKey: inscriptions[i].addressInfo.scriptPubKey,
      });
    }
    // change
    const changeValue =
      parseFloat(amt) - totalOutputValue - internalTransferFees;
    // TODO define consts
    if (changeValue >= 546) {
      output.push({
        value: changeValue,
        scriptPubKey: addressInfo.scriptPubKey,
      });
    }
    if (changeValue < 0) {
      throw new Error(
        `Build init inscription tx ERROR: insufficient balance, ${addressInfo.address}`,
      );
    }

    throw new Error('buildInitRedeemTxInputOutput ERROR: not implemented');

    // eslint-disable-next-line no-unreachable
    return {
      input,
      output,
    };
  }

  async buildInscribeTransaction({
    initRedeemInfo,
    redeemInfo,
    commitSignedTx,
  }: {
    initRedeemInfo?: IInscriptionInitRedeemInfo;
    redeemInfo?: IInscriptionRedeemInfo;
    commitSignedTx?: ISignedTxPro;
  }) {
    const address =
      initRedeemInfo?.addressInfo.address ||
      redeemInfo?.inscription.addressInfo.address;
    if (!address) {
      throw new Error('buildInscribeTransaction ERROR: no address provided');
    }
    let txInfo: ITaprootTransactionReceivedMoneyInfo | undefined;
    if (commitSignedTx) {
      if (!commitSignedTx.txid) {
        throw new Error('buildInscribeTransaction ERROR: no txid provided');
      }
      txInfo = await this.getCommitTxInfo({ address, commitSignedTx });
    } else {
      txInfo = await this.fetchAddressUtxo({ address });
    }

    if (!txInfo) {
      throw new Error(
        'buildInscribeTransaction ERROR: no available utxo txInfo provided',
      );
    }

    let input: ITaprootTransactionInput[] = [];
    let output: ITaprootTransactionOutput[] = [];
    if (initRedeemInfo) {
      const res = this.buildInitRedeemTxInputOutput({
        initRedeemInfo,
        txInfo,
      });
      input = res.input;
      output = res.output;
    }

    if (redeemInfo) {
      const { inscription } = redeemInfo;
      const res = this.buildRedeemTxInputOutput({
        txInfo,
        inscription,
      });
      input = res.input;
      output = res.output;
    }

    const tx: ITaprootTransaction = {
      version: 2,
      locktime: 0,
      input,
      output,
    };
    return tx;
  }

  async saveInscriptionHistory({
    order,
    txids,
    commitSignedTx,
  }: {
    order: IInscriptionsOrder;
    txids: string[];
    commitSignedTx?: ISignedTxPro;
  }) {
    let offset = 0;
    if (commitSignedTx) {
      offset = 1;
    }
    for (let i = 0; i < txids.length; i += 1) {
      const inscription = order.inscriptions[i];
      if (!inscription) {
        // eslint-disable-next-line no-continue
        continue;
      }
      const from = inscription.addressInfo.address;
      const { toAddress: to } = order;
      const txid = txids[i + offset];
      const historyItem: IInscriptionHistory = {
        createdAt: Date.now(),
        txid,
        from,
        to,
        fee: inscription.fee,
        paddingSats: inscription.paddingSats,
        previewText: inscription.content.previewText,
        mimetype: inscription.content.mimetype,
        categoryType: inscription.content.categoryType,
        name: inscription.content.name,
      };
      simpleDb.inscribe.savaItem(historyItem);
    }
    return Promise.resolve();
  }

  @backgroundMethod()
  async getOrderHistoryList() {
    return simpleDb.inscribe.getItems();
  }

  async signAndSendAllInscribeTxs({
    order,
    privateKey,
    commitSignedTx,
  }: {
    order: IInscriptionsOrder;
    privateKey: string;
    commitSignedTx?: ISignedTxPro;
  }) {
    console.log('signAndSendAllInscribeTxs', order);
    const { inscriptions } = order;
    const errors: Error[] = [];
    const rawTxs: string[] = [];
    if (commitSignedTx) {
      rawTxs.push(commitSignedTx.rawTx);
    }

    const revealInscriptions = async () => {
      if (inscriptions?.length) {
        for (let i = 0; i < inscriptions.length; i += 1) {
          try {
            const inscription = inscriptions[i];
            const revealTx = await this.buildInscribeTransaction({
              commitSignedTx,
              redeemInfo: {
                inscription,
              },
            });

            const revealTxSigned = await this.signTaprootTx({
              privateKey,
              tx: revealTx,
              leaf: inscription.addressInfo.leaf,
              cBlock: inscription.addressInfo.cBlock,
              script: inscription.script,
            });

            const rawTx = Tx.encode(revealTxSigned).hex;
            rawTxs.push(rawTx);
          } catch (error) {
            console.error(error);
            errors.push(error as Error);
          }
        }
      }
    };

    await revealInscriptions();

    if (commitSignedTx) {
      await this.verifyBroadcastTxs({ rawTxs, order });
    }
    // batch broadcast
    const txids = await this.broadcastTxs(rawTxs);

    try {
      await this.saveInscriptionHistory({
        txids,
        order,
        commitSignedTx,
      });
    } catch (error) {
      console.error(error);
    }

    return { txids, errors };
  }

  async signTaprootTx({
    privateKey,
    tx,
    leaf,
    script,
    cBlock,
  }: {
    privateKey: string;
    tx: ITaprootTransaction;
    leaf: string;
    script: ScriptData;
    cBlock: string;
  }): Promise<TxTemplate | ITaprootTransaction> {
    const txToSign = cloneDeep(tx) as TxTemplate;

    txToSign.vin = tx.input;
    txToSign.vout = tx.output;
    // @ts-ignore
    delete txToSign.input;
    // @ts-ignore
    delete txToSign.output;

    const inscribeAccount = await this.createInscribeAccount({
      privateKey,
    });
    const signature = inscribeAccount.signTransaction({
      txToSign,
      leaf,
      // random,
    });

    const signedTx = txToSign;
    if (signedTx && signedTx?.vin?.[0]) {
      signedTx.vin[0].witness = [
        bufferUtils.bytesToHex(signature),
        script,
        cBlock,
      ];
    }
    return signedTx;
  }

  async getBitcoinNetworkMap(): Promise<{
    network: Networks;
    apiMempool: string;
    apiGetblock: string;
  }> {
    const { networkImpl } = await this.getActiveWalletAccount();
    if (networkImpl === IMPL_BTC) {
      return {
        network: 'main',
        // TODO use current BTC vault blockbook api
        apiMempool: getMempoolEndpoint({ network: 'mainnet' }),
        apiGetblock: getGetblockEndpoint({ chain: 'btc', network: 'mainnet' }),
      };
    }
    if (networkImpl === IMPL_TBTC) {
      return {
        network: 'testnet',
        apiMempool: getMempoolEndpoint({ network: 'testnet' }),
        apiGetblock: getGetblockEndpoint({ chain: 'btc', network: 'testnet' }),
      };
    }
    throw new Error(
      `getBitcoinNetwork ERROR: Unknown network, ${networkImpl ?? 'null'}`,
    );
  }

  prepareInscribePrivateKey = memoizee(
    async () => {
      try {
        const { appSelector } = this.backgroundApi;
        const instanceId = appSelector((s) => s.settings.instanceId);
        let key = await appStorage.getItem(INSCRIBE_ACCOUNT_STORAGE_KEY);
        if (!key) {
          const privateKeyBytes = secp256k1SchnorrSdk.utils.randomPrivateKey();
          const privateKeyEncrypted = encrypt(
            instanceId,
            Buffer.from(privateKeyBytes),
          );
          await appStorage.setItem(
            INSCRIBE_ACCOUNT_STORAGE_KEY,
            bufferUtils.bytesToHex(privateKeyEncrypted),
          );
        }
        key = await appStorage.getItem(INSCRIBE_ACCOUNT_STORAGE_KEY);
        if (!key) {
          throw new Error(
            'prepareInscribePrivateKey: read key from storage failed ',
          );
        }
        const privateKeyBytes = decrypt(
          instanceId,
          Buffer.from(bufferUtils.hexToBytes(key)),
        );
        return bufferUtils.bytesToHex(privateKeyBytes);
      } catch (error) {
        await appStorage.removeItem(INSCRIBE_ACCOUNT_STORAGE_KEY);
        throw new Error('prepareInscribePrivateKey ERROR:  clear storage');
      }
    },
    {
      promise: true,
      max: 1,
      maxAge: getTimeDurationMs({ minute: 5 }),
    },
  );

  async createInscribeAccount({ privateKey }: { privateKey: string }) {
    const { network } = await this.getBitcoinNetworkMap();
    return new InscribeAccount({
      privateKey,
      network,
    });
  }

  async getRecommendPadding(
    inscriptionCategoryType: IInscriptionCategoryType,
  ): Promise<number> {
    if (inscriptionCategoryType === 'file') {
      return Promise.resolve(INSCRIPTION_PADDING_SATS_VALUES.file);
    }
    if (inscriptionCategoryType === 'text') {
      return Promise.resolve(INSCRIPTION_PADDING_SATS_VALUES.text);
    }
    if (inscriptionCategoryType === 'domain') {
      return Promise.resolve(INSCRIPTION_PADDING_SATS_VALUES.text);
    }
    if (inscriptionCategoryType === 'brc20_deploy') {
      return Promise.resolve(INSCRIPTION_PADDING_SATS_VALUES.text);
    }
    if (inscriptionCategoryType === 'brc20_mint') {
      return Promise.resolve(INSCRIPTION_PADDING_SATS_VALUES.text);
    }
    // default padding as of ord native wallet
    return Promise.resolve(INSCRIPTION_PADDING_SATS_VALUES.default);
  }

  async buildInscriptionPayload({
    inscribeAccount,
    content,
    paddingSats,
    toAddressScriptPubKey,
  }: {
    inscribeAccount: InscribeAccount;
    content: IInscriptionContent;
    toAddressScriptPubKey: string;
    paddingSats: number;
  }): Promise<IInscriptionPayload> {
    const ec = new TextEncoder();
    const data = bufferUtils.hexToBytes(content.hex);
    const mimetype = ec.encode(content.mimetype);
    const dataLength = data.length;
    const script = [
      bufferUtils.bytesToHex(inscribeAccount.publicKeyBytes),
      'OP_CHECKSIG',
      'OP_0',
      'OP_IF',
      bufferUtils.bytesToHex(ec.encode('ord')),
      '01',
      bufferUtils.bytesToHex(mimetype),
      'OP_0',
      bufferUtils.bytesToHex(data),
      'OP_ENDIF',
    ];

    const addressInfo = inscribeAccount.createAddressInfo({
      script,
    });

    const contentLite: IInscriptionContentLite = { ...content };
    // @ts-ignore
    delete contentLite?.hex;
    // @ts-ignore
    delete contentLite?.sha256;

    return Promise.resolve({
      addressInfo,
      script,
      content: contentLite,
      dataLength,
      txsize: 0,
      fee: 0,
      paddingSats,
      toAddressScriptPubKey,
    } as IInscriptionPayload);
  }

  // ----------------------------------------------

  @backgroundMethod()
  async createInscriptionContents({
    texts = [],
    domains = [],
    files = [],
  }: {
    texts?: string[];
    domains?: string[];
    files?: Array<{ mimetype: string; data: string; filename: string }>;
    // brc20Deploy?: any[];
  }): Promise<IInscriptionContent[]> {
    const contents: IInscriptionContent[] = [];
    const previewTextSize = 200;

    const buildTextContent = ({
      name,
      text,
      categoryType,
    }: {
      name?: string;
      text: string;
      categoryType: IInscriptionCategoryType;
    }): IInscriptionContent => {
      const mimetype = 'text/plain;charset=utf-8';
      let previewText = text.slice(0, previewTextSize);
      if (previewText.length < text.length) {
        previewText += '...';
      }
      return {
        name: name || '',
        hex: bufferUtils.textToHex(text),
        mimetype,
        sha256: '',
        previewText,
        categoryType: categoryType || 'text',
      };
    };

    for (const text of texts) {
      contents.push(
        buildTextContent({
          categoryType: 'text',
          text,
        }),
      );
    }

    for (const domainText of domains) {
      const domain = domainText.trim();
      const domainJsonText = JSON.stringify({
        'p': 'sns',
        'op': 'reg',
        'name': domain,
      });
      contents.push(
        buildTextContent({
          categoryType: 'domain',
          name: domain,
          text: domainJsonText,
        }),
      );
    }

    for (const file of files) {
      const { mimetype, data, filename } = file;
      contents.push({
        categoryType: 'file',
        name: filename || '',
        hex: bufferUtils.textToHex(data),
        mimetype,
        sha256: '',
        previewText: filename || mimetype,
      });
    }
    return Promise.resolve(contents);
  }

  async checkValidFeeRate({ feeRate }: { feeRate?: number }) {
    if (!feeRate || isNil(feeRate)) {
      throw new Error('createInscribeOrder ERROR: feeRate is not defined');
    }
    return Promise.resolve(true);
  }

  async checkValidPadding({ padding }: { padding: number }) {
    if (padding < INSCRIPTION_PADDING_SATS_VALUES.$min)
      throw new Error(
        `Padding is too small, min ${INSCRIPTION_PADDING_SATS_VALUES.$min}`,
      );
    if (padding > INSCRIPTION_PADDING_SATS_VALUES.$max)
      throw new Error(
        `Padding is too large, max ${INSCRIPTION_PADDING_SATS_VALUES.$max}`,
      );
    return Promise.resolve(true);
  }

  async getActiveBtcVault() {
    const { engine } = this.backgroundApi;
    const { networkId, accountId } = await this.getActiveWalletAccount();
    const vault = await engine.getVault({ networkId, accountId });
    return vault as VaultBtcFork;
  }

  @backgroundMethod()
  async checkValidTaprootAddress({ address }: { address: string }) {
    await this.getBitcoinNetworkMap();
    const btcVault = await this.getActiveBtcVault();
    const provider = await btcVault.getProvider();
    const result = provider.verifyAddress(address);
    if (result?.encoding === AddressEncodings.P2TR && result?.isValid) {
      return true;
    }
    throw new Error(`InscribeOrder ERROR: Invalid Taproot address:${address}`);
  }

  @backgroundMethod()
  async buildInscribeCommitEncodedTx({
    to,
    amount,
  }: {
    to: string;
    amount: string;
  }): Promise<IEncodedTxBtc | undefined> {
    const btcVault = await this.getActiveBtcVault();
    const { network } = await this.getActiveWalletAccount();
    const address = await btcVault.getAccountAddress();
    const utxoInfo = await this.fetchAddressUtxo({ address: to });
    if (utxoInfo && utxoInfo.amt && network) {
      const amountValue = convertFeeNativeToValue({ value: amount, network });
      if (new BigNumber(utxoInfo.amt).gte(amountValue)) {
        return undefined;
      }
    }
    const encodedTx = await btcVault.buildEncodedTxFromTransfer({
      from: address,
      to,
      amount,
      coinControlDisabled: true,
      coinSelectAlgorithm: 'accumulative_desc',
    });
    return encodedTx;
  }

  @backgroundMethod()
  async createInscribeOrder({
    toAddress,
    contents,
    feeRate,
    globalPaddingSats = INSCRIPTION_PADDING_SATS_VALUES.default,
  }: {
    toAddress: string;
    contents: IInscriptionContent[];
    feeRate?: number;
    globalPaddingSats?: number;
  }): Promise<IInscriptionsOrder> {
    await this.checkValidTaprootAddress({ address: toAddress });
    await this.checkValidPadding({ padding: globalPaddingSats });
    const paddingSats = globalPaddingSats;
    const privateKey = await this.prepareInscribePrivateKey();
    const inscribeAccount = await this.createInscribeAccount({ privateKey });
    if (isNil(feeRate)) {
      const rates = await this.fetchFeeRates();
      // eslint-disable-next-line no-param-reassign
      feeRate = rates.halfHourFee;
    }
    await this.checkValidFeeRate({ feeRate });

    const inscriptions: IInscriptionPayload[] = [];
    let totalInscriptionsFee = 0;
    let baseSize = 160;

    const parsedAddressInfo = tapRootAccountUtils.parseAddress({
      address: toAddress,
    });

    const toAddressTapKey = parsedAddressInfo.tapKey;
    const toAddressScriptPubKey = parsedAddressInfo.scriptPubKey;

    for (let i = 0; i < contents.length; i += 1) {
      const content = contents[i];

      const payload = await this.buildInscriptionPayload({
        content,
        inscribeAccount,
        paddingSats,
        toAddressScriptPubKey,
      });
      const { dataLength } = payload;

      let txsize = 600 + Math.floor(dataLength / 4);
      if (!content.sha256) {
        // TODO why
        baseSize = Math.floor(dataLength / 4) * i;
        txsize = 200 + Math.floor(dataLength / 4);
      }
      console.log('TXSIZE', txsize);
      // TODO use BigNumber
      const fee = feeRate * txsize;
      totalInscriptionsFee += fee;

      inscriptions.push({
        ...payload,
        txsize,
        fee,
      });
    }

    const shouldCreateInternalTransferTx = inscriptions.length > 1;
    let fundingAddress = '';
    let fundingAddressInfo: ITaprootAddressInfoInscription | undefined;
    let initRedeemInfo: IInscriptionInitRedeemInfo | undefined;

    let internalTransferFees = 0;
    let totalFees = 0;

    if (shouldCreateInternalTransferTx) {
      // TODO big number
      // TODO shouldCreateInitRedeemTx totalFees
      internalTransferFees = 550 + baseSize * inscriptions.length;
      // TODO totalFees if change output added?
      totalFees =
        internalTransferFees +
        totalInscriptionsFee +
        paddingSats * inscriptions.length;

      const initScript = [inscribeAccount.publicKeyBytes, 'OP_CHECKSIG'];

      const addressInfo = inscribeAccount.createAddressInfo({
        script: initScript,
      });
      fundingAddress = addressInfo.address;
      initRedeemInfo = {
        addressInfo,
        script: initScript,
        inscriptions,
        internalTransferFees,
        paddingSats,
      };
      if (!MULTIPLE_INSCRIPTIONS_ENABLED) {
        throw new Error(
          'createInscriptionsOrder ERROR: create multiple inscriptions not supported yet',
        );
      }
    } else {
      fundingAddressInfo = inscriptions[0].addressInfo;
      fundingAddress = fundingAddressInfo.address;
      internalTransferFees = 0;
      totalFees =
        internalTransferFees +
        totalInscriptionsFee +
        paddingSats * inscriptions.length;
    }

    const { network } =
      await this.backgroundApi.serviceNetwork.getActiveWalletAccount();

    const fundingValue = totalFees;
    let fundingValueNative = '';
    if (network) {
      fundingValueNative = convertFeeValueToNative({
        value: new BigNumber(fundingValue).toFixed(),
        network,
      });
    }

    const order: IInscriptionsOrder = {
      network: inscribeAccount.network,
      fundingAddressInfo,
      fundingAddress,
      fundingValue, // TODO skip funding if reveal address has enough balance
      fundingValueNative,
      initRedeemInfo,
      inscriptions,
      totalFees, // sats
      internalTransferFees, // sats
      toAddressScriptPubKey,
      toAddressTapKey,
      toAddress,
      paddingSats,
      createdAt: Date.now(),
    };
    return Promise.resolve(order);
  }

  @backgroundMethod()
  async submitInscribeOrder({
    order,
    commitSignedTx,
  }: {
    order: IInscriptionsOrder;
    commitSignedTx?: ISignedTxPro;
  }) {
    if (!order) {
      throw new Error('submitInscribeOrder ERROR: order not found');
    }
    try {
      const privateKey = await this.prepareInscribePrivateKey();
      return await this.signAndSendAllInscribeTxs({
        order,
        privateKey,
        commitSignedTx,
      });
    } finally {
      // noop
    }
  }
}
