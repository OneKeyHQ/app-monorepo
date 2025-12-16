import BigNumber from 'bignumber.js';
import { flatMap, groupBy, map } from 'lodash';

import {
  EDeFiAssetType,
  type IDeFiAsset,
  type IDeFiPosition,
  type IDeFiProtocol,
  type IProtocolSummary,
} from '../../types/defi';

function buildProtocolMapKey({
  protocol,
  networkId,
}: {
  protocol: string;
  networkId: string;
}) {
  return `${networkId}-${protocol}`;
}

function transferPositionMap(
  positionMap: Map<
    string,
    {
      groupId: string;
      poolName: string;
      category: string;
      assets: (IDeFiAsset & { type: EDeFiAssetType })[];
      debts: (IDeFiAsset & { type: EDeFiAssetType })[];
      rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
      value: BigNumber;
    }
  >,
) {
  const positions = Array.from(positionMap.entries()).map(([_, position]) => ({
    ...position,
    assets: position.assets.sort((a, b) => b.value - a.value),
    debts: position.debts.sort((a, b) => b.value - a.value),
    rewards: position.rewards.sort((a, b) => b.value - a.value),
    value: position.value.toFixed(),
  }));

  const groupedPositions = map(
    groupBy(positions, 'category'),
    (_positions, category) => ({
      category,
      value: _positions
        .reduce((acc, position) => acc.plus(position.value), new BigNumber(0))
        .toFixed(),
      details: _positions.sort((a, b) =>
        new BigNumber(b.value).minus(new BigNumber(a.value)).toNumber(),
      ),
    }),
  );

  return flatMap(
    groupedPositions.sort((a, b) =>
      new BigNumber(b.value).minus(new BigNumber(a.value)).toNumber(),
    ),
    (group) => group.details,
  );
}

function transformDeFiData({
  positions,
  protocolSummaries,
}: {
  positions: Record<string, IDeFiPosition[]>;
  protocolSummaries: IProtocolSummary[];
}) {
  const protocolMap: Record<string, IProtocolSummary> = {};
  const protocolPositionsMap = new Map<
    string,
    {
      owner: string;
      networkId: string;
      protocol: string;
      positionMap: Map<
        string,
        {
          groupId: string;
          poolName: string;
          category: string;
          assets: (IDeFiAsset & { type: EDeFiAssetType })[];
          debts: (IDeFiAsset & { type: EDeFiAssetType })[];
          rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
          value: BigNumber;
        }
      >; // key: category
      categorySet: Set<string>;
    }
  >();

  protocolSummaries.forEach((summary) => {
    protocolMap[
      buildProtocolMapKey({
        protocol: summary.protocol,
        networkId: summary.networkIds[0],
      })
    ] = summary;
  });

  Object.values(positions).forEach((networkPositions) => {
    networkPositions.forEach((position) => {
      const protocolPositionsMapKey = `${position.networkId}-${position.protocol}`;

      if (!protocolPositionsMap.has(protocolPositionsMapKey)) {
        protocolPositionsMap.set(protocolPositionsMapKey, {
          owner: position.owner,
          networkId: position.networkId,
          protocol: position.protocol,
          positionMap: new Map(),
          categorySet: new Set(),
        });
      }

      const protocolPositionsMapValue = protocolPositionsMap.get(
        protocolPositionsMapKey,
      ) as {
        owner: string;
        networkId: string;
        protocol: string;
        positionMap: Map<
          string,
          {
            groupId: string;
            poolName: string;
            category: string;
            assets: (IDeFiAsset & { type: EDeFiAssetType })[];
            debts: (IDeFiAsset & { type: EDeFiAssetType })[];
            rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
            value: BigNumber;
          }
        >; // key: category
        categorySet: Set<string>;
      };

      const positionKey = position.groupId;

      if (!protocolPositionsMapValue.positionMap.has(positionKey)) {
        protocolPositionsMapValue.positionMap.set(positionKey, {
          groupId: position.groupId,
          poolName: position.name,
          category: position.category,
          assets: [],
          debts: [],
          rewards: [],
          value: new BigNumber(0),
        });
      }

      const positionValue = protocolPositionsMapValue.positionMap.get(
        positionKey,
      ) as {
        groupId: string;
        poolName: string;
        category: string;
        assets: (IDeFiAsset & { type: EDeFiAssetType })[];
        debts: (IDeFiAsset & { type: EDeFiAssetType })[];
        rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
        value: BigNumber;
      };

      const assets = position.assets.map((asset) => ({
        ...asset,
        type: EDeFiAssetType.ASSET,
      }));
      const debts = position.debts.map((debt) => ({
        ...debt,
        type: EDeFiAssetType.DEBT,
      }));
      const rewards = position.rewards.map((reward) => ({
        ...reward,
        type: EDeFiAssetType.REWARD,
      }));

      positionValue.assets.push(...assets);
      positionValue.debts.push(...debts);
      positionValue.rewards.push(...rewards);
      // calculate value
      positionValue.value = positionValue.value.plus(
        position.assets
          .reduce((acc, asset) => acc.plus(asset.value), new BigNumber(0))

          .plus(
            position.rewards.reduce(
              (acc, reward) => acc.plus(reward.value),
              new BigNumber(0),
            ),
          )
          .minus(
            position.debts.reduce(
              (acc, debt) => acc.plus(debt.value),
              new BigNumber(0),
            ),
          ),
      );

      protocolPositionsMapValue.categorySet.add(position.category);
    });
  });

  const protocols: IDeFiProtocol[] = Array.from(protocolPositionsMap.values())
    .map((value) => ({
      ...value,
      positions: transferPositionMap(value.positionMap),
      categories: Array.from(value.categorySet),
    }))
    .sort((a, b) =>
      new BigNumber(
        protocolMap[
          buildProtocolMapKey({
            protocol: b.protocol,
            networkId: b.networkId,
          })
        ]?.netWorth ?? 0,
      )
        .minus(
          new BigNumber(
            protocolMap[
              buildProtocolMapKey({
                protocol: a.protocol,
                networkId: a.networkId,
              })
            ]?.netWorth ?? 0,
          ),
        )
        .toNumber(),
    );

  return {
    protocols,
    protocolMap,
  };
}

export function getEmptyDeFiData() {
  return {
    overview: {
      totalValue: '0',
      totalDebt: '0',
      netWorth: '0',
      chains: [],
      protocolCount: 0,
      positionCount: 0,
    },
    protocols: [],
    protocolMap: {},
  } as {
    overview: {
      totalValue: string;
      totalDebt: string;
      netWorth: string;
      chains: string[];
      protocolCount: number;
      positionCount: number;
    };
    protocols: IDeFiProtocol[];
    protocolMap: Record<string, IProtocolSummary>;
  };
}

export default {
  getEmptyDeFiData,
  transformDeFiData,
  buildProtocolMapKey,
};
