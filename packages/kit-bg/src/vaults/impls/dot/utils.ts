import {
  type DecodedSignedTx,
  type TypeRegistry,
  getRegistry as _getRegistry,
} from '@substrate/txwrapper-polkadot';
import BigNumber from 'bignumber.js';
import { isEmpty, isNil } from 'lodash';

import { memoizee } from '@onekeyhq/shared/src/utils/cacheUtils';
import hexUtils from '@onekeyhq/shared/src/utils/hexUtils';
import numberUtils from '@onekeyhq/shared/src/utils/numberUtils';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';
import { EDecodedTxActionType } from '@onekeyhq/shared/types/tx';

import type { IBackgroundApi } from '../../../apis/IBackgroundApi';

export const getTransactionTypeV2 = (module: string) => {
  if (module === 'balances') {
    return EDecodedTxActionType.ASSET_TRANSFER;
  }

  if (module === 'assets') {
    return EDecodedTxActionType.ASSET_TRANSFER;
  }

  return EDecodedTxActionType.UNKNOWN;
};

export const getTransactionType = (module: string, func: string) => {
  const formatFunc = func.replace(/(_)/g, '').toLowerCase();

  if (
    module === 'balances' &&
    (formatFunc === 'transfer' ||
      formatFunc === 'transferkeepalive' ||
      formatFunc === 'transferallowdeath' ||
      formatFunc === 'transferall')
  ) {
    return EDecodedTxActionType.ASSET_TRANSFER;
  }

  if (
    module === 'assets' &&
    (formatFunc === 'transfer' || formatFunc === 'transferkeepalive')
  ) {
    return EDecodedTxActionType.ASSET_TRANSFER;
  }

  return EDecodedTxActionType.UNKNOWN;
};

export const getTransactionTypeFromTxInfo = (tx: DecodedSignedTx) => {
  const { name: methodName, pallet } = tx.method;

  return getTransactionType(pallet, methodName);
};

export const getMetadataRpc = memoizee(
  async (networkId: string, backgroundApi: IBackgroundApi) => {
    const [res] =
      await backgroundApi.serviceAccountProfile.sendProxyRequest<`0x${string}`>(
        {
          networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'state_getMetadata',
                params: [],
              },
            },
          ],
        },
      );
    return res;
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
    promise: true,
    normalizer(args) {
      return args[0];
    },
  },
);

export const getRuntimeVersion = memoizee(
  async (networkId: string, backgroundApi: IBackgroundApi) => {
    const [res] = await backgroundApi.serviceAccountProfile.sendProxyRequest<{
      specName: string;
      specVersion: number;
      transactionVersion: number;
    }>({
      networkId,
      body: [
        {
          route: 'rpc',
          params: {
            method: 'state_getRuntimeVersion',
            params: [],
          },
        },
      ],
    });
    return res;
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
    promise: true,
    normalizer(args) {
      return args[0];
    },
  },
);

export const getGenesisHash = memoizee(
  async (networkId: string, backgroundApi: IBackgroundApi) => {
    const [res] =
      await backgroundApi.serviceAccountProfile.sendProxyRequest<`0x${string}`>(
        {
          networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'chain_getBlockHash',
                params: [0],
              },
            },
          ],
        },
      );
    return res;
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
    promise: true,
    normalizer(args) {
      return args[0];
    },
  },
);

export const getRegistry = memoizee(
  async (
    params: {
      networkId: string;
      metadataRpc?: `0x${string}`;
      specVersion?: string | number;
      specName?: string;
    },
    backgroundApi: IBackgroundApi,
  ): Promise<TypeRegistry> => {
    const networkId = params.networkId;
    const network = await backgroundApi.serviceNetwork.getNetwork({
      networkId,
    });

    let metadataRpcHex: `0x${string}`;
    if (isNil(params.metadataRpc) || isEmpty(params.metadataRpc)) {
      metadataRpcHex = await getMetadataRpc(networkId, backgroundApi);
    } else {
      metadataRpcHex = params.metadataRpc;
    }

    let specVersion: number;
    let specName: string;
    if (
      !params.specVersion ||
      isEmpty(params.specVersion) ||
      !params.specName ||
      isEmpty(params.specName)
    ) {
      const res = await getRuntimeVersion(networkId, backgroundApi);
      specVersion = res.specVersion;
      specName = res.specName;
    } else {
      specVersion = +numberUtils.hexToDecimal(
        hexUtils.addHexPrefix(params.specVersion.toString()),
      );
      specName = params.specName;
    }

    return _getRegistry({
      chainName: network.name,
      specName: specName as 'polkadot',
      specVersion,
      metadataRpc: metadataRpcHex,
    });
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
    promise: true,
    normalizer(args) {
      return args[0].networkId;
    },
  },
);

export const getMinAmount = memoizee(
  async (networkId: string, backgroundApi: IBackgroundApi) => {
    const [minAmountStr] =
      await backgroundApi.serviceAccountProfile.sendProxyRequest<string>({
        networkId,
        body: [
          {
            route: 'consts',
            params: {
              method: 'balances.existentialDeposit',
              params: [],
            },
          },
        ],
      });
    return new BigNumber(minAmountStr);
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ minute: 10 }),
    promise: true,
    normalizer(args) {
      return args[0];
    },
  },
);

export const getBlockInfo = memoizee(
  async (
    networkId: string,
    backgroundApi: IBackgroundApi,
  ): Promise<{
    blockHash: `0x${string}`;
    blockNumber: number;
  }> => {
    const [blockHash] =
      await backgroundApi.serviceAccountProfile.sendProxyRequest<`0x${string}`>(
        {
          networkId,
          body: [
            {
              route: 'rpc',
              params: {
                method: 'chain_getBlockHash',
                params: [],
              },
            },
          ],
        },
      );
    const [{ block }] =
      await backgroundApi.serviceAccountProfile.sendProxyRequest<{
        block: { header: { number: number } };
      }>({
        networkId,
        body: [
          {
            route: 'rpc',
            params: {
              method: 'chain_getBlock',
              params: [blockHash],
            },
          },
        ],
      });

    return {
      blockHash,
      blockNumber: block.header.number,
    };
  },
  {
    maxAge: timerUtils.getTimeDurationMs({ minute: 1 }),
    promise: true,
    normalizer(args) {
      return args[0];
    },
  },
);
