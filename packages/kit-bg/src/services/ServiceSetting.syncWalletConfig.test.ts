/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  buildAggregateTokenListMapKeyForTokenList,
  buildAggregateTokenMapKeyForAggregateConfig,
} from '@onekeyhq/shared/src/utils/tokenUtils';
import { ENetworkStatus, type IServerNetwork } from '@onekeyhq/shared/types';
import type { IFetchWalletConfigResp } from '@onekeyhq/shared/types/setting';
import type { IAggregateToken } from '@onekeyhq/shared/types/token';

import ServiceSetting from './ServiceSetting';

import type { SimpleDbEntityAggregateToken } from '../dbs/simple/entity/SimpleDbEntityAggregateToken';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => (target: any) => target,
  backgroundMethod: () => (_t: any, _k: string, desc: any) => desc,
  backgroundMethodForDev: () => (_t: any, _k: string, desc: any) => desc,
  toastIfError: () => (_t: any, _k: string, desc: any) => desc,
  checkDevOnlyPassword: jest.fn(),
}));

// Preset network.
const ethereum = {
  id: 'evm--1',
  status: ENetworkStatus.LISTED,
} as IServerNetwork;
// Server-delivered network that is not part of presetNetworks.
const robinhood = {
  id: 'evm--4663',
  status: ENetworkStatus.LISTED,
} as IServerNetwork;

type IUpdateAllAggregateInfoParams = Parameters<
  SimpleDbEntityAggregateToken['updateAllAggregateInfo']
>[0];

function buildMember(networkId: string): IAggregateToken {
  return { networkId, address: '', decimals: 18 } as IAggregateToken;
}

function buildService({
  networks,
  ensureServerNetworksFetched = jest.fn(async () => undefined),
}: {
  networks: IServerNetwork[] | (() => IServerNetwork[]);
  ensureServerNetworksFetched?: jest.Mock<Promise<void>, []>;
}) {
  const updateAllAggregateInfo = jest.fn(
    async (_params: IUpdateAllAggregateInfoParams) => undefined,
  );
  const service = new ServiceSetting({
    backgroundApi: {
      simpleDb: {
        aggregateToken: { updateAllAggregateInfo },
        approval: {
          updateApprovalResurfaceDaysConfig: jest.fn(async () => undefined),
        },
      },
      serviceNetwork: {
        getAllNetworks: jest.fn(async () => ({
          networks: typeof networks === 'function' ? networks() : networks,
        })),
      },
      serviceCustomRpc: {
        ensureServerNetworksFetched,
      },
    },
  });
  const config: IFetchWalletConfigResp['data'] = {
    meta: {
      homeDefaults: [],
      approvalResurfaceDays: 14,
      approvalAlertResurfaceDays: 30,
    },
    tokens: {
      ETH: {
        logoURI: 'eth.png',
        name: 'Ethereum',
        data: [
          buildMember('evm--1'),
          buildMember('evm--4663'),
          // Unknown to the client: must never reach the aggregate maps.
          buildMember('evm--999999'),
        ],
      },
    },
  };
  jest.spyOn(service, 'fetchWalletConfig').mockResolvedValue(config);
  return { service, updateAllAggregateInfo };
}

async function sync(service: ServiceSetting) {
  const configMap = await service.syncWalletConfig();
  if (!configMap) {
    throw new OneKeyLocalError('syncWalletConfig returned no config map');
  }
  return configMap;
}

describe('ServiceSetting.syncWalletConfig', () => {
  it('keeps aggregate members on server-delivered networks that are not presets', async () => {
    const { service, updateAllAggregateInfo } = buildService({
      networks: [ethereum, robinhood],
    });

    const configMap = await sync(service);

    expect(
      configMap[
        buildAggregateTokenMapKeyForAggregateConfig({
          networkId: 'evm--4663',
          tokenAddress: '',
        })
      ],
    ).toBeDefined();
    expect(
      configMap[
        buildAggregateTokenMapKeyForAggregateConfig({
          networkId: 'evm--999999',
          tokenAddress: '',
        })
      ],
    ).toBeUndefined();

    const { allAggregateTokenMap } = updateAllAggregateInfo.mock.calls[0][0];
    const ethGroup =
      allAggregateTokenMap[
        buildAggregateTokenListMapKeyForTokenList({ commonSymbol: 'ETH' })
      ];
    expect(ethGroup.tokens.map((token) => token.networkId)).toEqual([
      'evm--1',
      'evm--4663',
    ]);
  });

  it('drops members whose network is missing from the merged registry', async () => {
    const { service } = buildService({ networks: [ethereum] });

    const configMap = await sync(service);

    // Only one eligible member is left, so ETH is not an aggregate token.
    expect(Object.keys(configMap)).toEqual([]);
  });

  it('waits for the server-network cache before gating members', async () => {
    // Fresh install: the merged registry only knows presets until the first
    // server-network fetch lands, which is what ensureServerNetworksFetched
    // awaits.
    let cachedNetworks = [ethereum];
    const ensureServerNetworksFetched = jest.fn(async () => {
      cachedNetworks = [ethereum, robinhood];
    });
    const { service } = buildService({
      networks: () => cachedNetworks,
      ensureServerNetworksFetched,
    });

    const configMap = await sync(service);

    expect(ensureServerNetworksFetched).toHaveBeenCalledTimes(1);
    expect(
      configMap[
        buildAggregateTokenMapKeyForAggregateConfig({
          networkId: 'evm--4663',
          tokenAddress: '',
        })
      ],
    ).toBeDefined();
  });
});
