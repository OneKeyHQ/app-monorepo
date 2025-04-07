import { useCallback, useMemo } from 'react';

import { debounce } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  ESwitchSize,
  IconButton,
  Popover,
  Stack,
  Switch,
  useMedia,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworksSupportFilterScamHistory } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  SEARCH_DEBOUNCE_INTERVAL,
  SEARCH_KEY_MIN_LENGTH,
} from '@onekeyhq/shared/src/consts/walletConsts';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
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

const filterScamHistorySupportedNetworks =
  getNetworksSupportFilterScamHistory();
const filterScamHistorySupportedNetworkIds =
  filterScamHistorySupportedNetworks.map((n) => n.id);

function TxHistoryListHeader({ filteredHistory }: IProps) {
  const intl = useIntl();
  const media = useMedia();
  const [searchKey] = useSearchKeyAtom();
  const [settings, setSettings] = useSettingsPersistAtom();
  const { updateSearchKey } = useHistoryListActions().current;

  const handleFilterScamHistoryOnChange = useCallback(
    (value: boolean) => {
      setSettings((v) => ({
        ...v,
        isFilterScamHistoryEnabled: !!value,
      }));
      appEventBus.emit(EAppEventBusNames.RefreshHistoryList, undefined);
    },
    [setSettings],
  );

  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });

  const filterScamHistorySupported = useMemo(
    () =>
      network?.isAllNetworks ||
      filterScamHistorySupportedNetworkIds.includes(network?.id ?? ''),
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
              media.md ? (
                <IconButton
                  title={intl.formatMessage({
                    id: ETranslations.manage_token_custom_token_title,
                  })}
                  variant="tertiary"
                  icon="SliderHorOutline"
                />
              ) : (
                <Button icon="SliderHorOutline" size="small" variant="tertiary">
                  {intl.formatMessage({
                    id: ETranslations.global_manage,
                  })}
                </Button>
              )
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
                    size={ESwitchSize.small}
                    onChange={handleFilterScamHistoryOnChange}
                    value={
                      filterScamHistorySupported
                        ? settings.isFilterScamHistoryEnabled
                        : false
                    }
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
