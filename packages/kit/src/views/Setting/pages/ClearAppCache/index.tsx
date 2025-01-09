import type { FC } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';

import { useIntl } from 'react-intl';

import type { INavSearchBarProps } from '@onekeyhq/components';
import {
  Checkbox,
  Dialog,
  Empty,
  Form,
  Page,
  SectionList,
  Stack,
  Toast,
  YStack,
  useClipboard,
  useForm,
} from '@onekeyhq/components';
import {} from '@onekeyhq/components/src/layouts/SectionList';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import {
  useCurrencyPersistAtom,
  useSettingsPersistAtom,
} from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IClearCacheOnAppState } from '@onekeyhq/shared/types/setting';

const keyExtractor = (_: unknown, index: number) => `${index}`;

// onPress: () => {
//   Dialog.show({
//     title: intl.formatMessage({
//       id: ETranslations.settings_clear_cache_on_app,
//     }),
//     renderContent: <ClearCacheOnAppContent />,
//     tone: 'destructive',
//     confirmButtonProps: {
//       disabledOn: ({ getForm }) => {
//         const { getValues } = getForm() || {};
//         if (getValues) {
//           const values = getValues();
//           return !Object.values(values).some((o) => Boolean(o));
//         }
//         return true;
//       },
//     },
//     onConfirm: async (dialogInstance) => {

//     },
//   });
// },
export default function ClearAppCache() {
  const intl = useIntl();
  const form = useForm({
    defaultValues: {
      tokenAndNFT: true,
      transactionHistory: true,
      swapHistory: true,
      browserCache: true,
      appUpdateCache: true,
      browserHistory: false,
      connectSites: false,
      signatureRecord: false,
      customToken: false,
      customRpc: false,
      serverNetworks: false,
    } as IClearCacheOnAppState,
  });
  const { copyText } = useClipboard();

  const values = form.watch();
  const disabled = !Object.values(values).some((o) => Boolean(o));
  return (
    <Page scrollEnabled>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.settings_clear_cache_on_app,
        })}
      />
      <Page.Body>
        <Stack px="$6">
          <Form form={form}>
            <YStack>
              <Form.Field name="tokenAndNFT">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.settings_token_nft_data,
                  })}
                />
              </Form.Field>
              <Form.Field name="transactionHistory">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.settings_transaction_history,
                  })}
                />
              </Form.Field>
              <Form.Field name="swapHistory">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.settings_swap_history,
                  })}
                />
              </Form.Field>
              <Form.Field name="browserCache">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.settings_browser_cache,
                  })}
                />
              </Form.Field>
              <Form.Field name="appUpdateCache">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.settings_app_update_cache,
                  })}
                />
              </Form.Field>
              <Form.Field name="browserHistory">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.settings_browser_history_bookmarks_pins_risk_dapp_whitelist,
                  })}
                  labelProps={{ flex: 1 } as any}
                />
              </Form.Field>
              <Form.Field name="customToken">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.manage_token_custom_token_title,
                  })}
                />
              </Form.Field>
              <Form.Field name="customRpc">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.custom_rpc_title,
                  })}
                />
              </Form.Field>
              <Form.Field name="serverNetworks">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.clear_build_in_networks_data,
                  })}
                />
              </Form.Field>
              <Form.Field name="connectSites">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.settings_connected_sites,
                  })}
                />
              </Form.Field>
              <Form.Field name="signatureRecord">
                <Checkbox
                  label={intl.formatMessage({
                    id: ETranslations.settings_signature_record,
                  })}
                />
              </Form.Field>
            </YStack>
          </Form>
        </Stack>
      </Page.Body>
      <Page.Footer
        onCancel={(close) => close()}
        onConfirm={async (close) => {
          if (values) {
            await backgroundApiProxy.serviceSetting.clearCacheOnApp(values);
            Toast.success({
              title: intl.formatMessage({
                id: ETranslations.global_success,
              }),
            });
            if (
              values?.browserCache &&
              (platformEnv.isWeb || platformEnv.isExtension)
            ) {
              if (platformEnv.isRuntimeChrome || platformEnv.isRuntimeEdge) {
                let settingPath = 'chrome://settings/clearBrowserData';
                if (platformEnv.isRuntimeEdge) {
                  settingPath = 'edge://settings/clearBrowserData';
                }
                Dialog.show({
                  title: intl.formatMessage({
                    id: ETranslations.settings_clear_browser_cache,
                  }),
                  description: intl.formatMessage(
                    {
                      id: ETranslations.settings_clear_browser_cache_desc,
                    },
                    { url: settingPath },
                  ),
                  onConfirm: () => {
                    copyText(settingPath);
                    close();
                  },
                  showCancelButton: false,
                  confirmButtonProps: {
                    variant: 'primary',
                    size: 'large',
                    icon: 'Copy3Outline',
                  },
                  onConfirmText: intl.formatMessage({
                    id: ETranslations.global_copy,
                  }),
                });
              } else {
                Dialog.show({
                  title: intl.formatMessage({
                    id: ETranslations.settings_clear_browser_cache,
                  }),
                  description: intl.formatMessage({
                    id: ETranslations.settings_clear_browser_cache_desc2,
                  }),
                  showCancelButton: false,
                  confirmButtonProps: {
                    variant: 'primary',
                    size: 'large',
                    icon: 'Copy1Outline',
                  },
                  onConfirm: () => {
                    close();
                  },
                });
              }
            } else {
              close();
            }
          }
        }}
        confirmButtonProps={{
          disabled,
        }}
      />
    </Page>
  );
}
