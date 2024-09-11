import { debounce } from 'lodash';

import { Stack } from '@onekeyhq/components';
import {
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
  filteredHistory: IAccountHistoryTx[];
};

function TxHistoryListHeader({ filteredHistory }: IProps) {
  const [searchKey] = useSearchKeyAtom();
  const { updateSearchKey } = useHistoryListActions().current;

  return (
    <Stack>
      <ListToolToolBar
        searchProps={{
          onChangeText: debounce(
            (text) => updateSearchKey(text),
            SEARCH_DEBOUNCE_INTERVAL,
          ),
          searchResultCount:
            searchKey && searchKey.length >= SEARCH_KEY_MIN_LENGTH
              ? filteredHistory.length
              : 0,
        }}
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
