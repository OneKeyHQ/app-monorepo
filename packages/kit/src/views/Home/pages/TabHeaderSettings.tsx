import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  Badge,
  ESwitchSize,
  IconButton,
  Popover,
  SizableText,
  Stack,
  Switch,
  XStack,
  useMedia,
} from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworksSupportFilterScamHistory } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import { ListItem } from '../../../components/ListItem';
import { useManageToken } from '../../../hooks/useManageToken';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function TokenListSettings() {
  const intl = useIntl();
  const media = useMedia();
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

  if (media.gtMd) {
    return null;
  }

  return manageTokenEnabled ? (
    <IconButton
      title={intl.formatMessage({
        id: ETranslations.manage_token_title,
      })}
      variant="tertiary"
      icon="SliderHorOutline"
      onPress={handleOnManageToken}
    />
  ) : null;
}
const filterScamHistorySupportedNetworks =
  getNetworksSupportFilterScamHistory();
const filterScamHistorySupportedNetworkIds = new Set(
  filterScamHistorySupportedNetworks.map((n) => n.id),
);

function TxHistorySettings() {
  const intl = useIntl();
  const [settings, setSettings] = useSettingsPersistAtom();
  const { user } = useOneKeyAuth();
  const isPrimeUser = user?.primeSubscription?.isActive && user?.onekeyUserId;
  const exportHistoryText = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.global_export_transaction_history,
      }),
    [intl],
  );
  const exportHistoryTitle = useMemo(
    () => (
      <XStack alignItems="center" gap="$2">
        <SizableText size="$bodyLgMedium">{exportHistoryText}</SizableText>
        {isPrimeUser ? null : (
          <Badge badgeSize="sm" badgeType="default">
            <Badge.Text size="$bodySmMedium">
              {intl.formatMessage({
                id: ETranslations.prime_status_prime,
              })}
            </Badge.Text>
          </Badge>
        )}
      </XStack>
    ),
    [exportHistoryText, intl, isPrimeUser],
  );

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

  const handleExportHistoryPress = useCallback(() => undefined, []);

  const {
    activeAccount: { network },
  } = useActiveAccount({ num: 0 });

  const filterScamHistorySupported = useMemo(
    () =>
      network?.isAllNetworks ||
      filterScamHistorySupportedNetworkIds.has(network?.id ?? ''),
    [network],
  );

  return (
    <Stack>
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_filter })}
        renderTrigger={
          <IconButton
            title={intl.formatMessage({
              id: ETranslations.global_filter,
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
            <ListItem onPress={handleExportHistoryPress} drillIn>
              <ListItem.Text
                flex={1}
                primary={exportHistoryTitle}
                secondary={exportHistoryText}
              />
            </ListItem>
          </Stack>
        }
      />
    </Stack>
  );
}

function BasicTabHeaderSettings({ focusedTab }: { focusedTab: string }) {
  const intl = useIntl();
  const historyName = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.global_history,
      }),
    [intl],
  );
  const portfolioName = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.dexmarket_spot,
      }),
    [intl],
  );

  const content = useMemo(() => {
    switch (focusedTab) {
      case portfolioName:
        return <TokenListSettings />;
      case historyName:
        return <TxHistorySettings />;
      default:
        return null;
    }
  }, [portfolioName, focusedTab, historyName]);
  return <XStack pr="$pagePadding">{content}</XStack>;
}

export const TabHeaderSettings = memo(BasicTabHeaderSettings);
