import { memo, useCallback, useMemo } from 'react';

import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  IconButton,
  Popover,
  Stack,
  Switch,
  XStack,
} from '@onekeyhq/components';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { getNetworksSupportFilterScamHistory } from '@onekeyhq/shared/src/config/presetNetworks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalRoutes } from '@onekeyhq/shared/src/routes';
import { EModalApprovalManagementRoutes } from '@onekeyhq/shared/src/routes/approvalManagement';

import { ListItem } from '../../../components/ListItem';
import useAppNavigation from '../../../hooks/useAppNavigation';
import { useManageToken } from '../../../hooks/useManageToken';
import { useActiveAccount } from '../../../states/jotai/contexts/accountSelector';

function TokenListSettings() {
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
const filterScamHistorySupportedNetworkIds =
  filterScamHistorySupportedNetworks.map((n) => n.id);

function TxHistorySettings() {
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
      <Popover
        title={intl.formatMessage({ id: ETranslations.global_filter })}
        renderTrigger={
          <IconButton
            title={intl.formatMessage({
              id: ETranslations.global_filter,
            })}
            variant="tertiary"
            icon="Filter1Outline"
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
    </Stack>
  );
}

function ApprovalSettings() {
  const navigation = useAppNavigation();
  const {
    activeAccount: { wallet, account, network },
  } = useActiveAccount({ num: 0 });
  const handleOnOpenApprovalList = useCallback(() => {
    navigation.pushModal(EModalRoutes.ApprovalManagementModal, {
      screen: EModalApprovalManagementRoutes.ApprovalList,
      params: {
        walletId: wallet?.id ?? '',
        accountId: account?.id ?? '',
        networkId: network?.id ?? '',
        isBulkRevokeMode: true,
      },
    });
  }, [account?.id, navigation, network?.id, wallet?.id]);

  const intl = useIntl();
  return (
    <IconButton
      title={intl.formatMessage({
        id: ETranslations.wallet_approval_manage_title,
      })}
      variant="tertiary"
      icon="SliderHorOutline"
      onPress={handleOnOpenApprovalList}
    />
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
  const cryptoName = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.global_crypto,
      }),
    [intl],
  );

  const approvalName = useMemo(
    () =>
      intl.formatMessage({
        id: ETranslations.global_approval,
      }),
    [intl],
  );
  const content = useMemo(() => {
    switch (focusedTab) {
      case cryptoName:
        return <TokenListSettings />;
      case historyName:
        return <TxHistorySettings />;
      case approvalName:
        return <ApprovalSettings />;
      default:
        return null;
    }
  }, [approvalName, cryptoName, focusedTab, historyName]);
  return <XStack pr="$5">{content}</XStack>;
}

export const TabHeaderSettings = memo(BasicTabHeaderSettings);
