import { useCallback } from 'react';

import { useIntl } from 'react-intl';

import type { IPageNavigationProp } from '@onekeyhq/components';
import { ActionList, Dialog, Toast } from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import useAppNavigation from '@onekeyhq/kit/src/hooks/useAppNavigation';
import { useResetApp } from '@onekeyhq/kit/src/views/Setting/hooks';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { EModalSettingRoutes } from '@onekeyhq/shared/src/routes';
import type { IModalSettingParamList } from '@onekeyhq/shared/src/routes';

export const CleanDataItem = () => {
  const intl = useIntl();
  const resetApp = useResetApp();
  const navigation =
    useAppNavigation<IPageNavigationProp<IModalSettingParamList>>();
  const toSettingClearAppCachePage = useCallback(() => {
    navigation.push(EModalSettingRoutes.SettingClearAppCache);
  }, [navigation]);
  return (
    <ActionList
      offset={{ mainAxis: -4, crossAxis: -10 }}
      title={intl.formatMessage({ id: ETranslations.settings_clear_data })}
      renderTrigger={
        <ListItem
          title={intl.formatMessage({ id: ETranslations.settings_clear_data })}
          icon="FolderDeleteOutline"
          testID="setting-clear-data"
        >
          <ListItem.DrillIn name="ChevronDownSmallOutline" />
        </ListItem>
      }
      items={[
        {
          label: intl.formatMessage({
            id: ETranslations.settings_clear_cache_on_app,
          }),
          onPress: toSettingClearAppCachePage,
        },
        {
          label: intl.formatMessage({
            id: ETranslations.settings_clear_pending_transactions,
          }),
          onPress: () => {
            Dialog.show({
              title: intl.formatMessage({
                id: ETranslations.settings_clear_pending_transactions,
              }),
              description: intl.formatMessage({
                id: ETranslations.settings_clear_pending_transactions_desc,
              }),
              tone: 'destructive',
              onConfirmText: intl.formatMessage({
                id: ETranslations.global_clear,
              }),
              onConfirm: async () => {
                await backgroundApiProxy.serviceSetting.clearPendingTransaction();
                appEventBus.emit(
                  EAppEventBusNames.ClearLocalHistoryPendingTxs,
                  undefined,
                );
                Toast.success({
                  title: intl.formatMessage({
                    id: ETranslations.global_success,
                  }),
                });
              },
            });
          },
        },
        {
          label: intl.formatMessage({ id: ETranslations.settings_reset_app }),
          destructive: true,
          onPress: resetApp,
          testID: 'setting-erase-data',
        },
      ]}
    />
  );
};
