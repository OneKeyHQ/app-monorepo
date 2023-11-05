import { memo } from 'react';

import { Page, Text, YStack } from '@onekeyhq/components';

import LocalAuthenticationButton from '../../components/LocalAuthenticationButton/LocalAuthenticationButton';

const Swap = () => {
  console.log('swap');
  return (
    <Page>
      <YStack space="$4">
        <Text>Swap</Text>
        <LocalAuthenticationButton />
      </YStack>
    </Page>
  );
};

export default memo(Swap);
