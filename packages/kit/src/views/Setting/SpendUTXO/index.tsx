import { useCallback } from 'react';

import {
  Page,
  Stack,
  Switch,
  Text,
  XStack,
  YStack,
} from '@onekeyhq/components';

const SpendUTXO = () => {
  const onChange = useCallback(() => {}, []);
  return (
    <Page>
      <YStack px="$5">
        <XStack py="$3" justifyContent="space-between" alignItems="center">
          <Text variant="$bodyMd">Spend Dust UTXO</Text>
          <Switch onChange={onChange} />
        </XStack>
        <Stack>
          <Text color="$textSubdued" variant="$bodySm">
            Using dust UTXO will increase unnecessary transaction fee, and may
            reduce the anonymity and privacy of transactions. It’s recommended
            to disable this feature in order to avoid malicious tracking on
            chain.
          </Text>
        </Stack>
      </YStack>
    </Page>
  );
};

export default SpendUTXO;
