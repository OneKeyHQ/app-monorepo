import BigNumber from 'bignumber.js';

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

function transformDeFiData({
  positions,
  protocolSummaries,
}: {
  positions: Record<string, IDeFiPosition[]>;
  protocolSummaries: IProtocolSummary[];
}) {
  const protocolMap = new Map<string, IProtocolSummary>();
  const protocolPositionsMap = new Map<
    string,
    {
      owner: string;
      networkId: string;
      protocol: string;
      positionMap: Map<
        string,
        {
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
    protocolMap.set(
      buildProtocolMapKey({
        protocol: summary.protocol,
        networkId: summary.networkIds[0],
      }),
      summary,
    );
  });

  Object.values(positions).forEach((networkPositions) => {
    networkPositions.forEach((position) => {
      const protocolPositionsMapKey = `${position.networkId}-${position.protocol}`;

      if (!protocolMap.has(protocolPositionsMapKey)) {
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
            assets: (IDeFiAsset & { type: EDeFiAssetType })[];
            debts: (IDeFiAsset & { type: EDeFiAssetType })[];
            rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
            value: BigNumber;
          }
        >; // key: category
        categorySet: Set<string>;
      };

      const positionKey = position.category;

      if (!protocolPositionsMapValue.positionMap.has(positionKey)) {
        protocolPositionsMapValue.positionMap.set(positionKey, {
          assets: [],
          debts: [],
          rewards: [],
          value: new BigNumber(0),
        });
      }

      const positionValue = protocolPositionsMapValue.positionMap.get(
        positionKey,
      ) as {
        assets: (IDeFiAsset & { type: EDeFiAssetType })[];
        debts: (IDeFiAsset & { type: EDeFiAssetType })[];
        rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
        value: BigNumber;
      };

      positionValue.assets.push(
        ...position.assets.map((asset) => ({
          ...asset,
          type: EDeFiAssetType.ASSET,
        })),
      );
      positionValue.debts.push(
        ...position.debts.map((debt) => ({
          ...debt,
          type: EDeFiAssetType.DEBT,
        })),
      );
      positionValue.rewards.push(
        ...position.rewards.map((reward) => ({
          ...reward,
          type: EDeFiAssetType.REWARD,
        })),
      );
      // calculate value
      positionValue.value.plus(
        position.assets
          .reduce((acc, asset) => acc.plus(asset.valueUsd), new BigNumber(0))
          .plus(
            position.debts.reduce(
              (acc, debt) => acc.plus(debt.valueUsd),
              new BigNumber(0),
            ),
          )
          .plus(
            position.rewards.reduce(
              (acc, reward) => acc.plus(reward.valueUsd),
              new BigNumber(0),
            ),
          ),
      );

      protocolPositionsMapValue.categorySet.add(position.category);
    });
  });

  const protocols: IDeFiProtocol[] = Array.from(
    protocolPositionsMap.values(),
  ).map((value) => ({
    ...value,
    positions: Array.from(value.positionMap.entries()).map(
      ([key, position]) => ({
        ...position,
        category: key,
        value: position.value.toFixed(),
      }),
    ),
    categories: Array.from(value.categorySet),
  }));

  return {
    protocols,
    protocolMap,
  };
}

export default {
  transformDeFiData,
  buildProtocolMapKey,
};
