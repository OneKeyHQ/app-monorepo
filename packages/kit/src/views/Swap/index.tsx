import { memo } from 'react';

import { Text, YStack } from '@onekeyhq/components';

import LocalAuthenticationButton from '../../components/LocalAuthenticationButton/LocalAuthenticationButton';

const Swap = () => {
  console.log('swap');
  return (
    <YStack space="@4">
      <Text>Swap</Text>
      <LocalAuthenticationButton />
    </YStack>
  );
};

export default memo(Swap);
