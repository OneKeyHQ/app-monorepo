import type { ReactNode } from 'react';
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
  usePopoverContext,
} from '@onekeyhq/components';
import { useOneKeyAuth } from '@onekeyhq/kit/src/components/OneKeyAuth/useOneKeyAuth';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworksSupportFilterScamHistory } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalBulkExportHistoryRoutes } from '@onekeyhq/shared/src/routes/bulkExportHistory';
import { EPrimeFeatures, EPrimePages } from '@onekeyhq/shared/src/routes/prime';
import timerUtils from '@onekeyhq/shared/src/utils/timerUtils';

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

function TxHistorySettingsContent({
  filterScamHistorySupported,
  networkName,
  isFilterScamHistoryEnabled,
  isFilterLowValueHistoryEnabled,
  onFilterScamHistoryChange,
  onFilterLowValueHistoryChange,
  exportHistoryText,
  exportHistoryTitle,
  accountId,
  indexedAccountId,
  isPrimeSubscriptionActive,
  networkId,
  walletId,
}: {
  filterScamHistorySupported: boolean;
  networkName: string;
  isFilterScamHistoryEnabled: boolean;
  isFilterLowValueHistoryEnabled: boolean;
  onFilterScamHistoryChange: (value: boolean) => void;
  onFilterLowValueHistoryChange: (value: boolean) => void;
  exportHistoryText: string;
  exportHistoryTitle: ReactNode;
  accountId: string | undefined;
  indexedAccountId: string | undefined;
  isPrimeSubscriptionActive: boolean;
  networkId: string | undefined;
  walletId: string | undefined;
}) {
  const intl = useIntl();
  const navigation = useAppNavigation();
  const { closePopover } = usePopoverContext();

  const handleExportHistoryPress = useCallback(async () => {
    await closePopover?.();
    await timerUtils.wait(150);

    if (isPrimeSubscriptionActive) {
      navigation.pushModal(EModalRoutes.BulkExportHistoryModal, {
        screen: EModalBulkExportHistoryRoutes.BulkExportHistoryModal,
        params: {
          accountId,
          indexedAccountId,
          networkId,
          walletId,
        },
      });
      return;
    }

    navigation.pushModal(EModalRoutes.PrimeModal, {
      screen: EPrimePages.PrimeDashboard,
      params: {
        fromFeature: EPrimeFeatures.HistoryExport,
      },
    });
  }, [
    accountId,
    closePopover,
    indexedAccountId,
    isPrimeSubscriptionActive,
    navigation,
    networkId,
    walletId,
  ]);

  return (
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
                  networkName,
                },
              )
        }
      >
        <Switch
          isUncontrolled
          disabled={!filterScamHistorySupported}
          size={ESwitchSize.small}
          onChange={onFilterScamHistoryChange}
          defaultChecked={
            filterScamHistorySupported ? isFilterScamHistoryEnabled : false
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
          onChange={onFilterLowValueHistoryChange}
          defaultChecked={isFilterLowValueHistoryEnabled}
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
  );
}

function TxHistorySettings() {
  const intl = useIntl();
  const [settings, setSettings] = useSettingsPersistAtom();
  const { isPrimeSubscriptionActive } = useOneKeyAuth();
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
        {isPrimeSubscriptionActive ? null : (
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
    [exportHistoryText, intl, isPrimeSubscriptionActive],
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

  const {
    activeAccount: { account, indexedAccount, network, wallet },
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
          <TxHistorySettingsContent
            filterScamHistorySupported={!!filterScamHistorySupported}
            networkName={network?.name ?? ''}
            isFilterScamHistoryEnabled={!!settings.isFilterScamHistoryEnabled}
            isFilterLowValueHistoryEnabled={
              !!settings.isFilterLowValueHistoryEnabled
            }
            onFilterScamHistoryChange={handleFilterScamHistoryOnChange}
            onFilterLowValueHistoryChange={handleFilterLowValueHistoryOnChange}
            exportHistoryText={exportHistoryText}
            exportHistoryTitle={exportHistoryTitle}
            accountId={account?.id}
            indexedAccountId={indexedAccount?.id}
            isPrimeSubscriptionActive={!!isPrimeSubscriptionActive}
            networkId={network?.id}
            walletId={wallet?.id}
          />
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
