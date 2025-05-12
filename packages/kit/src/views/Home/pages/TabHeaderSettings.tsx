import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';

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
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { ListItem } from '../../../components/ListItem';
import { useManageToken } from '../../../hooks/useManageToken';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function TokenListSettings() {
  const { md } = useMedia();
  const intl = useIntl();

  const {
    activeAccount: {
      account,
      network,
      wallet,
      indexedAccount,
      isOthersWallet,
      deriveType,
    },
  } = useActiveAccount({ num: 0 });
  const { handleOnManageToken, manageTokenEnabled } = useManageToken({
    accountId: account?.id ?? '',
    networkId: network?.id ?? '',
    walletId: wallet?.id ?? '',
    deriveType,
    indexedAccountId: indexedAccount?.id,
    isOthersWallet,
  });
  return manageTokenEnabled ? (
    <IconButton
      title={intl.formatMessage({
        id: ETranslations.manage_token_custom_token_title,
      })}
      variant="tertiary"
      icon="SliderHorOutline"
      onPress={handleOnManageToken}
    />
  ) : null;
}
const filterScamHistorySupportedNetworks =
  getNetworksSupportFilterScamHistory();
const filterScamHistorySupportedNetworkIds =
  filterScamHistorySupportedNetworks.map((n) => n.id);

function TxHistorySettings() {
  const intl = useIntl();
  const media = useMedia();
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
          </Stack>
        }
      />
    </Stack>
  );
}

function DelayedRender({
  children,
  delay = 1200,
}: PropsWithChildren<{ delay?: number }>) {
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShouldRender(true);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [delay]);

  if (!shouldRender) {
    return <Stack />;
  }

  return children;
}

function Container({ children }: PropsWithChildren) {
  return platformEnv.isNativeAndroid ? (
    children
  ) : (
    <DelayedRender>
      <Stack position="absolute" top="$3" right="$5">
        {children}
      </Stack>
    </DelayedRender>
  );
}

function BasicTabHeaderSettings() {
  const [tabIndex, setTabIndex] = useState(0);
  useEffect(() => {
    const callback = ({ index }: { index: number }) => {
      setTabIndex(index);
    };
    appEventBus.on(EAppEventBusNames.HomeTabsIndexChanged, callback);
    return () => {
      appEventBus.off(EAppEventBusNames.HomeTabsIndexChanged, callback);
    };
  }, []);

  const content = useMemo(() => {
    switch (tabIndex) {
      case 0:
        return <TokenListSettings />;
      case 2:
        return <TxHistorySettings />;
      default:
        return null;
    }
  }, [tabIndex]);
  return <Container>{content}</Container>;
}

export const TabHeaderSettings = memo(BasicTabHeaderSettings);
