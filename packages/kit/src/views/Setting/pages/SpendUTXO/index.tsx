import {
  Page,
  SizableText,
  Stack,
  Switch,
  XStack,
  YStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import backgroundApiProxy from '../../../../background/instance/backgroundApiProxy';

const SpendUTXO = () => {
  const [settings] = useSettingsPersistAtom();
  return (
    <Page>
      <YStack px="$5">
        <XStack py="$3" justifyContent="space-between" alignItems="center">
          <SizableText size="$bodyMd">Spend Dust UTXO</SizableText>
          <Switch
            value={settings.spendDustUTXO}
            onChange={async (value) => {
              await backgroundApiProxy.serviceSetting.setSpendDustUTXO(value);
            }}
          />
        </XStack>
        <Stack>
          <SizableText color="$textSubdued" size="$bodySm">
            Using dust UTXO will increase unnecessary transaction fee, and may
            reduce the anonymity and privacy of transactions. It’s recommended
            to disable this feature in order to avoid malicious tracking on
            chain.
          </SizableText>
        </Stack>
      </YStack>
    </Page>
  );
};

export default SpendUTXO;
