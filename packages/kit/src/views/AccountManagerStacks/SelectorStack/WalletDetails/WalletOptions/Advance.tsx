import { Dialog, ListItem, Stack, Switch, Text } from '@onekeyhq/components';

import { WalletOptionItem } from './WalletOptionItem';

export function Advance() {
  return (
    <WalletOptionItem
      icon="SwitchOutline"
      label="Advance"
      onPress={() =>
        Dialog.show({
          title: 'Advance',
          renderContent: (
            <Stack mx="$-5">
              <ListItem title="Enter Pin on App" pt="$0">
                <Switch size="small" />
              </ListItem>
              <ListItem title="Passphrase">
                <Switch size="small" />
              </ListItem>
              <Text px="$5" variant="$bodyMd">
                Passphrase adds a custom phrase to your recovery phrase to
                create a hidden wallet. Each hidden wallet has its passphrase.
                Do not forget it, as it can't be retrieved & funds will be lost
                permanently.
              </Text>
            </Stack>
          ),
          showFooter: false,
        })
      }
    />
  );
}
