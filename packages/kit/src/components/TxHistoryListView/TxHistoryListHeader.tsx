import { useCallback, useMemo } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  IconButton,
  Popover,
  Stack,
  Switch,
} from '@onekeyhq/components';
import {
  SEARCH_DEBOUNCE_INTERVAL,
  SEARCH_KEY_MIN_LENGTH,
} from '@onekeyhq/shared/src/consts/walletConsts';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import {
  useHistoryListActions,
  useSearchKeyAtom,
} from '../../states/jotai/contexts/historyList';
import { ListItem } from '../ListItem';
import { ListToolToolBar } from '../ListToolBar';

type IProps = {
  filteredHistory: IAccountHistoryTx[];
};

function TxHistoryListHeader({ filteredHistory }: IProps) {
  const intl = useIntl();
  const [searchKey] = useSearchKeyAtom();
  const { updateSearchKey } = useHistoryListActions().current;

  const handleFilterScamHistoryOnChange = useCallback(() => {
    console.log('handleFilterScamHistoryOnChange');
  }, []);

  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });

  const filterScamHistorySupported = useMemo(
    () => network?.isAllNetworks || network?.backendIndex,
    [network],
  );

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
        headerRight={
          <Popover
            title={intl.formatMessage({ id: ETranslations.global_settings })}
            renderTrigger={
              <IconButton variant="tertiary" icon="SliderVerOutline" />
            }
            renderContent={
              <Stack py="$2">
                <ListItem
                  title={intl.formatMessage({
                    id: ETranslations.wallet_history_settings_hide_risk_transaction_title,
                  })}
                  subtitle={
                    filterScamHistorySupported
                      ? intl.formatMessage({
                          id: ETranslations.wallet_history_settings_hide_risk_transaction_desc,
                        })
                      : intl.formatMessage(
                          {
                            id: ETranslations.wallet_history_settings_hide_risk_transaction_desc_unsupprted,
                          },
                          {
                            networkName: network?.name ?? '',
                          },
                        )
                  }
                >
                  <Switch
                    disabled={!filterScamHistorySupported}
                    size={ESwitchSize.large}
                    onChange={handleFilterScamHistoryOnChange}
                  />
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
