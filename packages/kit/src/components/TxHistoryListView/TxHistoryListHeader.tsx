import { useState } from 'react';

import { IconButton, Popover, Stack, Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

import { WalletListHeaderToolBar } from '../TokenListView/TokenListHeader';

function TxHistoryListHeader() {
  const [val, setVal] = useState(true);

  return (
    <WalletListHeaderToolBar
      headerRight={
        <Popover
          title="Settings"
          renderTrigger={
            <IconButton variant="tertiary" icon="SliderVerOutline" />
          }
          renderContent={
            <Stack py="$2">
              <ListItem
                title="Hide Zero-Value Transfers"
                subtitle="Avoid scam attempts by hiding transfers of zero-value tokens."
              >
                <Switch size="small" value={val} onChange={setVal} />
              </ListItem>
            </Stack>
          }
        />
      }
    />
  );
}

export { TxHistoryListHeader };
