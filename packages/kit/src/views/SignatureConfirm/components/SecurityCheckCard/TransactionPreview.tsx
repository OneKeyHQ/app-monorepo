import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ETransferDirection,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmTestIDs } from '../../testIDs';
import { LaserBorder } from '../SignatureConfirmComponents/LaserBorder';

import {
  SIMULATION_GROUP_FALLBACK_ID,
  getShownSimulationAssetNetworkId,
  getSimulationAssetAmount,
  getSimulationAssetDirection,
  getSimulationAssetIconProps,
  getSimulationAssetLabel,
  getSimulationAssetSign,
  getSimulationAssets,
  getSimulationGroups,
} from './utils';

import type { ISimulationAsset, ISimulationGroup } from './utils';

type IProps = {
  simulationComponents?: IDisplayComponentSimulation[];
  // When true, render only the asset rows (no LaserBorder frame) so a parent
  // unified card can own the frame; SignGuard branding lives in the parent
  // card's footer.
  bare?: boolean;
};

function SimulationAssetText({ asset }: { asset: ISimulationAsset }) {
  const amount = getSimulationAssetAmount(asset);
  const direction = getSimulationAssetDirection(asset);
  // Assets.tsx renders the direction sign unconditionally and hides only the
  // numeric amount for non-ERC1155 NFTs — keep the lone '-'/'+' so an outgoing
  // unique NFT still reads as leaving the wallet.
  const sign = getSimulationAssetSign(asset);
  // Match the original simulation card (Assets.tsx) scheme: incoming green, else
  // default text ($text — Assets.tsx's '$textText' is a typo for the same color).
  const color = direction === ETransferDirection.In ? '$textSuccess' : '$text';
  return (
    <SizableText
      size="$bodySmMedium"
      color={color}
      numberOfLines={1}
      textAlign="right"
    >
      {`${sign}${amount}`}
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

  if (!networkId) {
    return null;
  }

  return (
    <SizableText
      size="$bodyXs"
      color="$textSubdued"
      minHeight="$4"
      numberOfLines={1}
    >
      {networkName ?? ' '}
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
          {simulationGroups.length > 1 &&
          group.label !== SIMULATION_GROUP_FALLBACK_ID ? (
            <SizableText size="$bodyXs" color="$textSubdued" numberOfLines={1}>
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

function TransactionPreview({ simulationComponents, bare }: IProps) {
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

  const content = (
    <YStack
      testID={SignatureConfirmTestIDs.TransactionPreview}
      px={bare ? '$0' : '$3'}
      py={bare ? '$0' : '$3'}
      gap="$2"
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

  if (bare) {
    return content;
  }

  return (
    <LaserBorder borderRadius={12} borderColor="$neutral4">
      {content}
    </LaserBorder>
  );
}

export default memo(TransactionPreview);
