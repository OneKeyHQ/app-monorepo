/* eslint-disable @typescript-eslint/naming-convention,camelcase,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-shadow,@typescript-eslint/no-unsafe-return,@typescript-eslint/restrict-plus-operands,@typescript-eslint/require-await */
import { encoding } from '@starcoin/starcoin';
import BigNumber from 'bignumber.js';

import { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import type { CoinInfo } from '@onekeyhq/engine/src/types/chain';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
} from '@onekeyhq/engine/src/types/provider';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';

type estimateResult = {
  feeLimit: BigNumber;
  tokensChangedTo: Record<string, string>;
};

const DEFAULT_GAS_LIMIT = 127845;
class StcClient extends BaseClient {
  readonly rpc: JsonRPCRequest;

  constructor(url: string) {
    super();
    this.rpc = new JsonRPCRequest(url);
  }

  async getInfo(): Promise<ClientInfo> {
    const blockInfo: any = await this.rpc.call('chain.info', []);
    const bestBlockNumber = parseInt(blockInfo.head.number);
    // eslint-disable-next-line no-restricted-globals
    const isReady = !isNaN(bestBlockNumber) && bestBlockNumber > 0;

    return { bestBlockNumber, isReady };
  }

  async getAddresses(
    addresses: Array<string>,
  ): Promise<Array<AddressInfo | undefined>> {
    const calls = addresses.reduce((acc: Array<any>, cur) => {
      acc.push([
        'state.get_resource',
        [cur, '0x1::Account::Account', { decode: true }],
      ]);
      acc.push(['txpool.next_sequence_number', [cur]]);
      acc.push([
        'state.get_resource',
        [cur, '0x1::Account::Balance<0x1::STC::STC>', { decode: true }],
      ]);
      return acc;
    }, []);

    const resp: Array<any> = await this.rpc.batchCall(calls);
    const result = [];

    for (let i = 0, count = resp.length; i < count; i += 3) {
      const [state, nextSequenceNumber, _balance] = resp.slice(i, i + 3);
      let info;

      if (
        typeof state !== 'undefined' &&
        typeof nextSequenceNumber !== 'undefined' &&
        typeof _balance !== 'undefined'
      ) {
        const balance = new BigNumber(_balance?.json.token.value ?? 0);
        const existing = state !== null;
        const nonce = Math.max(
          state?.json.sequence_number ?? 0,
          nextSequenceNumber ?? 0,
        );
        info = { balance, nonce, existing };
      }

      result.push(info);
    }

    return result;
  }

  async getBalances(
    requests: Array<{ address: string; coin: Partial<CoinInfo> }>,
  ): Promise<Array<BigNumber | undefined>> {
    const calls: Array<any> = requests.map((req) => [
      'state.get_resource',
      [
        req.address,
        `0x1::Account::Balance<${req.coin.tokenAddress ?? '0x1::STC::STC'}>`,
        { decode: true },
      ],
    ]);

    const resps: Array<{ [key: string]: any } | undefined> =
      await this.rpc.batchCall(calls);
    return resps.map((resp) => {
      let balance;

      if (typeof resp !== 'undefined') {
        balance = new BigNumber(resp?.json.token.value ?? 0);
      }
      return balance;
    });
  }

  async getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const calls = txids.reduce((acc: Array<any>, cur) => {
      acc.push(['txpool.pending_txn', [cur]]);
      acc.push(['chain.get_transaction_info', [cur]]);
      return acc;
    }, []);

    const resp: Array<any> = await this.rpc.batchCall(calls);

    const result = [];
    for (let i = 0, count = resp.length; i < count; i += 2) {
      const [pendingTx, receipt] = resp.slice(i, i + 2);
      let status;

      if (typeof receipt !== 'undefined' && typeof pendingTx !== 'undefined') {
        if (pendingTx === null && receipt === null) {
          status = TransactionStatus.NOT_FOUND;
        } else if (pendingTx) {
          status = TransactionStatus.PENDING;
        } else {
          status =
            receipt?.status === 'Executed'
              ? TransactionStatus.CONFIRM_AND_SUCCESS
              : TransactionStatus.CONFIRM_BUT_FAILED;
        }
      }
      result.push(status);
    }

    return result;
  }

  async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const resp: string = await this.rpc.call('txpool.gas_price', []);
    const price = parseInt(resp ?? '1');
    return {
      normal: { price: new BigNumber(price) },
    };
  }

  async broadcastTransaction(rawTx: string): Promise<string> {
    return this.rpc.call('txpool.submit_hex_transaction', [rawTx]);
  }

  async estimateGasLimitAndTokensChangedTo(
    rawUserTransactionHex: string,
    senderPublicKeyHex: string,
  ): Promise<estimateResult> {
    const addressHex = encoding.publicKeyToAddress(senderPublicKeyHex);
    const resp: any = await this.rpc.call('contract.dry_run_raw', [
      rawUserTransactionHex,
      senderPublicKeyHex,
    ]);
    let feeLimit: BigNumber;
    let tokensChangedTo: Record<string, string>;

    if (resp?.status === 'Executed') {
      feeLimit = new BigNumber(parseInt(resp.gas_used));
      tokensChangedTo = this.getTokensChangedTo(resp, addressHex);
    } else {
      // eslint-disable-next-line no-restricted-globals
      if (isNaN(parseInt(resp?.gas_used))) {
        feeLimit = new BigNumber(DEFAULT_GAS_LIMIT);
      } else {
        // In case of insufficient balance.
        feeLimit = new BigNumber(parseInt(resp?.gas_used));
      }
      tokensChangedTo = {};
    }
    return { feeLimit, tokensChangedTo };
  }

  getTokensChangedTo(
    dryRunRawResult: any,
    addressHex: string,
  ): Record<string, string> {
    const matches = dryRunRawResult.write_set.reduce(
      (acc: Record<string, string>, item: any) => {
        const reg =
          /^(0x[a-zA-Z0-9]{32})\/[01]\/0x00000000000000000000000000000001::Account::Balance<(.*)>$/i;
        const result = item.access_path.match(reg);
        if (result && result.length === 3 && addressHex === result[1]) {
          acc[result[2]] = new BigNumber(
            item.value.Resource.json.token.value ?? 0,
          ).toFixed();
        }
        return acc;
      },
      {},
    );
    return matches;
  }
}
export { StcClient };
