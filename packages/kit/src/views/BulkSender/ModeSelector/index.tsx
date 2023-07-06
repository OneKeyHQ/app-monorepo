import { useMemo } from 'react';

import {
  Center,
  HStack,
  VStack,
  useIsVerticalLayout,
} from '@onekeyhq/components';
import { BulkSenderModeEnum } from '@onekeyhq/engine/src/types/batchTransfer';

import { useNetworkSimple } from '../../../hooks';

import { ModeItem } from './ModeItem';

type Props = {
  networkId: string;
};

const modeItemCommonStyle = {};

const modeItemInVerticalLayoutStyle = {
  padding: 4,
  ...modeItemCommonStyle,
};

const modeItemInHorizontalLayoutStyle = {
  width: '200px',
  height: '380px',
  justifyContent: 'center',
  alignItems: 'center',
  ...modeItemCommonStyle,
};

function ModelSelector(props: Props) {
  const { networkId } = props;

  const network = useNetworkSimple(networkId);

  const isVertical = useIsVerticalLayout();

  const modes = useMemo(() => {
    const supportedModes = network?.settings.supportBatchTransfer ?? [];

    return supportedModes.map((mode) => (
      <ModeItem
        mode={mode}
        {...(isVertical
          ? modeItemInVerticalLayoutStyle
          : modeItemInHorizontalLayoutStyle)}
      />
    ));
  }, [isVertical, network?.settings.supportBatchTransfer]);

  return isVertical ? (
    <VStack space={3} padding={4}>
      {modes}
    </VStack>
  ) : (
    <Center width="full" height="full">
      <HStack space={6}>{modes}</HStack>
    </Center>
  );
}

export { ModelSelector };
