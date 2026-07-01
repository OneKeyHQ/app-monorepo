import { memo, useCallback, useMemo } from 'react';

import { StyleSheet } from 'react-native';

import {
  Button,
  Dialog,
  ScrollView,
  SizableText,
  XStack,
  YStack,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import {
  EParseTxComponentType,
  ETransferDirection,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmTestIDs } from '../../testIDs';
import { Simulation } from '../SignatureConfirmComponents/Simulation';

type ISimulationAsset = IDisplayComponentSimulation['assets'][number];

type ISimulationGroup = {
  id: string;
  label: string;
  assets: ISimulationAsset[];
};

type ISimulationAssetCandidate = {
  groupIndex: number;
  assetIndex: number;
  asset: ISimulationAsset;
};

type IProps = {
  simulationComponents?: IDisplayComponentSimulation[];
};

const ASSET_CHANGES_TITLE = 'Estimated asset changes';
const SIMULATION_DETAIL_LIMIT = 3;

function getSimulationAssetLabel(asset: ISimulationAsset) {
  if (asset.type === EParseTxComponentType.Token) {
    return asset.token.info.symbol;
  }
  if (asset.type === EParseTxComponentType.NFT) {
    return asset.nft.metadata?.name || asset.nft.collectionName || 'NFT';
  }
  if (asset.isNFT) {
    return asset.name || asset.symbol || 'NFT';
  }
  return asset.symbol || asset.name;
}

function getSimulationAssetAmount(asset: ISimulationAsset) {
  if (asset.type === EParseTxComponentType.Token) {
    return asset.amountParsed || asset.amount;
  }
  if (asset.type === EParseTxComponentType.InternalAssets) {
    if (asset.isNFT && asset.NFTType !== ENFTType.ERC1155) {
      return '';
    }
    return asset.amountParsed || asset.amount;
  }
  return asset.amount;
}

function getSimulationAssetSign(asset: ISimulationAsset) {
  const direction = getSimulationAssetDirection(asset);
  if (direction) {
    if (direction === ETransferDirection.In) {
      return '+';
    }
    if (direction === ETransferDirection.Out) {
      return '-';
    }
  }
  return '';
}

function getSimulationAssetDirection(asset: ISimulationAsset) {
  if ('transferDirection' in asset) {
    return asset.transferDirection;
  }
  return undefined;
}

function getSimulationAssetIconProps(asset: ISimulationAsset) {
  if (asset.type === EParseTxComponentType.Token) {
    return {
      tokenImageUri: asset.token.info.logoURI,
      networkId: asset.networkId ?? asset.token.info.networkId,
      showNetworkIcon: asset.showNetwork,
    };
  }
  if (asset.type === EParseTxComponentType.NFT) {
    return {
      isNFT: true,
      tokenImageUri: asset.nft.metadata?.image,
      networkId: asset.networkId ?? asset.nft.networkId,
      showNetworkIcon: asset.showNetwork,
    };
  }
  return {
    isNFT: asset.isNFT,
    tokenImageUri: asset.icon,
    networkId: asset.networkId,
    showNetworkIcon: shouldShowSimulationAssetNetwork(asset),
  };
}

function getSimulationAssetNetworkId(asset: ISimulationAsset) {
  if (asset.type === EParseTxComponentType.Token) {
    return asset.networkId ?? asset.token.info.networkId;
  }
  if (asset.type === EParseTxComponentType.NFT) {
    return asset.networkId ?? asset.nft.networkId;
  }
  return asset.networkId;
}

function shouldShowSimulationAssetNetwork(asset: ISimulationAsset) {
  if ('showNetwork' in asset) {
    return asset.showNetwork;
  }
  return false;
}

function getShownSimulationAssetNetworkId(asset: ISimulationAsset) {
  if (!shouldShowSimulationAssetNetwork(asset)) {
    return undefined;
  }
  return getSimulationAssetNetworkId(asset);
}

function getSimulationGroups(
  simulationComponents?: IDisplayComponentSimulation[],
) {
  return (
    simulationComponents
      ?.map((component, index) => ({
        id: `${component.label || ASSET_CHANGES_TITLE}-${index}`,
        label: component.label || ASSET_CHANGES_TITLE,
        assets: component.assets,
      }))
      .filter((group) => group.assets.length > 0) ?? []
  );
}

function getSimulationAssets(simulationGroups: ISimulationGroup[]) {
  return simulationGroups.flatMap((group) => group.assets);
}

function getPreferredSimulationAssets(
  assets: ISimulationAsset[],
  limit: number,
) {
  if (assets.length <= limit) {
    return assets;
  }
  if (limit <= 1) {
    return assets.slice(0, limit);
  }

  const selectedIndexes = new Set<number>();
  const addFirstByDirection = (direction: ETransferDirection) => {
    if (selectedIndexes.size >= limit) {
      return;
    }
    const index = assets.findIndex(
      (asset) => getSimulationAssetDirection(asset) === direction,
    );
    if (index >= 0) {
      selectedIndexes.add(index);
    }
  };

  addFirstByDirection(ETransferDirection.Out);
  addFirstByDirection(ETransferDirection.In);

  for (let i = 0; i < assets.length && selectedIndexes.size < limit; i += 1) {
    selectedIndexes.add(i);
  }

  return [...selectedIndexes]
    .toSorted((a, b) => a - b)
    .map((index) => assets[index]);
}

function getCandidateKey(candidate: ISimulationAssetCandidate) {
  return `${candidate.groupIndex}-${candidate.assetIndex}`;
}

function getVisibleMultiSimulationGroups(simulationGroups: ISimulationGroup[]) {
  const candidates = simulationGroups.flatMap((group, groupIndex) =>
    group.assets.map((asset, assetIndex) => ({
      groupIndex,
      assetIndex,
      asset,
    })),
  );
  const selectedKeys = new Set<string>();
  const addCandidate = (candidate?: ISimulationAssetCandidate) => {
    if (!candidate || selectedKeys.size >= SIMULATION_DETAIL_LIMIT) {
      return;
    }
    selectedKeys.add(getCandidateKey(candidate));
  };
  const firstOut = candidates.find(
    (candidate) =>
      getSimulationAssetDirection(candidate.asset) === ETransferDirection.Out,
  );
  const firstIn =
    candidates.find(
      (candidate) =>
        candidate.groupIndex !== firstOut?.groupIndex &&
        getSimulationAssetDirection(candidate.asset) === ETransferDirection.In,
    ) ??
    candidates.find(
      (candidate) =>
        getSimulationAssetDirection(candidate.asset) === ETransferDirection.In,
    );

  addCandidate(firstOut);
  addCandidate(firstIn);

  simulationGroups.forEach((_group, groupIndex) => {
    const hasSelectedGroup = candidates.some(
      (candidate) =>
        candidate.groupIndex === groupIndex &&
        selectedKeys.has(getCandidateKey(candidate)),
    );
    if (hasSelectedGroup) {
      return;
    }
    addCandidate(
      candidates.find(
        (candidate) =>
          candidate.groupIndex === groupIndex &&
          !selectedKeys.has(getCandidateKey(candidate)),
      ),
    );
  });
  candidates.forEach((candidate) => {
    addCandidate(candidate);
  });

  return simulationGroups
    .map((group, groupIndex) => ({
      ...group,
      assets: candidates
        .filter(
          (candidate) =>
            candidate.groupIndex === groupIndex &&
            selectedKeys.has(getCandidateKey(candidate)),
        )
        .map((candidate) => candidate.asset),
    }))
    .filter((group) => group.assets.length > 0);
}

function getVisibleSimulationGroups(simulationGroups: ISimulationGroup[]) {
  if (simulationGroups.length === 1) {
    const group = simulationGroups[0];
    return group
      ? [
          {
            ...group,
            assets: getPreferredSimulationAssets(
              group.assets,
              SIMULATION_DETAIL_LIMIT,
            ),
          },
        ]
      : [];
  }

  return getVisibleMultiSimulationGroups(simulationGroups);
}

function SimulationAssetText({ asset }: { asset: ISimulationAsset }) {
  const sign = getSimulationAssetSign(asset);
  const color = sign === '+' ? '$textSuccess' : '$text';
  return (
    <SizableText
      size="$bodySmMedium"
      color={color}
      numberOfLines={1}
      textAlign="right"
    >
      {`${sign}${getSimulationAssetAmount(asset)}`}
    </SizableText>
  );
}

function SimulationAssetNetworkName({
  asset,
  networkNameById,
}: {
  asset: ISimulationAsset;
  networkNameById: Record<string, string>;
}) {
  const networkId = getShownSimulationAssetNetworkId(asset);
  const networkName = networkId ? networkNameById[networkId] : undefined;

  if (!networkName) {
    return null;
  }

  return (
    <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
      {networkName}
    </SizableText>
  );
}

function SimulationAssetGroups({
  simulationGroups,
  networkNameById,
}: {
  simulationGroups: ISimulationGroup[];
  networkNameById: Record<string, string>;
}) {
  const showGroupLabel = simulationGroups.length > 1;

  return (
    <YStack gap="$1.5">
      {simulationGroups.map((group) => (
        <YStack key={group.id} gap="$1">
          {showGroupLabel ? (
            <SizableText
              size="$bodySmMedium"
              color="$textSubdued"
              numberOfLines={1}
            >
              {group.label}
            </SizableText>
          ) : null}
          {group.assets.map((asset, index) => (
            <XStack
              key={`${group.id}-${asset.type}-${getSimulationAssetLabel(
                asset,
              )}-${getSimulationAssetAmount(asset)}-${index}`}
              justifyContent="space-between"
              alignItems="center"
              gap="$3"
            >
              <XStack gap="$2" alignItems="center" flex={1} minWidth={0}>
                <Token
                  size="xs"
                  flexShrink={0}
                  {...getSimulationAssetIconProps(asset)}
                />
                <YStack flex={1} minWidth={0}>
                  <SizableText
                    size="$bodySmMedium"
                    color="$text"
                    numberOfLines={1}
                  >
                    {getSimulationAssetLabel(asset)}
                  </SizableText>
                  <SimulationAssetNetworkName
                    asset={asset}
                    networkNameById={networkNameById}
                  />
                </YStack>
              </XStack>
              <SimulationAssetText asset={asset} />
            </XStack>
          ))}
        </YStack>
      ))}
    </YStack>
  );
}

function TransactionPreview({ simulationComponents }: IProps) {
  const simulationGroups = useMemo(
    () => getSimulationGroups(simulationComponents),
    [simulationComponents],
  );
  const assets = useMemo(
    () => getSimulationAssets(simulationGroups),
    [simulationGroups],
  );
  const networkIds = useMemo(
    () => [
      ...new Set(
        assets
          .map(getShownSimulationAssetNetworkId)
          .filter((networkId): networkId is string => Boolean(networkId)),
      ),
    ],
    [assets],
  );
  const { result: networkNameById } = usePromiseResult(
    async () => {
      if (!networkIds.length) {
        return {};
      }
      const { networks } =
        await backgroundApiProxy.serviceNetwork.getNetworksByIds({
          networkIds,
        });
      return networks.reduce<Record<string, string>>((names, network) => {
        names[network.id] = network.name;
        return names;
      }, {});
    },
    [networkIds],
    {
      initResult: {},
    },
  );
  const visibleGroups = useMemo(
    () => getVisibleSimulationGroups(simulationGroups),
    [simulationGroups],
  );
  const visibleAssetCount = getSimulationAssets(visibleGroups).length;
  const remainingCount = assets.length - visibleAssetCount;

  const handleShowAllChanges = useCallback(() => {
    Dialog.show({
      title: ASSET_CHANGES_TITLE,
      renderContent: (
        <ScrollView maxHeight="$80" nestedScrollEnabled>
          <YStack gap="$3">
            {simulationGroups.map((group) => (
              <Simulation
                key={group.id}
                component={{
                  type: EParseTxComponentType.Simulation,
                  label: group.label,
                  assets: group.assets,
                }}
              />
            ))}
          </YStack>
        </ScrollView>
      ),
      showFooter: false,
    });
  }, [simulationGroups]);

  if (!assets.length) {
    return null;
  }

  return (
    <YStack
      testID={SignatureConfirmTestIDs.TransactionPreview}
      gap="$2"
      p="$3"
      borderWidth={StyleSheet.hairlineWidth}
      borderColor="$neutral3"
      borderRadius="$3"
      bg="$bgSubdued"
    >
      <SizableText size="$bodyMdMedium" numberOfLines={1}>
        {ASSET_CHANGES_TITLE}
      </SizableText>
      <SimulationAssetGroups
        simulationGroups={visibleGroups}
        networkNameById={networkNameById}
      />
      {remainingCount > 0 ? (
        <Button
          testID={SignatureConfirmTestIDs.TransactionPreviewViewAll}
          size="small"
          variant="tertiary"
          alignSelf="flex-start"
          onPress={handleShowAllChanges}
        >
          +{remainingCount} more
        </Button>
      ) : null}
    </YStack>
  );
}

export default memo(TransactionPreview);
