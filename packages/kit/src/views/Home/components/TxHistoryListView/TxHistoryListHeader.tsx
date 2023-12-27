import { useIntl } from 'react-intl';

import {
  IconButton,
  ListItem,
  Popover,
  SearchBar,
  Stack,
  Switch,
  Text,
  XStack,
} from '@onekeyhq/components';

function TxHistoryListHeader() {
  const intl = useIntl();
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
          <Stack>
            <ListItem
              title="Hide Zero-Value Transfers"
              subtitle="Avoid scam attempts by hiding transfers of zero-value tokens."
            >
              <Switch size="small" />
            </ListItem>
          </Stack>
        }
      />
    </XStack>
  );
}

export { TxHistoryListHeader };
