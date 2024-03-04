import { useState } from 'react';

import { debounce } from 'lodash';

import { IconButton, Popover, Stack, Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { ListToolToolBar } from '../ListToolBar';

type IProps = {
  history: IAccountHistoryTx[];
  setSearchKey: (key: string) => void;
};

function TxHistoryListHeader({ history, setSearchKey }: IProps) {
  const [val, setVal] = useState(true);

  return (
    <ListToolToolBar
      searchProps={
        history.length > 10
          ? {
              onChangeText: debounce(
                (searchKey) => setSearchKey(searchKey),
                800,
              ),
            }
          : undefined
      }
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
