import BigNumber from 'bignumber.js';

import {
  EDeFiAssetType,
  type IDeFiAsset,
  type IDeFiPosition,
  type IDeFiProtocol,
  type IProtocolSummary,
} from '../../types/defi';

import { normalizeDeFiPositionMetadata } from './defiPositionMetadataUtils';

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
  return assets.reduce(
    (acc, asset) => {
      const existingAsset = acc.find(
        (a) =>
          a.symbol === asset.symbol &&
          a.address === asset.address &&
          a.category === asset.category &&
          a.type === asset.type,
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
    },
    [] as (IDeFiAsset & { type: EDeFiAssetType })[],
  );
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

function buildGroupedPositionKey({ groupId }: { groupId: string }) {
  return groupId;
}

function sumAssetValues(assets: { value: number }[]) {
  return assets.reduce(
    (acc, asset) => acc.plus(asset.value ?? 0),
    new BigNumber(0),
  );
}

function getSafeGroupedPositionId({
  position,
  positionIndex,
}: {
  position: IDeFiPosition;
  positionIndex: number;
}) {
  const normalizedGroupId = position.groupId?.trim();

  if (normalizedGroupId) {
    return normalizedGroupId;
  }

  // Fail closed when upstream group_id is missing so unrelated positions
  // never collapse into one UI group.
  return `__ungrouped__${position.protocol}-${position.category}-${positionIndex}`;
}

type IGroupedPositionValue = {
  groupId: string;
  poolName: string;
  poolFullName: string;
  category: string;
  assets: (IDeFiAsset & { type: EDeFiAssetType })[];
  debts: (IDeFiAsset & { type: EDeFiAssetType })[];
  rewards: (IDeFiAsset & { type: EDeFiAssetType })[];
  sourcePositions: IDeFiPosition[];
  value: BigNumber;
};

function getGroupedPositionMetadata(position: IDeFiPosition) {
  const { targetString, originalString } = extractParenthesizedContent(
    position.name,
  );
  return {
    poolName: targetString,
    poolFullName: originalString,
    category: position.category,
  };
}

function shouldUsePositionMetadata({
  current,
  incoming,
}: {
  current: IGroupedPositionValue;
  incoming: IDeFiPosition;
}) {
  const currentHasPrincipal =
    current.assets.length > 0 || current.debts.length > 0;
  const incomingHasPrincipal =
    incoming.assets.length > 0 || incoming.debts.length > 0;

  if (incomingHasPrincipal && !currentHasPrincipal) {
    return true;
  }

  return current.category === 'rewards' && incoming.category !== 'rewards';
}

function updateGroupedPositionMetadata({
  current,
  incoming,
}: {
  current: IGroupedPositionValue;
  incoming: IDeFiPosition;
}) {
  const metadata = getGroupedPositionMetadata(incoming);
  current.poolName = metadata.poolName;
  current.poolFullName = metadata.poolFullName;
  current.category = metadata.category;
}

function transferPositionMap(positionMap: Map<string, IGroupedPositionValue>) {
  const positions = Array.from(positionMap.entries())
    .map(([_, position]) => ({
      groupId: position.groupId,
      poolName: position.poolName,
      poolFullName: position.poolFullName,
      category: position.category,
      assets: mergeAssets(position.assets).toSorted((a, b) =>
        new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
      ),
      debts: mergeAssets(position.debts).toSorted((a, b) =>
        new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
      ),
      rewards: mergeAssets(position.rewards).toSorted((a, b) =>
        new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
      ),
      value: position.value.toFixed(),
      sourcePositions: position.sourcePositions,
    }))
    .toSorted((a, b) =>
      new BigNumber(b.value).comparedTo(new BigNumber(a.value)),
    );
  return positions;
}

function transformDeFiData({
  accountId,
  indexedAccountId,
  positions,
  protocolSummaries,
}: {
  accountId?: string;
  indexedAccountId?: string;
  positions: Record<string, IDeFiPosition[]>;
  protocolSummaries: IProtocolSummary[];
}) {
  const protocolMap: Record<string, IProtocolSummary> = {};
  const protocolPositionsMap = new Map<
    string,
    {
      owner: string;
      accountId?: string;
      indexedAccountId?: string;
      networkId: string;
      protocol: string;
      positionMap: Map<string, IGroupedPositionValue>; // key: groupId
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
    networkPositions.forEach((position, positionIndex) => {
      const normalizedPosition = normalizeDeFiPositionMetadata(position);
      const protocolPositionsMapKey = `${normalizedPosition.networkId}-${normalizedPosition.protocol}`;

      if (!protocolPositionsMap.has(protocolPositionsMapKey)) {
        protocolPositionsMap.set(protocolPositionsMapKey, {
          accountId,
          indexedAccountId,
          owner: normalizedPosition.owner,
          networkId: normalizedPosition.networkId,
          protocol: normalizedPosition.protocol,
          positionMap: new Map(),
          categorySet: new Set(),
        });
      }

      const protocolPositionsMapValue = protocolPositionsMap.get(
        protocolPositionsMapKey,
      ) as {
        owner: string;
        accountId?: string;
        indexedAccountId?: string;
        networkId: string;
        protocol: string;
        positionMap: Map<string, IGroupedPositionValue>; // key: groupId
        categorySet: Set<string>;
      };

      const safeGroupId = getSafeGroupedPositionId({
        position: normalizedPosition,
        positionIndex,
      });

      const positionKey = buildGroupedPositionKey({
        groupId: safeGroupId,
      });

      const isNewPositionGroup =
        !protocolPositionsMapValue.positionMap.has(positionKey);
      if (isNewPositionGroup) {
        const metadata = getGroupedPositionMetadata(normalizedPosition);
        protocolPositionsMapValue.positionMap.set(positionKey, {
          groupId: safeGroupId,
          ...metadata,
          assets: [],
          debts: [],
          rewards: [],
          sourcePositions: [],
          value: new BigNumber(0),
        });
      }

      const positionValue = protocolPositionsMapValue.positionMap.get(
        positionKey,
      ) as IGroupedPositionValue;

      if (
        !isNewPositionGroup &&
        shouldUsePositionMetadata({
          current: positionValue,
          incoming: normalizedPosition,
        })
      ) {
        updateGroupedPositionMetadata({
          current: positionValue,
          incoming: normalizedPosition,
        });
      }

      const assets = normalizedPosition.assets.map((asset) => ({
        ...asset,
        type: EDeFiAssetType.ASSET,
      }));
      const debts = normalizedPosition.debts.map((debt) => ({
        ...debt,
        type: EDeFiAssetType.DEBT,
      }));
      const rewards = normalizedPosition.rewards.map((reward) => ({
        ...reward,
        type: EDeFiAssetType.REWARD,
      }));

      positionValue.assets.push(...assets);
      positionValue.debts.push(...debts);
      positionValue.rewards.push(...rewards);
      positionValue.sourcePositions.push(normalizedPosition);
      // calculate value
      positionValue.value = positionValue.value.plus(
        normalizedPosition.assets
          .reduce((acc, asset) => acc.plus(asset.value), new BigNumber(0))

          .plus(
            normalizedPosition.rewards.reduce(
              (acc, reward) => acc.plus(reward.value),
              new BigNumber(0),
            ),
          )
          .minus(
            normalizedPosition.debts.reduce(
              (acc, debt) => acc.plus(debt.value),
              new BigNumber(0),
            ),
          ),
      );

      protocolPositionsMapValue.categorySet.add(normalizedPosition.category);
    });
  });

  Array.from(protocolPositionsMap.values()).forEach((value) => {
    const protocolMapKey = buildProtocolMapKey({
      protocol: value.protocol,
      networkId: value.networkId,
    });
    if (protocolMap[protocolMapKey]) {
      return;
    }

    const groupedPositions = Array.from(value.positionMap.values());
    const totalValue = groupedPositions.reduce(
      (acc, position) => acc.plus(sumAssetValues(position.assets)),
      new BigNumber(0),
    );
    const totalDebt = groupedPositions.reduce(
      (acc, position) => acc.plus(sumAssetValues(position.debts)),
      new BigNumber(0),
    );
    const totalReward = groupedPositions.reduce(
      (acc, position) => acc.plus(sumAssetValues(position.rewards)),
      new BigNumber(0),
    );
    const firstSourcePosition = groupedPositions
      .flatMap((position) => position.sourcePositions)
      .find(Boolean);

    protocolMap[protocolMapKey] = {
      protocol: value.protocol,
      protocolName: firstSourcePosition?.protocolName ?? value.protocol,
      totalValue: totalValue.toNumber(),
      totalDebt: totalDebt.toNumber(),
      totalReward: totalReward.toNumber(),
      netWorth: totalValue.plus(totalReward).minus(totalDebt).toNumber(),
      networkIds: [value.networkId],
      positionCount: groupedPositions.length,
      positionIndices: [],
      protocolLogo: '',
      protocolUrl: '',
    };
  });

  const protocols: IDeFiProtocol[] = Array.from(protocolPositionsMap.values())
    .map((value) => ({
      networkId: value.networkId,
      owner: value.owner,
      accountId: value.accountId,
      indexedAccountId: value.indexedAccountId,
      protocol: value.protocol,
      positions: transferPositionMap(value.positionMap),
      categories: Array.from(value.categorySet),
    }))
    .toSorted((a, b) =>
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
