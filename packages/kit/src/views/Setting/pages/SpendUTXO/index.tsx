import { Page, SizableText, Stack, Switch, YStack } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

const SpendUTXO = () => {
  const [settings] = useSettingsPersistAtom();
  return (
    <Page>
      <YStack>
        <ListItem title="Spend Dust UTXO">
          <Switch
            size="large"
            value={settings.spendDustUTXO}
            onChange={async (value) => {
              await backgroundApiProxy.serviceSetting.setSpendDustUTXO(value);
            }}
          />
        </ListItem>
        <Stack px="$5">
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
