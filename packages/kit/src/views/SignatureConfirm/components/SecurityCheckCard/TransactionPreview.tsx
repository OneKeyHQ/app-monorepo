import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';
import { StyleSheet } from 'react-native';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { ENFTType } from '@onekeyhq/shared/types/nft';
import {
  EParseTxComponentType,
  ETransferDirection,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmTestIDs } from '../../testIDs';

type ISimulationAsset = IDisplayComponentSimulation['assets'][number];

type ISimulationGroup = {
  id: string;
  label: string;
  assets: ISimulationAsset[];
};

type IProps = {
  simulationComponents?: IDisplayComponentSimulation[];
};

const SIMULATION_GROUP_FALLBACK_ID = 'asset-changes';

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

function getSimulationAssetDirection(asset: ISimulationAsset) {
  if ('transferDirection' in asset) {
    return asset.transferDirection;
  }
  return undefined;
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
        id: `${component.label || SIMULATION_GROUP_FALLBACK_ID}-${index}`,
        label: component.label || SIMULATION_GROUP_FALLBACK_ID,
        assets: component.assets,
      }))
      .filter((group) => group.assets.length > 0) ?? []
  );
}

function getSimulationAssets(simulationGroups: ISimulationGroup[]) {
  return simulationGroups.flatMap((group) => group.assets);
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
  return (
    <YStack gap="$1.5">
      {simulationGroups.map((group) => (
        <YStack key={group.id} gap="$1">
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
  const intl = useIntl();
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
        {intl.formatMessage({
          id: ETranslations.dapp_connect_transaction_preview_estimated_asset_changes__title,
        })}
      </SizableText>
      <SimulationAssetGroups
        simulationGroups={simulationGroups}
        networkNameById={networkNameById}
      />
    </YStack>
  );
}

export default memo(TransactionPreview);
