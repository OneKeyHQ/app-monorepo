import { useState } from 'react';

import { debounce } from 'lodash';

import { IconButton, Popover, Stack, Switch } from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  ENABLE_SEARCH_HISTORY_MIN_LENGTH,
  SEARCH_DEBOUNCE_INTERVAL,
  SEARCH_KEY_MIN_LENGTH,
} from '@onekeyhq/shared/src/consts/walletConsts';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { ListToolToolBar } from '../ListToolBar';

type IProps = {
  history: IAccountHistoryTx[];
  filteredHistory: IAccountHistoryTx[];
  searchKey: string;
  setSearchKey: (key: string) => void;
};

function TxHistoryListHeader({
  history,
  filteredHistory,
  searchKey,
  setSearchKey,
}: IProps) {
  const [val, setVal] = useState(true);

  return (
    <Stack>
      <ListToolToolBar
        searchProps={
          history.length >= ENABLE_SEARCH_HISTORY_MIN_LENGTH
            ? {
                onChangeText: debounce(
                  (text) => setSearchKey(text),
                  SEARCH_DEBOUNCE_INTERVAL,
                ),
                searchResultCount:
                  searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH
                    ? filteredHistory.length
                    : 0,
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
    </Stack>
  );
}

export { TxHistoryListHeader };
