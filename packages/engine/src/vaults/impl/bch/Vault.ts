import BigNumber from 'bignumber.js';

import { IBlockBookTransaction } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import VaultBtcFork from '@onekeyhq/engine/src/vaults/utils/btcForkChain/VaultBtcFork';

import { COINTYPE_BCH, IMPL_BCH } from '../../../constants';
import { DBUTXOAccount } from '../../../types/account';
import {
  IDecodedTx,
  IDecodedTxActionType,
  IDecodedTxDirection,
  IDecodedTxStatus,
  IHistoryTx,
} from '../../types';

import { KeyringHardware } from './KeyringHardware';
import { KeyringHd } from './KeyringHd';
import { KeyringImported } from './KeyringImported';
import { KeyringWatching } from './KeyringWatching';
import Provider from './provider';
import settings from './settings';

type ArrayElement<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;

export default class Vault extends VaultBtcFork {
  override providerClass = Provider;

  override keyringMap = {
    hd: KeyringHd,
    hw: KeyringHardware,
    imported: KeyringImported,
    watching: KeyringWatching,
    external: KeyringWatching,
  };

  override settings = settings;

  override getDefaultPurpose() {
    return 44;
  }

  override getCoinName() {
    return 'BCH';
  }

  override getCoinType() {
    return COINTYPE_BCH;
  }

  override getXprvReg() {
    return /^([x]prv)/;
  }

  override getXpubReg() {
    return /^([x]pub)/;
  }

  override getDefaultBlockNums(): number[] {
    return [5, 2, 1];
  }

  override getDefaultBlockTime(): number {
    return 600;
  }

  /**
   *
   * Currently nownode's BCH blockbook lacks the `isOwn` field in getHistory API,
   * so we need to override this function to handle it, until blockbook update.
   */
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
        | ArrayElement<IBlockBookTransaction['vin']>
        | ArrayElement<IBlockBookTransaction['vout']>,
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
}
