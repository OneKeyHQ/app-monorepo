/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import B from 'bignumber.js';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { ethers } from 'ethersV6';
import { isNil, keyBy, orderBy, pick, uniq } from 'lodash';

import { validateEvmAddress } from '@onekeyhq/core/src/chains/evm/sdkEvm';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import type {
  IJsonRpcBatchParams,
  IJsonRpcParams,
} from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IFetchServerAccountDetailsParams,
  IServerFetchNonceResponse,
} from '@onekeyhq/shared/types/address';
import type {
  IEstimateGasParams,
  IEstimateGasResp,
  IServerEstimateFeeResponse,
  IServerGasFeeParams,
  IServerGasFeeResponse,
  IServerGasLimitParams,
  IServerGasLimitResponse,
  IServerGasPriceParams,
  IServerGasPriceResponse,
} from '@onekeyhq/shared/types/fee';
import {
  EOnChainHistoryTxStatus,
  type IFetchHistoryTxDetailsResp,
  type IOnChainHistoryTxTransfer,
  type IServerFetchAccountHistoryDetailParams,
} from '@onekeyhq/shared/types/history';
import type {
  IAmountUnit,
  IFetchServerTokenListApiParams,
  IServerAccountTokenItem,
  IServerTokenListQuery,
} from '@onekeyhq/shared/types/serverToken';

import { BaseApiProvider } from './BaseApiProvider';
import {
  INTERFACE,
  parseTokenItem,
  safeNumber,
  safeNumberString,
} from './utils';

import type { BigNumber } from 'bignumber.js';

export enum EVMMethodIds {
  // eslint-disable-next-line spellcheck/spell-checker
  Allowance = '0xdd62ed3e', // keccak256(Buffer.from('Allowance(address,address)')).toString('hex') => 0xdd62ed3e7e1f3d1f3f6
  balanceOf = '0x70a08231', // keccak256(Buffer.from('balanceOf(address)')).toString('hex') => 0x70a082310
  resolver = '0x0178b8bf', // keccak256(Buffer.from('resolver(byte32)')).toString('hex') => 0x70a082310
  addr = '0xf1cb7e06', // keccak256(Buffer.from('addr(byte32,uint256)')).toString('hex') => 0x70a082310
}

interface IEvmGetTransactionByHash {
  blockHash: string;
  blockNumber: string;
  chainId: string;
  from: string;
  gas: string;
  gasPrice: string;
  hash: string;
  input: string;
  nonce: string;
  r: string;
  s: string;
  to: string;
  transactionIndex: string;
  type: string;
  v: string;
  value: string;
}

interface IEvmGetTransactionReceipt {
  blockHash: string;
  blockNumber: string;
  contractAddress: string | null;
  cumulativeGasUsed: string;
  effectiveGasPrice: string;
  from: string;
  gasUsed: string;
  logs: Array<{
    address: string;
    blockHash: string;
    blockNumber: string;
    data: string;
    logIndex: string;
    removed: boolean;
    topics: string[];
    transactionHash: string;
    transactionIndex: string;
  }>;
  logsBloom: string;
  status: string;
  to: string;
  transactionHash: string;
  transactionIndex: string;
  type: string;
}

const EMPTY_DATA = '0x';
const GAS_LIMIT_RATE = 1.2;

const BASE_FEE_RATE = 1.5;

export const compareList = [
  {
    key: 'name',
    call: '0x06fdde03',
    type: 'string',
  },
  {
    key: 'symbol',
    call: '0x95d89b41',
    type: 'string',
  },
  {
    key: 'decimals',
    call: '0x313ce567',
    type: 'uint8',
  },
];

class EvmApiProvider extends BaseApiProvider {
  public defaultFeeRates = [1, 1.25, 1.5];

  public l2PriceOracleAddress = '0x420000000000000000000000000000000000000f';

  public override async validateTokenAddress(params: {
    networkId: string;
    address: string;
  }): Promise<string> {
    const { isValid, normalizedAddress } = await validateEvmAddress(
      params.address,
    );
    if (!isValid) {
      throw new Error('Invalid address');
    }
    return normalizedAddress;
  }

  protected override async getNonce(
    params: IFetchServerAccountDetailsParams,
  ): Promise<IServerFetchNonceResponse> {
    const res = await this.client.call<string>('eth_getTransactionCount', [
      params.accountAddress,
      'latest',
    ]);

    return {
      nonce: Number(res),
    };
  }

  override async listAccountTokenFromRpc(
    params: IFetchServerTokenListApiParams,
  ): Promise<IServerAccountTokenItem[]> {
    const { accountAddress } = params;
    const chainTokens = await this.getChainTokens({
      ...params,
      contractList: uniq(
        [this.nativeTokenAddress].concat(params.contractList ?? []),
      ),
    });
    const tokens = chainTokens.filter(Boolean);

    const requests = tokens.map((token) => {
      const address = this.normalizeAddress(token.info?.address ?? '');
      if (token.info?.address) {
        const addressWithoutPrefix = accountAddress?.slice(2);
        const data = `${EVMMethodIds.balanceOf}000000000000000000000000${addressWithoutPrefix}`;
        return [
          'eth_call',
          [
            {
              to: address,
              data,
            },
            'latest',
          ],
        ];
      }
      return ['eth_getBalance', [accountAddress, 'latest']];
    });

    const balances = await this.client.batchCall<string[]>(
      requests as IJsonRpcBatchParams,
    );

    const list = tokens.map<IServerAccountTokenItem>((token, i) => {
      let balance = new B(0);
      try {
        balance = new B(balances[i]);
      } catch (e) {
        console.error(
          `[ProviderEVMFork.listAccountTokenFromRpc] get balance error: `,
          e,
        );
      }
      const info = token.info;
      const price = token.price;
      const price24h = token.price24h;
      if (!info?.decimals) {
        throw new Error('decimals is undefined');
      }
      const balanceParsed = balance.shiftedBy(-info.decimals);

      const fiatValue = balanceParsed.multipliedBy(price);

      return {
        info,
        balance: balance.toString(),
        balanceParsed: balanceParsed.toString(),
        fiatValue: safeNumberString(fiatValue.toString()),
        price,
        price24h,
      };
    });

    return list;
  }

  override async getChainTokensFromRpc(
    params: IServerTokenListQuery,
  ): Promise<IServerAccountTokenItem[]> {
    const nativeToken = await this.getNativeToken();
    const filteredContractList = uniq(params.contractList).filter(Boolean);
    const payloads = filteredContractList.map((t) =>
      compareList.map((c) => [
        'eth_call',
        [
          {
            to: t,
            data: c.call,
          },
          'latest',
        ],
      ]),
    );

    const infos = await this.client.batchChunkCall<string>(
      payloads as Array<Array<[string, IJsonRpcParams]>>,
    );
    const tokens = infos.map((item, idx) => {
      const address = this.normalizeAddress(filteredContractList[idx]);
      const [name = '', symbol = '', decimals] = item.map((result, i) => {
        const { type } = compareList[i];
        const bytesData = result;
        if (isNil(bytesData) && compareList[i].key === 'decimals') {
          // return undefined decimals if NFT token
          return undefined;
        }
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return defaultAbiCoder.decode([type], bytesData)[0];
        } catch (error) {
          console.error(
            // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
            `[ProviderEVMFork.getChainTokensFromRpc] decode error: ${
              (error as Error).message
            }, address=${address}, i=${i}`,
          );
        }
        return undefined;
      });

      if (typeof decimals !== 'number') {
        return null;
      }

      return {
        address,
        name,
        symbol,
        decimals,
        price: undefined,
        price24h: undefined,
        type: 'ERC20',
        totalSupply: undefined,
        isNative: false,
        riskLevel: 0,
        logoURI: '',
        networkId: params.networkId,
      };
    });

    const tokensMap = keyBy(tokens, 'address');

    const result = (params.contractList ?? []).map((a) => {
      if (a === this.nativeTokenAddress) {
        return nativeToken;
      }
      if (!tokensMap[a]) {
        return null;
      }
      // @ts-ignore
      return parseTokenItem(tokensMap[a]);
    });
    return result as IServerAccountTokenItem[];
  }

  override async estimateFeeFromRpc(
    params: IEstimateGasParams,
  ): Promise<IServerEstimateFeeResponse['data']['data']> {
    const [network, [nativeToken], gasPriceInfo, gasFeeInfo] =
      await Promise.all([
        this.backgroundApi.serviceNetwork.getNetwork({
          networkId: params.networkId,
        }),
        this.getChainTokens({
          networkId: params.networkId,
          contractList: [this.nativeTokenAddress],
        }),
        this.getGasPrice(params),
        this.getGasFee({
          networkId: params.networkId,
          encodedTx: params.encodedTx ?? ({} as IEncodedTx),
        }),
      ]);

    if (!gasFeeInfo.baseFee) {
      throw new Error('baseFee is undefined');
    }

    const res = {
      nativeSymbol: nativeToken.info?.symbol,
      nativeDecimals: nativeToken.info?.decimals,
      nativeTokenPrice: {
        price: nativeToken.price,
        price24h: nativeToken.price24h,
      },
      feeSymbol: network.feeMeta?.symbol,
      feeDecimals: network.feeMeta?.decimals,
      baseFee: new B(gasFeeInfo.baseFee)
        .shiftedBy(-network.feeMeta.decimals)
        .toString(),
      isEIP1559: gasPriceInfo.isEIP1559,
      gas: gasPriceInfo.gas,
      gasEIP1559: gasPriceInfo.gasEIP1559,
      feeUTXO: gasPriceInfo.feeUTXO,
      feeTron: undefined,
    };

    if (params.encodedTx) {
      const gasLimitInfo = await this.getGasLimit({
        networkId: params.networkId,
        encodedTx: params.encodedTx ?? {},
      });

      res.gas = res.gas?.map((item) => ({
        gasPrice: item.gasPrice,
        gasLimitForDisplay: String(gasLimitInfo.estimateGasLimit),
        gasLimit: String(gasLimitInfo.gasLimit),
      }));

      res.gas = orderBy(res.gas, [(n) => n.gasPrice], 'asc');

      res.gasEIP1559 = res.gasEIP1559?.map((item) => ({
        baseFeePerGas: item.baseFeePerGas,
        maxFeePerGas: item.maxFeePerGas,
        maxPriorityFeePerGas: item.maxPriorityFeePerGas,
        gasLimitForDisplay: String(gasLimitInfo.estimateGasLimit),
        gasLimit: String(gasLimitInfo.gasLimit),
      }));

      res.gasEIP1559 = orderBy(
        res.gasEIP1559,
        [(n) => n.maxPriorityFeePerGas],
        'asc',
      );
    }

    return res as unknown as IEstimateGasResp;
  }

  override async getGasPrice(
    params: IServerGasPriceParams,
  ): Promise<IServerGasPriceResponse> {
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId: params.networkId,
    });
    if (network.feeMeta.isEIP1559FeeEnabled) {
      return this.getGasPriceEIP1559({ network });
    }
    const [gasPrice] = await this.client.batchCall<[string, string, any]>([
      ['eth_gasPrice', []],
    ]);

    const gas = this.defaultFeeRates.map((rate) => ({
      gasPrice: new B(gasPrice)
        .multipliedBy(rate)
        .shiftedBy(-network.feeMeta.decimals)
        .toString(),
    }));

    return {
      isEIP1559: false,
      gas,
    };
  }

  protected async getGasPriceEIP1559(params: {
    network: IServerNetwork;
  }): Promise<IServerGasPriceResponse> {
    let isEIP1559 = false;
    let maxPriorityFeePerGas: string;
    let baseFeePerGas: BigNumber;
    try {
      const [maxPriorityFeePerGasResult, hexBlock] =
        await this.client.batchCall<[string, any]>([
          ['eth_maxPriorityFeePerGas', []],
          ['eth_getBlockByNumber', ['latest', false]],
        ]);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      baseFeePerGas = new B(hexBlock.baseFeePerGas);
      isEIP1559 = !(baseFeePerGas.isNaN() || baseFeePerGas.isEqualTo(0)); // 0 also means not 1559
      maxPriorityFeePerGas = maxPriorityFeePerGasResult;
    } catch (error) {
      console.error(
        `[ProviderEVMFork.getGasPriceEIP1559] get maxPriorityFeePerGas error: ${
          (error as Error).message
        }`,
      );
      isEIP1559 = false;
    }

    let gasEIP1559;
    if (isEIP1559) {
      // @see https://www.blocknative.com/blog/eip-1559-fees#3
      gasEIP1559 = [1, 1.25, 1.3].map((rate) => {
        const maxPriorityFeePerGasEach = new B(
          maxPriorityFeePerGas,
        ).multipliedBy(rate);
        const maxFeePerGasEach = baseFeePerGas
          .multipliedBy(2)
          .plus(maxPriorityFeePerGasEach);

        return {
          baseFeePerGas: baseFeePerGas
            .shiftedBy(-params.network.feeMeta.decimals)
            .toString(),
          maxFeePerGas: maxFeePerGasEach
            .shiftedBy(-params.network.feeMeta.decimals)
            .toString(),
          maxPriorityFeePerGas: maxPriorityFeePerGasEach
            .shiftedBy(-params.network.feeMeta.decimals)
            .toString(),
        };
      });
    }

    return {
      isEIP1559,
      gasEIP1559,
    };
  }

  override async getGasFee(
    params: IServerGasFeeParams,
  ): Promise<IServerGasFeeResponse> {
    let l1Fee: IAmountUnit = '0';
    const network = await this.backgroundApi.serviceNetwork.getNetwork({
      networkId: params.networkId,
    });

    if (network.feeMeta.isWithL1BaseFee) {
      l1Fee = await this.getL1Fee(params);
    }

    return {
      baseFee: l1Fee,
    };
  }

  protected async getL1Fee(params: IServerGasFeeParams): Promise<IAmountUnit> {
    const encodedTx = params.encodedTx as IEncodedTxEvm;
    const unsignedTx = ethers.Transaction.from({
      // type: encodedTx.type,
      to: encodedTx.to,
      data: encodedTx.data,
      value: encodedTx.value,
      gasLimit: encodedTx.gasLimit,
      nonce: Number(encodedTx.nonce ?? 1), // all >0 have the same effect
      chainId: encodedTx.chainId ?? 1, // all >0 have the same effect
      gasPrice: encodedTx.gasPrice ?? 1e9, // value to keep size for unsignedSerialized length
      maxFeePerGas: encodedTx.maxFeePerGas ?? 1e9, // value to keep size for unsignedSerialized length
      maxPriorityFeePerGas: encodedTx.maxPriorityFeePerGas ?? 1e9, // value to keep size for unsignedSerialized length
      // maxFeePerBlobGas
    });
    const bytes = unsignedTx.unsignedSerialized;

    const l1Fee = await this.client.call<string>('eth_call', [
      {
        to: this.l2PriceOracleAddress,
        data: INTERFACE.getL1Fee(bytes).data,
      },
      'latest',
    ]);

    return new B(l1Fee.toString()).times(BASE_FEE_RATE).toFixed(0);
  }

  override async getGasLimit(
    params: IServerGasLimitParams,
  ): Promise<IServerGasLimitResponse> {
    const estimateGasLimitRes = await this.client.call<string>(
      'eth_estimateGas',
      [pick(params.encodedTx, 'from', 'to', 'value', 'data')],
    );

    const estimateGasLimit = Number(estimateGasLimitRes);

    const gasLimit =
      (params.encodedTx as IEncodedTxEvm)?.data === EMPTY_DATA
        ? estimateGasLimit
        : estimateGasLimit * GAS_LIMIT_RATE;

    return {
      gasLimit: Math.ceil(gasLimit).toString(),
      estimateGasLimit: estimateGasLimit.toString(),
    };
  }

  override async getHistoryDetailFromThirdParty(
    params: IServerFetchAccountHistoryDetailParams,
  ): Promise<IFetchHistoryTxDetailsResp> {
    const { txid, accountAddress } = params;
    const res = await this.client.batchCall<
      [IEvmGetTransactionByHash, IEvmGetTransactionReceipt]
    >([
      ['eth_getTransactionByHash', [txid]],
      ['eth_getTransactionReceipt', [txid]],
    ]);

    const tx = res[0];
    const receipt = res[1];

    if (!tx || !receipt) {
      throw new Error(
        `[ProviderEVMFork.getHistoryDetail] Can not find transaction by hash: ${txid}`,
      );
    }

    const nativeToken = await this.getNativeToken();

    if (!nativeToken.info?.decimals) {
      throw new Error('decimals is undefined');
    }

    const gasFee = new B(receipt?.effectiveGasPrice ?? 0)
      .multipliedBy(receipt?.gasUsed)
      .shiftedBy(-nativeToken.info.decimals);

    const value = new B(tx?.value ?? '0').shiftedBy(-nativeToken.info.decimals);

    let transfers: IOnChainHistoryTxTransfer[] = [
      {
        label: 'Transfer',
        from: tx?.from,
        to: tx?.to,
        amount: value.toString(),
        token: this.nativeTokenAddress,
      } as IOnChainHistoryTxTransfer,
    ];

    const sends: IOnChainHistoryTxTransfer[] = [];
    const receives: IOnChainHistoryTxTransfer[] = [];

    if (accountAddress) {
      transfers.forEach((item) => {
        if (item.from === params.accountAddress) {
          sends.push(item);
        }
        if (item.to === params.accountAddress) {
          receives.push(item);
        }
      });
      transfers = [];
    }

    let status = EOnChainHistoryTxStatus.Failed;

    if (new B(receipt?.status).isGreaterThan(0)) {
      status = EOnChainHistoryTxStatus.Success;
    }

    return {
      // @ts-expect-error
      tokens: {
        [nativeToken.info.address]: nativeToken,
      },
      data: {
        tx: txid,
        from: tx?.from,
        to: tx?.to,
        riskLevel: 0,
        sends,
        receives,
        transfers,
        status,
        block: safeNumber(receipt?.blockNumber),
        // @ts-expect-error
        timestamp: undefined,
        gasFee: gasFee.toString(),
        gasFeeFiatValue: safeNumberString(
          gasFee.multipliedBy(nativeToken.price),
        ),
        // @ts-expect-error
        nonce: safeNumber(tx?.nonce),
        value: value.toString(),
      },
    };
  }
}

export { EvmApiProvider };
