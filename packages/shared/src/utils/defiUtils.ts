import BigNumber from 'bignumber.js';

import {
  EDeFiAssetType,
  type IDeFiAsset,
  type IDeFiPosition,
  type IDeFiProtocol,
  type IProtocolSummary,
} from '../../types/defi';

function extractParenthesizedContent(input: string) {
  const startIndex = input.indexOf('(');

  if (startIndex === -1) {
    return { originalString: input, targetString: input };
  }

  let balance = 0;
  let endIndex = -1;

  for (let i = startIndex; i < input.length; i += 1) {
    const char = input[i];
    if (char === '(') {
      balance += 1;
    } else if (char === ')') {
      balance -= 1;
    }

    if (balance === 0) {
      endIndex = i;
      break;
    }
  }

  if (endIndex === -1) {
    return { originalString: input, targetString: input };
  }

  const contentInside = input.substring(startIndex + 1, endIndex);

  const emojiRegex =
    /[\p{Extended_Pictographic}\u{1F300}-\u{1F5FF}\u{1F900}-\u{1F9FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  const urlRegex = /((https?:\/\/[^\s]+)|(([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}))/g;

  const cleanedInside = contentInside
    .replace(emojiRegex, '')
    .replace(urlRegex, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (
    cleanedInside.length > 0 &&
    cleanedInside.toLowerCase() !== 'yes' &&
    cleanedInside.toLowerCase() !== 'no'
  ) {
    return { originalString: input, targetString: cleanedInside };
  }
  const partBefore = input.substring(0, startIndex);
  const partAfter = input.substring(endIndex + 1);

  const outerContent = `${partBefore} ${partAfter}`.replace(/\s+/g, ' ').trim();

  return { originalString: input, targetString: outerContent };
}

function mergeAssets(assets: (IDeFiAsset & { type: EDeFiAssetType })[]) {
  return assets.reduce((acc, asset) => {
    const existingAsset = acc.find(
      (a) => a.symbol === asset.symbol && a.address === asset.address,
    );
    if (existingAsset) {
      existingAsset.value = new BigNumber(existingAsset.value)
        .plus(asset.value)
        .toNumber();
      existingAsset.amount = new BigNumber(existingAsset.amount)
        .plus(asset.amount)
        .toFixed();
    } else {
      acc.push(asset);
    }
    return acc;
  }, [] as (IDeFiAsset & { type: EDeFiAssetType })[]);
}

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
      poolFullName: string;
      category: string;
      assets: (IDeFiAsset & { type: EDeFiAssetType })[];
      debts: (IDeFiAsset & { type: EDeFiAssetType })[];
      rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
      value: BigNumber;
    }
  >,
) {
  const positions = Array.from(positionMap.entries())
    .map(([_, position]) => ({
      groupId: position.groupId,
      poolName: position.poolName,
      poolFullName: position.poolFullName,
      category: position.category,
      assets: mergeAssets(position.assets).sort((a, b) =>
        new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
      ),
      debts: mergeAssets(position.debts).sort((a, b) =>
        new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
      ),
      rewards: mergeAssets(position.rewards).sort((a, b) =>
        new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
      ),
      value: position.value.toFixed(),
    }))
    .sort((a, b) => new BigNumber(b.value).comparedTo(new BigNumber(a.value)));
  return positions;
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
          poolFullName: string;
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
            poolFullName: string;
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
        const { targetString, originalString } = extractParenthesizedContent(
          position.name,
        );
        protocolPositionsMapValue.positionMap.set(positionKey, {
          groupId: position.groupId,
          poolName: targetString,
          poolFullName: originalString,
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
        poolFullName: string;
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
      networkId: value.networkId,
      owner: value.owner,
      protocol: value.protocol,
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

function getEmptyDeFiData() {
  return {
    overview: {
      totalValue: 0,
      totalDebt: 0,
      netWorth: 0,
      totalReward: 0,
      chains: [],
      protocolCount: 0,
      positionCount: 0,
    },
    protocols: [],
    protocolMap: {},
  } as {
    overview: {
      totalValue: number;
      totalDebt: number;
      netWorth: number;
      totalReward: number;
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
