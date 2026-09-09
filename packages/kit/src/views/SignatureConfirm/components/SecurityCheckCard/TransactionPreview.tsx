import { memo, useMemo } from 'react';

import { useIntl } from 'react-intl';

import { SizableText, Stack, XStack, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { Token } from '@onekeyhq/kit/src/components/Token';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  ETransferDirection,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';

import { SignatureConfirmTestIDs } from '../../testIDs';
import { ShimmerSignGuard } from '../SignatureConfirmComponents/ShimmerSignGuard';

import { ConfirmCardFrame } from './ConfirmCardFrame';
import {
  SIMULATION_GROUP_FALLBACK_ID,
  getShownSimulationAssetNetworkId,
  getSimulationAssetAmount,
  getSimulationAssetDirection,
  getSimulationAssetIconProps,
  getSimulationAssetLabel,
  getSimulationAssetSign,
  getSimulationGroups,
} from './utils';

import type { ISimulationAsset, ISimulationGroup } from './utils';

const DESKTOP_ASSET_LIST_STYLE = {
  alignSelf: 'flex-start',
  width: 'auto',
} as const;
const DESKTOP_ASSET_ROW_STYLE = { justifyContent: 'flex-start' } as const;
const DESKTOP_NAME_SLOT_STYLE = { flexGrow: 0, flexShrink: 0 } as const;
const DESKTOP_NAME_TEXT_STYLE = {
  width: 56,
  flexGrow: 0,
  flexShrink: 0,
} as const;
const DESKTOP_AMOUNT_STYLE = { textAlign: 'left' } as const;

type IProps = {
  simulationComponents?: IDisplayComponentSimulation[];
};

function SignGuardMark() {
  return (
    <Stack
      testID={SignatureConfirmTestIDs.TransactionPreviewSignGuard}
      flexShrink={0}
    >
      <ShimmerSignGuard />
    </Stack>
  );
}

function SimulationAssetText({ asset }: { asset: ISimulationAsset }) {
  const amount = getSimulationAssetAmount(asset);
  const direction = getSimulationAssetDirection(asset);
  // Assets.tsx renders the direction sign unconditionally and hides only the
  // numeric amount for non-ERC1155 NFTs — keep the lone '-'/'+' so an outgoing
  // unique NFT still reads as leaving the wallet.
  const sign = getSimulationAssetSign(asset);
  const color = direction === ETransferDirection.In ? '$textSuccess' : '$text';
  return (
    <SizableText
      size="$bodyMdMedium"
      color={color}
      numberOfLines={1}
      textAlign="right"
      flexShrink={0}
      $gtMd={DESKTOP_AMOUNT_STYLE}
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
    <YStack gap="$2.5" width="100%" $gtMd={DESKTOP_ASSET_LIST_STYLE}>
      {simulationGroups.map((group) => (
        <YStack key={group.id} gap="$2.5">
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
              alignItems="flex-start"
              gap="$3"
              $gtMd={DESKTOP_ASSET_ROW_STYLE}
            >
              <XStack
                gap="$2"
                alignItems="flex-start"
                flex={1}
                minWidth={0}
                $gtMd={DESKTOP_NAME_SLOT_STYLE}
              >
                <Token
                  size="xs"
                  flexShrink={0}
                  {...getSimulationAssetIconProps(asset)}
                />
                <YStack flex={1} minWidth={0} $gtMd={DESKTOP_NAME_TEXT_STYLE}>
                  <SizableText
                    size="$bodyMdMedium"
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
    () => simulationGroups.flatMap((group) => group.assets),
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
      try {
        const { networks } =
          await backgroundApiProxy.serviceNetwork.getNetworksByIds({
            networkIds,
          });
        return networks.reduce<Record<string, string>>((names, network) => {
          names[network.id] = network.name;
          return names;
        }, {});
      } catch {
        return {};
      }
    },
    [networkIds],
    {
      initResult: {},
    },
  );
  const title = intl.formatMessage({
    id: ETranslations.dapp_connect_transaction_preview_estimated_asset_changes__title,
  });
  if (!assets.length) {
    return null;
  }

  return (
    <ConfirmCardFrame glow>
      <YStack
        testID={SignatureConfirmTestIDs.TransactionPreview}
        px="$4"
        py="$3.5"
        gap="$3"
      >
        <XStack alignItems="center" justifyContent="space-between" gap="$3">
          <SizableText size="$headingSm" flex={1} minWidth={0}>
            {title}
          </SizableText>
          <SignGuardMark />
        </XStack>
        <SimulationAssetGroups
          simulationGroups={simulationGroups}
          networkNameById={networkNameById}
        />
      </YStack>
    </ConfirmCardFrame>
  );
}

export default memo(TransactionPreview);
