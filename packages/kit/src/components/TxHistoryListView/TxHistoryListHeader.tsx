import { useState } from 'react';

import {
  IconButton,
  Popover,
  SearchBar,
  Stack,
  Switch,
  XStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';

function TxHistoryListHeader() {
  const [val, setVal] = useState(true);

  return (
    <XStack justifyContent="space-between" p="$5" pb="$3">
      <SearchBar
        placeholder="Search..."
        containerProps={{
          flex: 1,
          mr: '$2.5',
          maxWidth: '$80',
        }}
      />
      <Popover
        title="Settings"
        renderTrigger={<IconButton icon="SwitchOutline" />}
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
    </XStack>
  );
}

export { TxHistoryListHeader };
