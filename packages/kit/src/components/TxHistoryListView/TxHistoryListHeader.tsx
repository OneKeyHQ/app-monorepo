import { useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  IconButton,
  Popover,
  Stack,
  Switch,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworksSupportFilterScamHistory } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import type { IAccountHistoryTx } from '@onekeyhq/shared/types/history';

import { useActiveAccount } from '../../states/jotai/contexts/accountSelector';
import { ListItem } from '../ListItem';
import { ListToolToolBar } from '../ListToolBar';

type IProps = {
  filteredHistory: IAccountHistoryTx[];
};

const filterScamHistorySupportedNetworks =
  getNetworksSupportFilterScamHistory();
const filterScamHistorySupportedNetworkIds =
  filterScamHistorySupportedNetworks.map((n) => n.id);

function TxHistoryListHeader({ filteredHistory: _filteredHistory }: IProps) {
  const intl = useIntl();

  const [settings, setSettings] = useSettingsPersistAtom();

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

  const handleFilterLowValueHistoryOnChange = useCallback(
    (value: boolean) => {
      setSettings((v) => ({
        ...v,
        isFilterLowValueHistoryEnabled: !!value,
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
        headerRight={
          <Popover
            title={intl.formatMessage({ id: ETranslations.global_settings })}
            renderTrigger={
              <IconButton
                title={intl.formatMessage({
                  id: ETranslations.manage_token_custom_token_title,
                })}
                variant="tertiary"
                icon="SliderHorOutline"
              />
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
                            id: ETranslations.wallet_history_settings_hide_risk_transaction_desc_unsupported,
                          },
                          {
                            networkName: network?.name ?? '',
                          },
                        )
                  }
                >
                  <Switch
                    isUncontrolled
                    disabled={!filterScamHistorySupported}
                    size={ESwitchSize.small}
                    onChange={handleFilterScamHistoryOnChange}
                    defaultChecked={
                      filterScamHistorySupported
                        ? settings.isFilterScamHistoryEnabled
                        : false
                    }
                  />
                </ListItem>
                <ListItem
                  title={intl.formatMessage({
                    id: ETranslations.wallet_history_settings_hide_small_transaction_title,
                  })}
                  subtitle={intl.formatMessage({
                    id: ETranslations.wallet_history_settings_hide_small_transaction_desc,
                  })}
                >
                  <Switch
                    isUncontrolled
                    size={ESwitchSize.small}
                    onChange={handleFilterLowValueHistoryOnChange}
                    defaultChecked={settings.isFilterLowValueHistoryEnabled}
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
