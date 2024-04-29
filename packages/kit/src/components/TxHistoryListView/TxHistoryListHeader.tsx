import { debounce } from 'lodash';

import { Stack } from '@onekeyhq/components';
import {
  ENABLE_SEARCH_HISTORY_MIN_LENGTH,
  SEARCH_DEBOUNCE_INTERVAL,
  SEARCH_KEY_MIN_LENGTH,
} from '@onekeyhq/shared/src/consts/walletConsts';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import {
  useHistoryListActions,
  useSearchKeyAtom,
} from '../../states/jotai/contexts/historyList';
import { ListToolToolBar } from '../ListToolBar';

type IProps = {
  history: IAccountHistoryTx[];
  filteredHistory: IAccountHistoryTx[];
};

function TxHistoryListHeader({ history, filteredHistory }: IProps) {
  const [searchKey] = useSearchKeyAtom();
  const { updateSearchKey } = useHistoryListActions().current;

  return (
    <Stack>
      <ListToolToolBar
        searchProps={
          history.length >= ENABLE_SEARCH_HISTORY_MIN_LENGTH
            ? {
                onChangeText: debounce(
                  (text) => updateSearchKey(text),
                  SEARCH_DEBOUNCE_INTERVAL,
                ),
                searchResultCount:
                  searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH
                    ? filteredHistory.length
                    : 0,
              }
            : undefined
        }
        // headerRight={
        //   <Popover
        //     title="Settings"
        //     renderTrigger={
        //       <IconButton variant="tertiary" icon="SliderVerOutline" />
        //     }
        //     renderContent={
        //       <Stack py="$2">
        //         <ListItem
        //           title="Hide Zero-Value Transfers"
        //           subtitle="Avoid scam attempts by hiding transfers of zero-value tokens."
        //         >
        //           <Switch size={ESwitchSize.small} value={val} onChange={setVal} />
        //         </ListItem>
        //       </Stack>
        //     }
        //   />
        // }
      />
    </Stack>
  );
}

export { TxHistoryListHeader };
