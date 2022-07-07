import { arrayify } from '@ethersproject/bytes';
import { bcs, encoding } from '@starcoin/starcoin';
import axios from 'axios';
import BigNumber from 'bignumber.js';

import { ISTCExplorerTransaction } from './types';

type IDecodedSTCPayload = {
  ScriptFunction: {
    func: {
      address: string;
      module: string;
      functionName: string;
    };
    args: Array<string>;
    // eslint-disable-next-line camelcase
    ty_args: Array<{ Struct: { name: string } }>;
  };
};

const historyAPIURLs: Record<string, string> = {
  'stc--1': 'https://api.stcscan.io/v2/transaction/main/byAddress',
  'stc--251': 'https://api.stcscan.io/v2/transaction/barnard/byAddress',
};

export async function getAddressHistoryFromExplorer(
  networkId: string,
  address: string,
): Promise<Array<ISTCExplorerTransaction>> {
  const urlBase = historyAPIURLs[networkId];
  if (typeof urlBase === 'undefined') {
    return Promise.resolve([]);
  }
  const requestURL = `${urlBase}/${address}`;
  try {
    const response = await axios.get<{
      contents: Array<ISTCExplorerTransaction>;
    }>(requestURL);
    return response.data.contents;
  } catch (e) {
    console.error(e);
    return Promise.resolve([]);
  }
}

// Codes based on starcoin-explorer,
// ref to https://github.com/starcoinorg/starcoin-explorer/blob/406da89d6af2d9d261aebe9fd4d85b23ba6ca2a8/src/modules/Transactions/components/TransactionSummary/TransferTransactionSummary.tsx#L69
export function extractTransactionInfo(tx: ISTCExplorerTransaction) {
  try {
    const decodedPayload = encoding.decodeTransactionPayload(
      tx.user_transaction.raw_txn.payload,
    );

    // Only care stc transfer now.
    let amountString;
    const {
      ScriptFunction: {
        func: {
          address: functionAddress,
          module: functionModule,
          functionName,
        },
        args: functionArgs,
        ty_args: [
          {
            Struct: { name: symbol },
          },
        ],
      },
    } = decodedPayload as IDecodedSTCPayload;
    if (
      functionAddress === '0x00000000000000000000000000000001' ||
      functionModule === 'TransferScripts'
    ) {
      if (functionName === 'peer_to_peer_v2') {
        [, amountString] = functionArgs;
      } else if (functionName === 'peer_to_peer') {
        [, , amountString] = functionArgs;
      }
    }

    let mainTokenAmountValue;
    if (amountString) {
      mainTokenAmountValue = new BigNumber(
        new bcs.BcsDeserializer(arrayify(amountString))
          .deserializeU128()
          .toString(),
      ).toFixed();
    }
    return {
      from: tx.user_transaction.raw_txn.sender,
      to: functionArgs[0],
      symbol,
      mainTokenAmountValue,
      feeValue: new BigNumber(tx.user_transaction.raw_txn.gas_unit_price)
        .times(tx.gas_used)
        .toFixed(),
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}
