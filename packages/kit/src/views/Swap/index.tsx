import { memo } from 'react';

import { Screen, Text, YStack } from '@onekeyhq/components';

import LocalAuthenticationButton from '../../components/LocalAuthenticationButton/LocalAuthenticationButton';

const Swap = () => {
  console.log('swap');
  return (
    <Screen>
      <YStack space="@4">
        <Text>Swap</Text>
        <LocalAuthenticationButton />
      </YStack>
    </Screen>
  );
};

export default memo(Swap);
