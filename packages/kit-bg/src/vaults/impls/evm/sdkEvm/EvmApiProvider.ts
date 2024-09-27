import B from 'bignumber.js';
import { defaultAbiCoder } from 'ethers/lib/utils';
import { isNil, keyBy, uniq } from 'lodash';

import type {
  IJsonRpcBatchParams,
  IJsonRpcParams,
} from '@onekeyhq/shared/src/request/JsonRPCRequest';
import type {
  IFetchServerTokenListApiParams,
  IServerAccountTokenItem,
  IServerTokenListQuery,
} from '@onekeyhq/shared/types/serverToken';

import { BaseApiProvider } from './BaseApiProvider';
import { parseTokenItem, safeNumberString } from './utils';

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
}

export { EvmApiProvider };
