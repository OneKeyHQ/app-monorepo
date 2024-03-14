// TODO move to Vault / Service
import { toLower } from 'lodash';

import type { IEncodedTxEvm } from '@onekeyhq/engine/src/vaults/impl/evm/Vault';
import type { IEncodedTx } from '@onekeyhq/engine/src/vaults/types';
import { IEncodedTxUpdateType } from '@onekeyhq/engine/src/vaults/types';
import type { IEncodedTxBtc } from '@onekeyhq/engine/src/vaults/utils/btcForkChain/types';
import { IMPL_EVM } from '@onekeyhq/shared/src/engine/engineConsts';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

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

async function updateCustomHexDataInTx({
  accountId,
  networkId,
  encodedTx,
  currentHexData,
}: {
  accountId: string;
  networkId: string;
  encodedTx: IEncodedTx;
  currentHexData?: string;
}) {
  const updatedTx = await backgroundApiProxy.engine.updateEncodedTx({
    networkId,
    accountId,
    encodedTx,
    payload: currentHexData,
    options: {
      type: IEncodedTxUpdateType.customData,
    },
  });
  return updatedTx;
}

// TODO move to Vault / Service
export async function prepareSendConfirmEncodedTx({
  networkId,
  accountId,
  encodedTx,
  networkImpl,
  sendConfirmParams,
  address,
  selectedUtxos,
  currentHexData,
}: {
  networkId?: string;
  accountId?: string;
  encodedTx?: IEncodedTx;
  networkImpl: string;
  sendConfirmParams: SendConfirmParams | BatchSendConfirmParams;
  address: string;
  selectedUtxos?: string[];
  currentHexData?: string;
}): Promise<IEncodedTx> {
  if (!encodedTx) {
    throw new Error('prepareEncodedTx encodedTx should NOT be null');
  }

  if (networkImpl === IMPL_EVM) {
    const encodedTxEvm = encodedTx as IEncodedTxEvm;
    // routeParams is not editable, so should create new one
    let tx = { ...encodedTxEvm };
    tx.from = tx.from || address;
    // keep gas price if encodedTx build by DAPP

    // if (sendConfirmParams.sourceInfo) {
    //   tx = removeFeeInfoInTx(tx);
    // }

    // Ensure IEncodedTxEvm's value is hex string.
    if (tx.value && tx.value.startsWith && !tx.value.startsWith('0x')) {
      throw new Error(
        'prepareSendConfirmEncodedTx ERROR: tx value is not hex string (only 0x prefixed hex string allowed)',
      );
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

    if (accountId && networkId) {
      const vaultSetting = await backgroundApiProxy.engine.getVaultSettings(
        networkId,
      );

      if (vaultSetting.hexDataEditable) {
        tx = (await updateCustomHexDataInTx({
          accountId,
          networkId,
          encodedTx: tx,
          currentHexData,
        })) as IEncodedTxEvm;
      }
    }

    return Promise.resolve(tx);
  }

  if (networkId) {
    const vaultSetting = await backgroundApiProxy.engine.getVaultSettings(
      networkId,
    );
    if (vaultSetting.hexDataEditable) {
      if (!accountId) {
        return Promise.resolve(encodedTx);
      }
      const updatedTx = await updateCustomHexDataInTx({
        accountId,
        networkId,
        encodedTx,
        currentHexData,
      });
      return updatedTx;
    }

    const isFeeRateMode =
      vaultSetting.isFeeRateMode || vaultSetting.isBtcForkChain;
    if (isFeeRateMode) {
      const encodedTxBtc = encodedTx as IEncodedTxBtc;
      if (!accountId) {
        return Promise.resolve(encodedTx);
      }
      const updatedTx = await backgroundApiProxy.engine.updateEncodedTx({
        networkId,
        accountId,
        encodedTx: encodedTxBtc,
        payload: {
          selectedUtxos,
        },
        options: {
          type: IEncodedTxUpdateType.advancedSettings,
        },
      });
      return updatedTx;
    }
  }

  return Promise.resolve(encodedTx);
}
