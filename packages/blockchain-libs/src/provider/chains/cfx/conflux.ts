/* eslint-disable @typescript-eslint/naming-convention,camelcase,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call,@typescript-eslint/no-shadow,@typescript-eslint/no-unsafe-return,@typescript-eslint/restrict-plus-operands,@typescript-eslint/require-await,no-restricted-globals,no-continue,@typescript-eslint/no-unused-vars */
import { decode as toEthAddress } from '@conflux-dev/conflux-address-js';
import { defaultAbiCoder } from '@ethersproject/abi';
import BigNumber from 'bignumber.js';

import { BaseClient } from '@onekeyhq/engine/src/client/BaseClient';
import type { CoinInfo } from '@onekeyhq/engine/src/types/chain';
import type {
  AddressInfo,
  ClientInfo,
  FeePricePerUnit,
  PartialTokenInfo,
} from '@onekeyhq/engine/src/types/provider';
import { TransactionStatus } from '@onekeyhq/engine/src/types/provider';
import { JsonPRCResponseError } from '@onekeyhq/shared/src/errors/request-errors';
import { JsonRPCRequest } from '@onekeyhq/shared/src/request/JsonRPCRequest';
import { check } from '@onekeyhq/shared/src/utils/assertUtils';
import { fromBigIntHex } from '@onekeyhq/shared/src/utils/numberUtils';

class Conflux extends BaseClient {
  static readonly __EPOCH_TAG__ = 'latest_state';

  readonly rpc: JsonRPCRequest;

  constructor(url: string) {
    super();
    this.rpc = new JsonRPCRequest(url);
  }

  async getInfo(): Promise<ClientInfo> {
    const latestBlock: any = await this.rpc.call('cfx_getBlockByEpochNumber', [
      Conflux.__EPOCH_TAG__,
      false,
    ]);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const bestBlockNumber = Number(latestBlock.epochNumber);
    const isReady = Number.isInteger(bestBlockNumber) && bestBlockNumber > 0;

    return { bestBlockNumber, isReady };
  }

  async getAddresses(
    addresses: Array<string>,
  ): Promise<Array<AddressInfo | undefined>> {
    const calls = addresses.reduce((acc: Array<any>, cur) => {
      acc.push(['cfx_getBalance', [cur, Conflux.__EPOCH_TAG__]]);
      acc.push(['cfx_getNextNonce', [cur, Conflux.__EPOCH_TAG__]]);

      return acc;
    }, []);

    const resp: Array<any> = await this.rpc.batchCall(
      calls,
      undefined,
      undefined,
      true,
    );
    const result = [];

    for (let i = 0, count = resp.length; i < count; i += 2) {
      const [balanceHex, nonceHex] = resp.slice(i, i + 2);
      let info;

      if (
        typeof balanceHex !== 'undefined' &&
        typeof nonceHex !== 'undefined'
      ) {
        const balance = fromBigIntHex(balanceHex);
        const nonce = parseInt(nonceHex, 16);
        // eslint-disable-next-line no-restricted-globals
        if (!balance.isNaN() && !isNaN(nonce)) {
          info = {
            balance,
            nonce,
            existing: balance.gt(0) || nonce > 0,
          };
        }
      }

      result.push(info);
    }

    return result;
  }

  async getBalances(
    requests: Array<{ address: string; coin: Partial<CoinInfo> }>,
  ): Promise<Array<BigNumber | undefined>> {
    const calls: Array<any> = requests.map((i) =>
      i.coin?.tokenAddress
        ? [
            'cfx_call',
            [
              {
                to: i.coin.tokenAddress,
                data: `0x70a08231000000000000000000000000${toEthAddress(
                  i.address,
                ).hexAddress.toString('hex')}`,
              },
              Conflux.__EPOCH_TAG__,
            ],
          ]
        : ['cfx_getBalance', [i.address, Conflux.__EPOCH_TAG__]],
    );

    const resp: Array<string | undefined> = await this.rpc.batchCall(
      calls,
      undefined,
      undefined,
      true,
    );
    return resp.map((i) => {
      let balance;

      if (typeof i !== 'undefined') {
        balance = fromBigIntHex(i.slice(0, 66));

        if (balance.isNaN()) {
          balance = undefined;
        }
      }
      return balance;
    });
  }

  async getTransactionStatuses(
    txids: Array<string>,
  ): Promise<Array<TransactionStatus | undefined>> {
    const calls = txids.reduce((acc: Array<any>, cur) => {
      acc.push(['cfx_getTransactionByHash', [cur]]);
      acc.push(['cfx_getTransactionReceipt', [cur]]);
      return acc;
    }, []);

    const resp: Array<any> = await this.rpc.batchCall(calls);

    const result = [];
    for (let i = 0, count = resp.length; i < count; i += 2) {
      const [tx, receipt] = resp.slice(i, i + 2);
      let status;

      if (typeof tx !== 'undefined' && typeof receipt !== 'undefined') {
        if (!tx) {
          status = TransactionStatus.NOT_FOUND;
        } else if (!receipt) {
          status = TransactionStatus.PENDING;
        } else {
          status =
            receipt.outcomeStatus === '0x0'
              ? TransactionStatus.CONFIRM_AND_SUCCESS
              : TransactionStatus.CONFIRM_BUT_FAILED;
        }
      }

      result.push(status);
    }

    return result;
  }

  override async getTokenInfos(
    tokenAddresses: Array<string>,
  ): Promise<Array<PartialTokenInfo | undefined>> {
    const data = ['0x95d89b41', '0x06fdde03', '0x313ce567']; // method_selector of symbol, name and decimals
    const calls = tokenAddresses.reduce((acc: any, cur) => {
      const item = data
        .map((i) => ({ to: cur, data: i }))
        .map((i) => ['cfx_call', [i, Conflux.__EPOCH_TAG__]]);
      acc.push(...item);
      return acc;
    }, []);

    const resp: Array<any> = await this.rpc.batchCall(calls);
    const tokens: Array<PartialTokenInfo | undefined> = [];

    for (let i = 0, count = resp.length; i < count; i += 3) {
      const [symbolHex, nameHex, decimalsHex] = resp.slice(i, i + 3);

      if (
        typeof symbolHex === 'undefined' ||
        typeof nameHex === 'undefined' ||
        typeof decimalsHex === 'undefined'
      ) {
        tokens.push(undefined);
        // eslint-disable-next-line no-continue
        continue;
      }

      try {
        const [symbol] = defaultAbiCoder.decode(['string'], symbolHex);
        const [name] = defaultAbiCoder.decode(['string'], nameHex);
        const decimals = parseInt(decimalsHex, 16);
        check(!isNaN(decimals));

        tokens.push({
          symbol,
          name,
          decimals,
        });
      } catch (e) {
        console.error(e);
        tokens.push(undefined);
      }
    }

    return tokens;
  }

  async getFeePricePerUnit(): Promise<FeePricePerUnit> {
    const gasPriceHex: string = await this.rpc.call('cfx_gasPrice', []);
    const gasPrice = fromBigIntHex(gasPriceHex);

    const slow =
      !gasPrice.isNaN() && gasPrice.gt(1) ? gasPrice : new BigNumber(1);
    const normal = slow.multipliedBy(1.25).integerValue(BigNumber.ROUND_CEIL);
    const fast = normal.multipliedBy(1.2).integerValue(BigNumber.ROUND_CEIL); // 1.25 * 1.2 = 1.5

    return {
      normal: { price: normal, waitingBlock: 2 },
      others: [
        { price: slow, waitingBlock: 10 },
        { price: fast, waitingBlock: 1 },
      ],
    };
  }

  async broadcastTransaction(rawTx: string): Promise<string> {
    return this.rpc.call('cfx_sendRawTransaction', [rawTx]);
  }

  async estimateGasLimit(
    fromAddress: string,
    toAddress: string,
    value: string,
    data?: string,
  ): Promise<string> {
    const [gasLimit, _] = await this.estimateGasAndCollateral(
      fromAddress,
      toAddress,
      value,
      data,
    );
    return gasLimit;
  }

  async getEpochNumber(): Promise<BigNumber> {
    const resp: string = await this.rpc.call('cfx_epochNumber');
    return fromBigIntHex(resp);
  }

  async estimateGasAndCollateral(
    fromAddress: string,
    toAddress: string,
    value: string,
    data?: string,
  ): Promise<[string, string]> {
    const resp: any = await this.rpc.call('cfx_estimateGasAndCollateral', [
      { from: fromAddress, to: toAddress, value, data: data || '0x' },
    ]);
    const gasUsed = resp.gasUsed || '0x0';
    const storageCollateralized = resp.storageCollateralized || '0x0';
    return [gasUsed, storageCollateralized];
  }

  async isContract(address: string): Promise<boolean> {
    let code = '';
    try {
      code = await this.rpc.call('cfx_getCode', [
        address,
        Conflux.__EPOCH_TAG__,
      ]);
      if (code && code.startsWith('0x')) {
        code = code.slice(2);
      }
    } catch (error) {
      if (error instanceof JsonPRCResponseError) {
        if (!error.message.includes('does not exist')) {
          throw error;
        }
      } else {
        throw error;
      }
    }
    return code.length > 0;
  }
}
export { Conflux };
