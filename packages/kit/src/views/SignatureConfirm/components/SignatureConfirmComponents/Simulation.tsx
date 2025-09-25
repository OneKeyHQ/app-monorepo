import { StyleSheet } from 'react-native';

import { SizableText, YStack } from '@onekeyhq/components';
import {
  EParseTxComponentType,
  type IDisplayComponentSimulation,
} from '@onekeyhq/shared/types/signatureConfirm';

import { Assets } from './Assets';

type IProps = {
  component: IDisplayComponentSimulation;
};

function Simulation(props: IProps) {
  const { component } = props;

  return (
    <YStack
      px="$4"
      py="$3"
      alignItems="center"
      justifyContent="center"
      bg="white"
      borderRadius="$2"
      borderCurve="continuous"
      $platform-native={{
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: '$borderSubdued',
      }}
      $platform-web={{
        boxShadow:
          '0 8px 12px -4px rgba(0, 0, 0, 0.08), 0 0 2px 0 rgba(0, 0, 0, 0.10), 0 1px 2px 0 rgba(0, 0, 0, 0.10)',
      }}
      elevation={0.5}
      gap={6}
    >
      <SizableText>{component.label}</SizableText>
      <YStack gap="$3">
        {component.assets.map((asset, index) => {
          if (asset.type === EParseTxComponentType.InternalAssets) {
            return (
              <Assets.InternalAssets hideLabel key={index} component={asset} />
            );
          }
          if (asset.type === EParseTxComponentType.NFT) {
            return <Assets.NFT hideLabel key={index} component={asset} />;
          }
          if (asset.type === EParseTxComponentType.Token) {
            return <Assets.Token hideLabel key={index} component={asset} />;
          }
          return null;
        })}
      </YStack>
    </YStack>
  );
}

export { Simulation };
