import debugLogger from '@onekeyhq/shared/src/logger/debugLogger';

import { TxStatus } from '../../../../types/covalent';
import { ethers } from '../sdk/ethers';

import { ABI } from './abi';
import { parseGasInfo, updateGasInfo } from './gasParser';
import { updateWithHistoryEntry } from './historyParser';
import { parsePayload } from './payloadParser';
import { EVMDecodedTxType } from './types';
import { isEvmNativeTransferType, jsonToEthersTx } from './util';

import type { Engine } from '../../../..';
import type { Transaction } from '../../../../types/covalent';
import type { HistoryEntryTransaction } from '../../../../types/history';
import type VaultEvm from '../Vault';
import type {
  EVMBaseDecodedItem,
  EVMDecodedItem,
  EVMDecodedItemERC20Approve,
  EVMDecodedItemERC20Transfer,
  EVMDecodedItemInternalSwap,
} from './types';

export const InfiniteAmountText = 'Infinite';
export const InfiniteAmountHex =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

class EVMTxDecoder {
  private static sharedDecoder: EVMTxDecoder;

  private engine: Engine;

  private erc20Iface: ethers.utils.Interface;

  private erc721Iface: ethers.utils.Interface;

  private erc1155Iface: ethers.utils.Interface;

  private batchTransferIface: ethers.utils.Interface;

  private constructor(engine: Engine) {
    this.engine = engine;
    this.erc20Iface = new ethers.utils.Interface(ABI.ERC20);
    this.erc721Iface = new ethers.utils.Interface(ABI.ERC721);
    this.erc1155Iface = new ethers.utils.Interface(ABI.ERC1155);
    this.batchTransferIface = new ethers.utils.Interface(ABI.BATCH_TRANSFER);
  }

  public static getDecoder(engine: Engine): EVMTxDecoder {
    if (!EVMTxDecoder.sharedDecoder) {
      EVMTxDecoder.sharedDecoder = new EVMTxDecoder(engine);
    }
    return EVMTxDecoder.sharedDecoder;
  }

  public async decodeHistoryEntry(
    historyEntry: HistoryEntryTransaction,
    covalentTx?: Transaction | null,
  ) {
    const { rawTx, rawTxPreDecodeCache, payload } = historyEntry;
    const tx = rawTxPreDecodeCache
      ? await jsonToEthersTx(rawTxPreDecodeCache)
      : rawTx;
    const decoded = await this.decode(tx, payload, covalentTx, historyEntry);
    decoded.raw = rawTx;
    return decoded;
  }

  public async decode(
    rawTx: string | ethers.Transaction,
    payload?: any,
    covalentTx?: Transaction | null,
    historyEntry?: HistoryEntryTransaction | null,
  ): Promise<EVMDecodedItem> {
    let decoded = await this._decode(rawTx);

    if (historyEntry) {
      decoded = this.updateWithHistoryEntry(decoded, historyEntry);
    }

    if (payload) {
      decoded = await this.updateWithPayload(decoded, payload);
    }

    if (covalentTx) {
      decoded = this.updateWithCovalentTx(decoded, covalentTx);
    }

    return decoded;
  }

  public async decodeTx({
    vault,
    rawTx,
    payload,
    covalentTx,
    historyEntry,
  }: {
    vault: VaultEvm;
    rawTx: string | ethers.Transaction;
    payload?: any;
    covalentTx?: Transaction | null;
    historyEntry?: HistoryEntryTransaction | null;
  }): Promise<EVMDecodedItem> {
    let decoded = await this._decode(rawTx, vault);

    if (historyEntry) {
      decoded = this.updateWithHistoryEntry(decoded, historyEntry);
    }

    if (payload) {
      decoded = await this.updateWithPayload(decoded, payload);
    }

    if (covalentTx) {
      decoded = this.updateWithCovalentTx(decoded, covalentTx);
    }

    return decoded;
  }

  public async _decode(
    rawTx: string | ethers.Transaction,
    vault?: VaultEvm,
  ): Promise<EVMDecodedItem> {
    const accountAddress = await vault?.getAccountAddress();
    const { txType, tx, txDesc, protocol, mainSource, raw } =
      this.staticDecode(rawTx);
    const itemBuilder = { txType, protocol, raw } as EVMDecodedItem;

    const networkId = `evm--${tx.chainId}`;
    const network = await this.engine.getNetwork(networkId);

    itemBuilder.gasInfo = parseGasInfo(tx);
    itemBuilder.fromType = 'OUT';
    itemBuilder.txStatus = TxStatus.Pending;
    itemBuilder.mainSource = mainSource;
    itemBuilder.network = network;
    itemBuilder.symbol = network.symbol;
    itemBuilder.amount = ethers.utils.formatEther(tx.value);
    itemBuilder.total = ethers.utils.formatEther(
      tx.value.add(
        ethers.utils.parseEther(
          itemBuilder.gasInfo.feeSpend || itemBuilder.gasInfo.maxFeeSpend,
        ),
      ),
    );

    this.fillTxInfo(itemBuilder, tx);

    if (txDesc) {
      itemBuilder.contractCallInfo = {
        contractAddress: tx.to?.toLowerCase() ?? '',
        functionName: txDesc.name,
        functionSignature: txDesc.signature,
        args: txDesc.args.map((arg) => String(arg)),
      };
    }

    if (
      (await vault?.fixAddressCase(itemBuilder.toAddress)) ===
      (await vault?.fixAddressCase(accountAddress || ''))
    ) {
      itemBuilder.fromType = 'IN';
    }

    let infoBuilder:
      | EVMDecodedItemERC20Transfer
      | EVMDecodedItemERC20Approve
      | null = null;

    // erc20
    if (itemBuilder.protocol === 'erc20') {
      let token;
      try {
        token = await this.engine.findToken({
          networkId,
          tokenIdOnNetwork: itemBuilder.toAddress,
        });
      } catch (e) {
        debugLogger.common.error(e);
      }

      // erc20 Token
      if (token) {
        switch (txType) {
          case EVMDecodedTxType.TOKEN_TRANSFER: {
            let from = tx.from?.toLowerCase() || '';
            let recipient = tx.to?.toLowerCase() || '';
            let value = ethers.BigNumber.from(0);

            // Function:  transfer(address _to, uint256 _value)
            if (txDesc?.name === 'transfer') {
              from = tx.from?.toLowerCase() || '';
              recipient = (txDesc?.args[0] as string).toLowerCase();
              value = txDesc?.args[1] as ethers.BigNumber;
            }

            // Function:  transferFrom(address from, address to, uint256 value)
            if (txDesc?.name === 'transferFrom') {
              from = (txDesc?.args[0] as string).toLowerCase();
              recipient = (txDesc?.args[1] as string).toLowerCase();
              value = txDesc?.args[2] as ethers.BigNumber;
            }

            const amount = EVMTxDecoder.formatValue(value, token.decimals);
            infoBuilder = {
              type: EVMDecodedTxType.TOKEN_TRANSFER,
              value: value.toString(),
              amount,
              from,
              recipient,
              token,
            } as EVMDecodedItemERC20Transfer;
            if (
              (await vault?.fixAddressCase(infoBuilder.recipient)) ===
              (await vault?.fixAddressCase(accountAddress || ''))
            ) {
              itemBuilder.fromType = 'IN';
            }
            break;
          }
          case EVMDecodedTxType.TOKEN_APPROVE: {
            // Function:  approve(address _spender, uint256 _value)
            const spender = (txDesc?.args[0] as string).toLowerCase();
            const value = txDesc?.args[1] as ethers.BigNumber;
            const amount = EVMTxDecoder.formatValue(value, token.decimals);
            infoBuilder = {
              type: EVMDecodedTxType.TOKEN_APPROVE,
              spender,
              amount,
              value: value.toString(),
              token,
              isUInt256Max: amount === InfiniteAmountText,
            } as EVMDecodedItemERC20Approve;
            break;
          }
          default: {
            // TODO: handle others erc20 tx
            // fallback to contract call type
            itemBuilder.protocol = undefined;
            itemBuilder.txType = EVMDecodedTxType.TRANSACTION;
            break;
          }
        }
        itemBuilder.info = infoBuilder;
      } else {
        // Maybe erc721, ui will fallback to contract call type
        itemBuilder.protocol = 'erc721';
        itemBuilder.txType = EVMDecodedTxType.ERC721_TRANSFER;
      }
    }

    return itemBuilder;
  }

  private updateWithCovalentTx(item: EVMDecodedItem, covalentTx: Transaction) {
    return updateGasInfo(item, covalentTx);
  }

  private updateWithHistoryEntry(
    item: EVMDecodedItem,
    historyEntry: HistoryEntryTransaction,
  ) {
    return updateWithHistoryEntry(item, historyEntry);
  }

  private async updateWithPayload(item: EVMDecodedItem, payload: any) {
    const parsedPayload = await parsePayload(
      payload,
      item.network,
      this.engine,
    );

    return { ...item, ...parsedPayload };
  }

  private staticDecode(rawTx: string | ethers.Transaction): EVMBaseDecodedItem {
    const itemBuilder = {} as EVMBaseDecodedItem;

    let tx: ethers.Transaction;
    if (typeof rawTx === 'string') {
      tx = ethers.utils.parseTransaction(rawTx);
      itemBuilder.mainSource = 'raw';
      itemBuilder.raw = rawTx;
    } else {
      tx = rawTx;
      itemBuilder.mainSource = 'ethersTx';
    }
    itemBuilder.tx = tx;

    if (
      isEvmNativeTransferType({
        data: tx.data || '',
        to: tx.to || '',
      })
    ) {
      itemBuilder.txType = EVMDecodedTxType.NATIVE_TRANSFER;
      return itemBuilder;
    }

    const [erc20TxDesc, erc20TxType] = this.parseERC20(tx);
    if (erc20TxDesc) {
      itemBuilder.protocol = 'erc20';
      itemBuilder.txDesc = erc20TxDesc;
      itemBuilder.txType = erc20TxType;
      return itemBuilder;
    }

    const [erc1155TxDesc, erc1155TxType] = this.parseERC1155(tx);
    if (erc1155TxDesc) {
      itemBuilder.protocol = 'erc1155';
      itemBuilder.txDesc = erc1155TxDesc;
      itemBuilder.txType = erc1155TxType;
      return itemBuilder;
    }

    const [erc721TxDesc, erc721TxType] = this.parseERC721(tx);
    if (erc721TxDesc) {
      itemBuilder.protocol = 'erc721';
      itemBuilder.txDesc = erc721TxDesc;
      itemBuilder.txType = erc721TxType;
      return itemBuilder;
    }

    itemBuilder.txType = EVMDecodedTxType.TRANSACTION;
    return itemBuilder;
  }

  private fillTxInfo(itemBuilder: EVMDecodedItem, tx: ethers.Transaction) {
    itemBuilder.value = tx.value.toString();
    itemBuilder.fromAddress = tx.from?.toLowerCase() ?? '';
    itemBuilder.toAddress = tx.to?.toLowerCase() ?? '';
    itemBuilder.nonce = tx.nonce;
    itemBuilder.txHash = tx.hash ?? '';
    itemBuilder.data = tx.data;
    itemBuilder.chainId = tx.chainId;
  }

  static formatValue(value: ethers.BigNumberish, decimals: number): string {
    const valueBn = ethers.BigNumber.from(value);
    if (ethers.constants.MaxUint256.eq(valueBn)) {
      return InfiniteAmountText;
    }
    return ethers.utils.formatUnits(valueBn, decimals) ?? '0';
  }

  private parseERC20(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EVMDecodedTxType] {
    let txDesc: ethers.utils.TransactionDescription | null;
    let txType = EVMDecodedTxType.TRANSACTION;

    try {
      txDesc = this.erc20Iface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }

    switch (txDesc.name) {
      case 'transfer': {
        txType = EVMDecodedTxType.TOKEN_TRANSFER;
        break;
      }
      case 'transferFrom': {
        txType = EVMDecodedTxType.TOKEN_TRANSFER;
        break;
      }
      case 'approve': {
        txType = EVMDecodedTxType.TOKEN_APPROVE;
        break;
      }
      default: {
        txType = EVMDecodedTxType.TRANSACTION;
      }
    }
    return [txDesc, txType];
  }

  private parseERC721(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EVMDecodedTxType] {
    let txDesc: ethers.utils.TransactionDescription | null;
    let txType = EVMDecodedTxType.TRANSACTION;
    try {
      txDesc = this.erc721Iface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }
    switch (txDesc.name) {
      case 'safeTransferFrom': {
        txType = EVMDecodedTxType.ERC721_TRANSFER;
        break;
      }
      default: {
        txType = EVMDecodedTxType.TRANSACTION;
      }
    }
    return [txDesc, txType];
  }

  private parseERC1155(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EVMDecodedTxType] {
    let txDesc: ethers.utils.TransactionDescription | null;
    let txType = EVMDecodedTxType.TRANSACTION;
    try {
      txDesc = this.erc1155Iface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }
    switch (txDesc.name) {
      case 'safeTransferFrom': {
        txType = EVMDecodedTxType.ERC1155_TRANSFER;
        break;
      }
      default: {
        txType = EVMDecodedTxType.TRANSACTION;
      }
    }
    return [txDesc, txType];
  }

  public parseBatchTransfer(
    tx: ethers.Transaction,
  ): [ethers.utils.TransactionDescription | null, EVMDecodedTxType] {
    let txDesc: ethers.utils.TransactionDescription | null;
    const txType = EVMDecodedTxType.TRANSACTION;
    try {
      txDesc = this.batchTransferIface.parseTransaction(tx);
    } catch (error) {
      return [null, txType];
    }
    return [txDesc, txType];
  }
}

export { EVMTxDecoder, EVMDecodedTxType };
export type {
  EVMDecodedItem,
  EVMDecodedItemERC20Approve,
  EVMDecodedItemERC20Transfer,
  EVMDecodedItemInternalSwap,
};
