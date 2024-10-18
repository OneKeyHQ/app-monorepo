import { useCallback, useMemo, useState } from 'react';

import BigNumber from 'bignumber.js';
import { isNil } from 'lodash';
import { useIntl } from 'react-intl';

import {
  Button,
  Dialog,
  Divider,
  Form,
  Input,
  TextAreaInput,
  useForm,
} from '@onekeyhq/components';
import type { IEncodedTxEvm } from '@onekeyhq/core/src/chains/evm/types';
import backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import { usePromiseResult } from '@onekeyhq/kit/src/hooks/usePromiseResult';
import { useUnsignedTxsAtom } from '@onekeyhq/kit/src/states/jotai/contexts/sendConfirm';
import { useSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import { appLocale } from '@onekeyhq/shared/src/locale/appLocale';

import {
  InfoItem,
  InfoItemGroup,
} from '../../../AssetDetails/pages/HistoryDetails/components/TxDetailsInfoItem';

type IProps = {
  accountId: string;
  networkId: string;
};

const showNonceFaq = () => {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_nonce,
    }),
    icon: 'LabOutline',
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_nonce_faq_desc,
    }),
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_done,
    }),
  });
};

const showHexDataFaq = () => {
  Dialog.show({
    title: appLocale.intl.formatMessage({
      id: ETranslations.global_hex_data,
    }),
    icon: 'ConsoleOutline',
    description: appLocale.intl.formatMessage({
      id: ETranslations.global_hex_data_faq_desc,
    }),
    showCancelButton: false,
    onConfirmText: appLocale.intl.formatMessage({
      id: ETranslations.global_done,
    }),
  });
};

function TxAdvancedSettingsContainer(props: IProps) {
  const { accountId, networkId } = props;
  const intl = useIntl();
  const [unsignedTxs] = useUnsignedTxsAtom();
  const [settings] = useSettingsPersistAtom();

  const [shouldShowSettings, setShouldShowSettings] = useState<boolean>(false);

  const vaultSettings = usePromiseResult(
    async () =>
      backgroundApiProxy.serviceNetwork.getVaultSettings({ networkId }),
    [networkId],
  ).result;

  const dataContent = useMemo(() => {
    if (!unsignedTxs || unsignedTxs.length === 0) {
      return '';
    }
    return unsignedTxs.reduce((acc, unsignedTx) => {
      const tx = unsignedTx.encodedTx as IEncodedTxEvm;
      if (tx && tx.data) {
        return acc ? `${acc}\n\n${tx.data}` : tx.data;
      }
      return acc;
    }, '');
  }, [unsignedTxs]);

  const canEditNonce = useMemo(
    () =>
      unsignedTxs.length === 1 &&
      vaultSettings?.canEditNonce &&
      settings.isCustomNonceEnabled &&
      !isNil(unsignedTxs[0].nonce),
    [settings.isCustomNonceEnabled, unsignedTxs, vaultSettings?.canEditNonce],
  );

  const currentNonce = unsignedTxs[0].nonce;

  const form = useForm({
    defaultValues: {
      nonce: canEditNonce
        ? new BigNumber(unsignedTxs[0].nonce ?? 0).toFixed()
        : undefined,
    },
    mode: 'onChange',
    reValidateMode: 'onBlur',
  });

  const handleValidateNonce = useCallback(() => {}, []);
  const handleValidateData = useCallback(() => {}, []);

  const renderAdvancedSettings = useCallback(
    () => (
      <Form form={form}>
        <Form.Field
          label={intl.formatMessage({
            id: ETranslations.global_nonce,
          })}
          name="nonce"
          rules={{
            min: 0,
            required: true,
            validate: handleValidateNonce,
            onChange: (e: { target: { name: string; value: string } }) => {
              const value = e.target?.value;
              const valueBN = new BigNumber(value ?? 0);
              if (!valueBN.isInteger() || valueBN.isNegative()) {
                return;
              }
              form.setValue('nonce', valueBN.toFixed());
            },
          }}
          description={intl.formatMessage(
            {
              id: ETranslations.global_nonce_desc,
            },
            {
              'amount': currentNonce,
            },
          )}
          labelAddon={
            <Button
              size="small"
              variant="tertiary"
              icon="WalletOutline"
              onPress={() => showNonceFaq()}
            >
              {intl.formatMessage({
                id: ETranslations.global_nonce_faq,
              })}
            </Button>
          }
        >
          <Input flex={1} />
        </Form.Field>
        <Form.Field
          label={intl.formatMessage({
            id: ETranslations.global_hex_data,
          })}
          name="data"
          rules={{
            validate: handleValidateData,
          }}
          labelAddon={
            <Button
              size="small"
              variant="tertiary"
              icon="WalletOutline"
              onPress={() => showHexDataFaq()}
            >
              {intl.formatMessage({
                id: ETranslations.global_hex_data_faq,
              })}
            </Button>
          }
        >
          <TextAreaInput flex={1} />
        </Form.Field>
      </Form>
    ),
    [currentNonce, form, handleValidateData, handleValidateNonce, intl],
  );

  if (!canEditNonce && dataContent === '') {
    return null;
  }

  return (
    <>
      <Divider mx="$5" />
      <InfoItemGroup>
        <InfoItem
          label={
            <Button
              alignSelf="flex-start"
              variant="tertiary"
              size="small"
              iconAfter={
                shouldShowSettings
                  ? 'ChevronDownSmallOutline'
                  : 'ChevronRightSmallOutline'
              }
              onPress={() => setShouldShowSettings((prev) => !prev)}
            >
              {intl.formatMessage({
                id: ETranslations.global_advanced_settings,
              })}
            </Button>
          }
          renderContent={shouldShowSettings ? renderAdvancedSettings() : null}
        />
      </InfoItemGroup>
    </>
  );
}

export { TxAdvancedSettingsContainer };
