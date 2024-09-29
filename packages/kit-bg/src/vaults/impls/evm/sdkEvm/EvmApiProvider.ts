import B from 'bignumber.js';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { isNil, keyBy, orderBy, uniq } from 'lodash';

import { validateEvmAddress } from '@onekeyhq/core/src/chains/evm/sdkEvm';
import type { IEncodedTx } from '@onekeyhq/core/src/types';
import { NotImplemented } from '@onekeyhq/shared/src/errors';
import type {
  IJsonRpcBatchParams,
  IJsonRpcParams,
} from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type { IServerNetwork } from '@onekeyhq/shared/types';
import type {
  IEstimateGasParams,
  IEstimateGasResp,
  IServerEstimateFeeResponse,
  IServerGasPriceParams,
  IServerGasPriceResponse,
} from '@onekeyhq/shared/types/fee';
import type {
  IFetchServerTokenListApiParams,
  IServerAccountTokenItem,
  IServerTokenListQuery,
} from '@onekeyhq/shared/types/serverToken';

import { BaseApiProvider } from './BaseApiProvider';
import { parseTokenItem, safeNumberString } from './utils';

import type { BigNumber } from 'bignumber.js';

export enum EVMMethodIds {
  // eslint-disable-next-line spellcheck/spell-checker
  Allowance = '0xdd62ed3e', // keccak256(Buffer.from('Allnwance(address,address)')).toString('hex') => 0xdd62ed3e7e1f3d1f3f6
  balanceOf = '0x70a08231', // keccak256(Buffer.from('balanceOf(address)')).toString('hex') => 0x70a082310
  resolver = '0x0178b8bf', // keccak256(Buffer.from('resolver(byte32)')).toString('hex') => 0x70a082310
  addr = '0xf1cb7e06', // keccak256(Buffer.from('addr(byte32,uint256)')).toString('hex') => 0x70a082310
}

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

  override async listAccountTokenFromRpc(
    params: IFetchServerTokenListApiParams,
  ): Promise<IServerAccountTokenItem[]> {
    console.log('listAccountTokenFromRpc: ======>>>>>>1: ', params);
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

    console.log('listAccountTokenFromRpc: ======>>>>>> requests: ', requests);
    const balances = await this.client.batchCall<string[]>(
      requests as IJsonRpcBatchParams,
    );
    console.log('listAccountTokenFromRpc: ======>>>>>>6 balances: ', balances);

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

    console.log('getChainTokensFromRpc: ======>>>>>>2 payloads: ', payloads);
    const infos = await this.client.batchChunkCall<string>(
      payloads as Array<Array<[string, IJsonRpcParams]>>,
    );
    console.log('getChainTokensFromRpc: ======>>>>>>3 infos: ', infos);
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

    console.log('getChainTokensFromRpc: ======>>>>>>4 tokensMap: ', tokensMap);

    const result = (params.contractList ?? []).map((a) => {
      if (a === this.nativeTokenAddress) {
        return nativeToken;
      }
      if (!tokensMap[a]) {
        return null;
      }
      return parseTokenItem(tokensMap[a]);
    });
    console.log('getChainTokensFromRpc: ======>>>>>>5 result: ', result);
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
}

export { EvmApiProvider };
