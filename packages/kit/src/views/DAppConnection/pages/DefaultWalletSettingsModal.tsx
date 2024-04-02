import { useState } from 'react';

import { Divider, Image, Page, Stack, Switch } from '@onekeyhq/components';

import { ListItem } from '../../../components/ListItem';

function EmptyGuide() {
  return (
    <Stack
      w="100%"
      px={22}
      py="$2.5"
      alignItems="center"
      justifyContent="center"
    >
      <Image
        w="$80"
        h={341}
        source={require('@onekeyhq/kit/assets/extension_menu.png')}
      />
    </Stack>
  );
}

function DefaultWalletSettingsModal() {
  const [val, setVal] = useState(false);

  return (
    <Page>
      <Page.Header title="Default Wallet Settings" />
      <Page.Body>
        <ListItem
          title="Set OneKey as default wallet"
          subtitle="Use OneKey as the default wallet to connect to dApps."
        >
          <Switch
            value={val}
            onChange={() => {
              setVal(!val);
            }}
          />
        </ListItem>
        <Divider my="$2.5" />
        <ListItem
          title="Excluded dApps"
          subtitle="Right-click blank space, select the option below to exclude."
        />
        <EmptyGuide />
      </Page.Body>
    </Page>
  );
}

export default DefaultWalletSettingsModal;
