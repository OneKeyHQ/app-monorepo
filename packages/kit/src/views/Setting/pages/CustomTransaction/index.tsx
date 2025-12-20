import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  ESwitchSize,
  Page,
  SizableText,
  Switch,
  YStack,
  startViewTransition,
  useDialogInstance,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useHelpLink } from '@onekeyhq/kit/src/hooks/useHelpLink';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import {
  openUrlExternal,
  openUrlInApp,
} from '@onekeyhq/shared/src/utils/openUrlUtils';

function CustomTxDataLearnMoreButton({
  closeDialogAfterClick = true,
  openLinkInApp = true,
}: {
  closeDialogAfterClick?: boolean;
  openLinkInApp?: boolean;
}) {
  const intl = useIntl();
  const dialogInstance = useDialogInstance();
  const customTxDataHelpLink = useHelpLink({
    path: 'articles/11959368',
  });
  return (
    <Button
      flex={1}
      textAlign="left"
      justifyContent="flex-start"
      size="small"
      variant="tertiary"
      icon="QuestionmarkOutline"
      onPress={() => {
        if (openLinkInApp) {
          openUrlInApp(customTxDataHelpLink);
        } else {
          openUrlExternal(customTxDataHelpLink);
        }
        if (closeDialogAfterClick) {
          void dialogInstance.close();
        }
      }}
    >
      {intl.formatMessage({
        id: ETranslations.global_learn_more,
      })}
    </Button>
  );
}

function CustomTransaction() {
  const intl = useIntl();
  const [settings, setSettings] = useSettingsPersistAtom();

  return (
    <Page>
      <Page.Header
        title={intl.formatMessage({
          id: ETranslations.global_customize_transaction,
        })}
      />
      <Page.Body>
        <YStack gap="$6">
          <YStack>
            <ListItem
              title={intl.formatMessage({
                id: ETranslations.global_customize_nonce,
              })}
            >
              <Switch
                size={ESwitchSize.small}
                value={settings.isCustomNonceEnabled}
                onChange={async (value) => {
                  startViewTransition(() => {
                    setSettings((v) => ({
                      ...v,
                      isCustomNonceEnabled: !!value,
                    }));
                  });
                }}
              />
            </ListItem>
            <SizableText px="$5" size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_customize_nonce_desc,
              })}
            </SizableText>
          </YStack>
          <YStack>
            <ListItem
              title={intl.formatMessage({
                id: ETranslations.global_hex_data_title,
              })}
            >
              <Switch
                size={ESwitchSize.small}
                value={settings.isCustomTxMessageEnabled}
                onChange={async (value) => {
                  await new Promise<void>((resolve) => {
                    if (value) {
                      Dialog.show({
                        icon: 'ErrorOutline',
                        tone: 'destructive',
                        title: intl.formatMessage({
                          id: ETranslations.global_warning,
                        }),
                        description: intl.formatMessage({
                          id: ETranslations.global_hex_data_warning,
                        }),
                        onConfirmText: intl.formatMessage({
                          id: ETranslations.global_i_understand,
                        }),
                        showCancelButton: false,
                        onConfirm: async () => {
                          resolve();
                        },
                        renderContent: <CustomTxDataLearnMoreButton />,
                      });
                    } else {
                      resolve();
                    }
                  });
                  startViewTransition(() => {
                    setSettings((v) => ({
                      ...v,
                      isCustomTxMessageEnabled: !!value,
                    }));
                  });
                }}
              />
            </ListItem>
            <SizableText px="$5" size="$bodySm" color="$textSubdued">
              {intl.formatMessage({
                id: ETranslations.global_hex_data_faq_desc,
              })}
            </SizableText>
          </YStack>
        </YStack>
      </Page.Body>
    </Page>
  );
}

export default CustomTransaction;
