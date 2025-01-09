import { useIntl } from 'react-intl';

import {
  ESwitchSize,
  Page,
  SizableText,
  Switch,
  YStack,
} from '@onekeyhq/components';
import { ListItem } from '@onekeyhq/kit/src/components/ListItem';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';

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
                  setSettings((v) => ({ ...v, isCustomNonceEnabled: !!value }));
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
                  setSettings((v) => ({
                    ...v,
                    isCustomTxMessageEnabled: !!value,
                  }));
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
