// TODO move to Vault / Service
import BigNumber from 'bignumber.js';
import { toLower } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import type { BatchSendConfirmParams, SendConfirmParams } from '../types';

// remove gas price if encodedTx build by DAPP
function removeFeeInfoInTx(encodedTx: IEncodedTxEvm) {
  // *** DO NOT delete gasLimit here, fetchFeeInfo() will use it to calculate max limit
  // delete encodedTx.gas;
  // delete encodedTx.gasLimit;

  // *** DELETE gasPrice and use wallet re-calculated fee price
  delete encodedTx.gasPrice;
  delete encodedTx.maxPriorityFeePerGas;
  delete encodedTx.maxFeePerGas;

  return encodedTx;
}

// TODO move to Vault / Service
export async function prepareSendConfirmEncodedTx({
  encodedTx,
  networkImpl,
  sendConfirmParams,
  address,
}: {
  encodedTx?: IEncodedTx;
  networkImpl: string;
  sendConfirmParams: SendConfirmParams | BatchSendConfirmParams;
  address: string;
}): Promise<IEncodedTx> {
  if (!encodedTx) {
    throw new Error('prepareEncodedTx encodedTx should NOT be null');
  }
  if (networkImpl === IMPL_EVM) {
    const encodedTxEvm = encodedTx as IEncodedTxEvm;
    // routeParams is not editable, so should create new one
    let tx = { ...encodedTxEvm };
    tx.from = tx.from || address;
    // remove gas price if encodedTx build by DAPP
    if (sendConfirmParams.sourceInfo) {
      tx = removeFeeInfoInTx(tx);
    }
    const valueBn = new BigNumber(tx.value);
    if (!valueBn.isNaN()) {
      // Ensure IEncodedTxEvm's value is hex string.
      tx.value = `0x${valueBn.toString(16)}`;
    }
    try {
      // convert from & to to lower-case, as Metamask support it
      if (tx.from) {
        tx.from = toLower(tx.from) || tx.from;
      }
      if (tx.to) {
        tx.to = toLower(tx.to) || tx.to;
      }
    } catch {
      //
    }

    return Promise.resolve(tx);
  }
  return Promise.resolve(encodedTx);
}
