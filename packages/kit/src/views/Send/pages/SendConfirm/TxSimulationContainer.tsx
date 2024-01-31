import { memo, useCallback } from 'react';

import { Icon, Image, SizableText, XStack, YStack } from '@onekeyhq/components';
import { Container } from '@onekeyhq/kit/src/components/Container';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

export type ITxSimulationItem = {
  label: string;
  icon: string;
  isNFT?: boolean;
};

// for now just UI demo
const mockSimulationDataIn: ITxSimulationItem[] = [
  {
    label: '+2355.355 MATIC',
    icon: 'https://assets.coingecko.com/coins/images/4713/standard/polygon.png?1698233745',
  },
];
const mockSimulationDataOut: ITxSimulationItem[] = [
  {
    label: '-0.877395 ETH',
    icon: 'https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons@1a63530be6e374711a8554f31b17e4cb92c25fa5/128/color/eth.png',
  },
  {
    label: '360 USDC',
    icon: 'https://assets.coingecko.com/coins/images/6319/standard/usdc.png?1696506694',
  },
];

function SimulationItem(item: ITxSimulationItem) {
  const { label, icon, isNFT } = item;
  return (
    <XStack alignItems="center" space="$1">
      <ListItem.Avatar
        src={icon}
        size="$5"
        circular={!isNFT}
        fallbackProps={{
          bg: '$bgStrong',
          justifyContent: 'center',
          alignItems: 'center',
          children: (
            <Icon
              name={isNFT ? 'QuestionmarkOutline' : 'ImageMountainSolid'}
              color="$iconSubdued"
            />
          ),
        }}
      />
      <SizableText size="$bodyMdMedium">{label}</SizableText>
    </XStack>
  );
}

function TxSimulationContainer() {
  const renderTxSimulation = useCallback(
    (simulation: ITxSimulationItem[]) => (
      <YStack space="$1">
        {simulation.map((item, index) => (
          <SimulationItem {...item} key={index} />
        ))}
      </YStack>
    ),
    [],
  );

  return (
    <Container.Box>
      <Container.Item
        title="Total out"
        subtitle="Include fee"
        content={renderTxSimulation(mockSimulationDataOut)}
      />
      <Container.Item
        title="Total in"
        content={renderTxSimulation(mockSimulationDataIn)}
      />
      <Container.Item
        content={
          <SizableText size="$bodySm" color="$textSubdued">
            For reference only
          </SizableText>
        }
        contentAdd={
          <XStack alignItems="center" space="$1">
            <SizableText size="$bodySmMedium" color="$textSubdued">
              Power by
            </SizableText>
            <Image
              w={58}
              h={12}
              source={require('@onekeyhq/kit/assets/blockaid_logo.png')}
            />
          </XStack>
        }
      />
    </Container.Box>
  );
}

export default memo(TxSimulationContainer);
