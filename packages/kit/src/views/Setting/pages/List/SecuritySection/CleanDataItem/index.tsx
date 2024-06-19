import { useIntl } from 'react-intl';

import {
  ActionList,
  Checkbox,
  Dialog,
  Stack,
  useClipboard,
} from '@onekeyhq/components';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useResetApp } from '@onekeyhq/kit/src/views/Setting/hooks';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IClearCacheOnAppState } from '@onekeyhq/shared/types/setting';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

const ClearCacheOnAppContent = () => {
  const intl = useIntl();
  return (
    <Dialog.Form
      formProps={{
        defaultValues: {
          tokenAndNFT: true,
          transactionHistory: true,
          swapHistory: true,
          browserCache: true,
          browserHistory: false,
          connectSites: false,
          signatureRecord: false,
        } as IClearCacheOnAppState,
      }}
    >
      <Stack>
        <Dialog.FormField name="tokenAndNFT">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.settings_token_nft_data,
            })}
          />
        </Dialog.FormField>
        <Dialog.FormField name="transactionHistory">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.settings_transaction_history,
            })}
          />
        </Dialog.FormField>
        <Dialog.FormField name="swapHistory">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.settings_swap_history,
            })}
          />
        </Dialog.FormField>
        <Dialog.FormField name="browserCache">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.settings_browser_cache,
            })}
          />
        </Dialog.FormField>
        <Dialog.FormField name="browserHistory">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.settings_browser_history_bookmarks_pins_risk_dapp_whitelist,
            })}
            labelProps={{ flex: 1 }}
          />
        </Dialog.FormField>
        <Dialog.FormField name="connectSites">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.settings_connected_sites,
            })}
          />
        </Dialog.FormField>
        <Dialog.FormField name="signatureRecord">
          <Checkbox
            label={intl.formatMessage({
              id: ETranslations.settings_signature_record,
            })}
          />
        </Dialog.FormField>
      </Stack>
    </Dialog.Form>
  );
};

export const CleanDataItem = () => {
  const { copyText } = useClipboard();
  const intl = useIntl();
  const resetApp = useResetApp();
  return (
    <ActionList
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
          onPress: () => {
            Dialog.show({
              title: intl.formatMessage({
                id: ETranslations.settings_clear_cache_on_app,
              }),
              renderContent: <ClearCacheOnAppContent />,
              tone: 'destructive',
              confirmButtonProps: {
                disabledOn: ({ getForm }) => {
                  const { getValues } = getForm() || {};
                  if (getValues) {
                    const values = getValues();
                    return !Object.values(values).some((o) => Boolean(o));
                  }
                  return true;
                },
              },
              onConfirm: async (dialogInstance) => {
                const values = dialogInstance.getForm()?.getValues() as
                  | IClearCacheOnAppState
                  | undefined;
                if (values) {
                  await backgroundApiProxy.serviceSetting.clearCacheOnApp(
                    values,
                  );
                  if (
                    values?.browserCache &&
                    (platformEnv.isWeb || platformEnv.isExtension)
                  ) {
                    Dialog.show({
                      title: intl.formatMessage({
                        id: ETranslations.settings_clear_browser_cache,
                      }),
                      description: intl.formatMessage({
                        id: ETranslations.settings_clear_browser_cache_desc,
                      }),
                      onConfirm: () => {
                        copyText('chrome://settings/clearBrowserData');
                      },
                      showCancelButton: false,
                      confirmButtonProps: {
                        variant: 'primary',
                        size: 'large',
                        icon: 'Copy1Outline',
                      },
                    });
                  }
                }
              },
            });
          },
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
