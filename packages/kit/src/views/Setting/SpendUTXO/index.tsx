import {
  Page,
  Stack,
  Switch,
  Text,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../background/instance/backgroundApiProxy';

const SpendUTXO = () => {
  const [settings] = useSettingsPersistAtom();
  return (
    <Page>
      <YStack px="$5">
        <XStack py="$3" justifyContent="space-between" alignItems="center">
          <Text variant="$bodyMd">Spend Dust UTXO</Text>
          <Switch
            value={settings.spendDustUTXO}
            onChange={async (value) => {
              await backgroundApiProxy.serviceSetting.setSpendDustUTXO(value);
            }}
          />
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
