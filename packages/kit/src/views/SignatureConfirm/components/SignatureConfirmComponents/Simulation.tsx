import { SizableText, XStack, YStack } from '@onekeyhq/components';
import {
  EParseTxComponentType,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';

import { Assets } from './Assets';
import { LaserBorder } from './LaserBorder';
import { ShimmerSignGuard } from './ShimmerSignGuard';

const BORDER_RADIUS = 12;

type IProps = {
  component: IDisplayComponentSimulation;
};

function Simulation(props: IProps) {
  const { component } = props;

  if (component.assets.length === 0) {
    return null;
  }

  return (
    <LaserBorder borderRadius={BORDER_RADIUS}>
      <YStack px="$4" py="$3" gap={6}>
        <XStack justifyContent="space-between" alignItems="center">
          <SizableText size="$headingXs" color="$textSubdued">
            {component.label}
          </SizableText>
          <ShimmerSignGuard />
        </XStack>
        <YStack gap="$3">
          {component.assets.map((asset, index) => {
            if (asset.type === EParseTxComponentType.InternalAssets) {
              return (
                <Assets.InternalAssets
                  hideLabel
                  inSimulation
                  key={index}
                  component={asset}
                  networkId={asset.networkId ?? ''}
                />
              );
            }
            if (asset.type === EParseTxComponentType.NFT) {
              return (
                // oxlint-disable-next-line react/jsx-pascal-case -- NFT is an acronym
                <Assets.NFT
                  hideLabel
                  inSimulation
                  key={index}
                  component={asset}
                  networkId={asset.networkId}
                  showNetwork={asset.showNetwork}
                />
              );
            }
            if (asset.type === EParseTxComponentType.Token) {
              return (
                <Assets.Token
                  hideLabel
                  inSimulation
                  key={index}
                  component={asset}
                  showNetwork={asset.showNetwork}
                  networkId={asset.networkId}
                />
              );
            }
            return null;
          })}
        </YStack>
      </YStack>
    </LaserBorder>
  );
}

export { Simulation };
