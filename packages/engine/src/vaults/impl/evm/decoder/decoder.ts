import { ethers } from '@onekeyfe/blockchain-libs';

import { Transaction, TxStatus } from '../../../../types/covalent';
import { HistoryEntryTransaction } from '../../../../types/history';

import { ABI } from './abi';
import { parseGasInfo, updateGasInfo } from './gasParser';
import { updateWithHistoryEntry } from './historyParser';
import { parsePayload } from './payloadParser';
import {
  EVMBaseDecodedItem,
  EVMDecodedItem,
  EVMDecodedItemERC20Approve,
  EVMDecodedItemERC20Transfer,
  EVMDecodedItemInternalSwap,
  EVMDecodedTxType,
} from './types';
import { isEvmNativeTransferType, jsonToEthersTx } from './util';

import type { Engine } from '../../../..';
import type VaultEvm from '../Vault';

export const InfiniteAmountText = 'Infinite';
export const InfiniteAmountHex =
  '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

class EVMTxDecoder {
  private static sharedDecoder: EVMTxDecoder;

  private engine: Engine;

  private erc20Iface: ethers.utils.Interface;

  private constructor(engine: Engine) {
    this.engine = engine;
    this.erc20Iface = new ethers.utils.Interface(ABI.ERC20);
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

    // erc20 or erc721
    if (itemBuilder.protocol === 'erc20') {
      const token = await this.engine.findToken({
        networkId,
        tokenIdOnNetwork: itemBuilder.toAddress,
      });
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
            break;
          }
        }
        itemBuilder.info = infoBuilder;
      } else {
        // Maybe erc721, fallback to contract call type
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
}

export { EVMTxDecoder, EVMDecodedTxType };
export type {
  EVMDecodedItem,
  EVMDecodedItemERC20Approve,
  EVMDecodedItemERC20Transfer,
  EVMDecodedItemInternalSwap,
};
